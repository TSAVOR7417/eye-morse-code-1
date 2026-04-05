import threading
import time
from dataclasses import dataclass

import numpy as np
import sounddevice as sd


MORSE_DICT = {
    ".-": "A",
    "-...": "B",
    "-.-.": "C",
    "-..": "D",
    ".": "E",
    "..-.": "F",
    "--.": "G",
    "....": "H",
    "..": "I",
    ".---": "J",
    "-.-": "K",
    ".-..": "L",
    "--": "M",
    "-.": "N",
    "---": "O",
    ".--.": "P",
    "--.-": "Q",
    ".-.": "R",
    "...": "S",
    "-": "T",
    "..-": "U",
    "...-": "V",
    ".--": "W",
    "-..-": "X",
    "-.--": "Y",
    "--..": "Z",
    "-----": "0",
    ".----": "1",
    "..---": "2",
    "...--": "3",
    "....-": "4",
    ".....": "5",
    "-....": "6",
    "--...": "7",
    "---..": "8",
    "----.": "9",
}
LETTER_MORSE = {code: ch for code, ch in ((v, k) for k, v in MORSE_DICT.items()) if "A" <= ch <= "Z"}


@dataclass
class DetectorConfig:
    sample_rate: int = 16000
    block_size: int = 512
    calibration_seconds: float = 1.2
    dot_max: float = 0.28
    min_tone: float = 0.01
    max_tone: float = 1.2
    # Lower letter/word gap improves multi-letter decoding at faster Morse speeds.
    letter_gap: float = 0.16
    word_gap: float = 0.55
    session_end_silence: float = 0.9
    min_freq: float = 280.0
    max_freq: float = 1800.0
    min_prominence_db: float = 5.0
    arm_min_tone: float = 0.015
    state_hold: float = 0.016
    tone_lock_tolerance: float = 140.0
    arm_min_freq: float = 300.0
    arm_max_freq: float = 1200.0
    arm_min_prominence_db: float = 2.8
    arm_rms_boost: float = 0.0


class AudioDetector:
    def __init__(self, config: DetectorConfig | None = None) -> None:
        self.cfg = config or DetectorConfig()
        self.lock = threading.Lock()
        self.running = False
        self.thread: threading.Thread | None = None
        self.stop_event = threading.Event()
        self.last_error = ""

        self.text = ""
        self.current_morse = ""
        self.sound_on = False
        self.pending_sound = False
        self.pending_since = 0.0
        self.last_state_change = 0.0
        self.last_symbol_time = 0.0
        self.space_added = False
        self.session_active = False
        self.arm_tone_started = 0.0

        self.calibrating = True
        self.calibration_started = 0.0
        self.calibration_rms: list[float] = []
        self.calibration_db: list[float] = []
        self.noise_rms = 0.0
        self.noise_std = 0.0
        self.noise_db = -100.0
        self.rms_threshold = 0.02
        self.db_threshold = -58.0

        self.last_rms = 0.0
        self.last_peak_db = -100.0
        self.last_peak_freq = 0.0
        self.last_prominence = 0.0
        self.last_signal = False
        self.tone_lock_freq = 0.0
        self.last_chunk = ""
        self.last_decoded = ""

    def _reset_runtime_state(self) -> None:
        self.text = ""
        self.current_morse = ""
        self.sound_on = False
        self.pending_sound = False
        self.pending_since = 0.0
        self.last_state_change = time.monotonic()
        self.last_symbol_time = 0.0
        self.space_added = False
        self.session_active = False
        self.arm_tone_started = 0.0
        self.calibrating = True
        self.calibration_started = time.monotonic()
        self.calibration_rms = []
        self.calibration_db = []
        self.noise_rms = 0.0
        self.noise_std = 0.0
        self.noise_db = -100.0
        self.rms_threshold = 0.02
        self.db_threshold = -58.0
        self.last_rms = 0.0
        self.last_peak_db = -100.0
        self.last_peak_freq = 0.0
        self.last_prominence = 0.0
        self.last_signal = False
        self.tone_lock_freq = 0.0
        self.last_chunk = ""
        self.last_decoded = ""
        self.last_error = ""

    def start(self) -> bool:
        with self.lock:
            if self.running and self.thread and self.thread.is_alive():
                return True
            self._reset_runtime_state()
            self.stop_event.clear()
            self.running = True
            self.thread = threading.Thread(target=self._run, daemon=True)
            self.thread.start()
            return True

    def stop(self) -> None:
        with self.lock:
            self.running = False
            self.stop_event.set()

    def is_running(self) -> bool:
        with self.lock:
            return self.running

    def clear_text(self) -> None:
        with self.lock:
            self.text = ""
            self.current_morse = ""
            self.space_added = False

    def get_text(self) -> str:
        with self.lock:
            return self.text

    def get_debug(self) -> dict:
        with self.lock:
            return {
                "running": self.running,
                "session_active": self.session_active,
                "calibrating": self.calibrating,
                "noise_rms": round(self.noise_rms, 6),
                "noise_std": round(self.noise_std, 6),
                "noise_db": round(self.noise_db, 2),
                "rms_threshold": round(self.rms_threshold, 6),
                "db_threshold": round(self.db_threshold, 2),
                "last_rms": round(self.last_rms, 6),
                "last_peak_db": round(self.last_peak_db, 2),
                "last_peak_freq": round(self.last_peak_freq, 2),
                "last_prominence": round(self.last_prominence, 2),
                "last_signal": self.last_signal,
                "tone_lock_freq": round(self.tone_lock_freq, 2),
                "current_morse": self.current_morse,
                "last_chunk": self.last_chunk,
                "last_decoded": self.last_decoded,
                "text": self.text,
                "last_error": self.last_error,
            }

    def _run(self) -> None:
        try:
            with sd.InputStream(
                samplerate=self.cfg.sample_rate,
                channels=1,
                dtype="float32",
                blocksize=self.cfg.block_size,
                callback=self._audio_callback,
            ):
                while not self.stop_event.wait(0.05):
                    pass
        except Exception as exc:  # noqa: BLE001
            with self.lock:
                self.last_error = str(exc)
                self.running = False
            return
        with self.lock:
            self._finalize_pending_decode()
            self.running = False

    def _audio_callback(self, indata, frames, _time_info, status) -> None:
        if status:
            with self.lock:
                self.last_error = str(status)
        if self.stop_event.is_set():
            return

        samples = indata[:, 0].astype(np.float32)
        if samples.size == 0:
            return

        samples = samples - np.mean(samples)
        rms = float(np.sqrt(np.mean(samples * samples)))
        peak_db, peak_freq, prominence = self._spectral_features(samples)
        now = time.monotonic()

        with self.lock:
            self.last_rms = rms
            self.last_peak_db = peak_db
            self.last_peak_freq = peak_freq
            self.last_prominence = prominence

            if self.calibrating:
                self.calibration_rms.append(rms)
                self.calibration_db.append(peak_db)
                if now - self.calibration_started >= self.cfg.calibration_seconds:
                    self._finish_calibration()
                return

            lock_freq = self.tone_lock_freq if self.session_active else 0.0
            signal = self._is_signal(rms, peak_db, peak_freq, prominence, lock_freq)
            self.last_signal = signal

            if not self.session_active:
                self._try_arm_session(signal, peak_freq, now)
                return

            self._update_state_machine(signal, now)
            self._flush_silence(now)

    def _finish_calibration(self) -> None:
        if not self.calibration_rms:
            self.noise_rms = 0.002
            self.noise_std = 0.001
            self.noise_db = -90.0
        else:
            rms_arr = np.array(self.calibration_rms, dtype=np.float32)
            db_arr = np.array(self.calibration_db, dtype=np.float32)
            self.noise_rms = float(np.mean(rms_arr))
            self.noise_std = float(np.std(rms_arr))
            self.noise_db = float(np.mean(db_arr))

        self.rms_threshold = max(
            self.noise_rms + max(0.012, 3.2 * self.noise_std),
            0.018,
        )
        self.db_threshold = max(self.noise_db + 5.0, -50.0)
        self.calibrating = False

    def _is_signal(
        self,
        rms: float,
        peak_db: float,
        peak_freq: float,
        prominence: float,
        lock_freq: float = 0.0,
    ) -> bool:
        freq_ok = self.cfg.min_freq <= peak_freq <= self.cfg.max_freq
        if lock_freq > 0.0:
            freq_ok = freq_ok and abs(peak_freq - lock_freq) <= self.cfg.tone_lock_tolerance
        rms_ok = rms >= self.rms_threshold
        db_ok = peak_db >= self.db_threshold
        prom_ok = prominence >= self.cfg.min_prominence_db
        return freq_ok and rms_ok and db_ok and prom_ok

    def _try_arm_session(self, signal: bool, peak_freq: float, now: float) -> None:
        arm_freq_ok = self.cfg.arm_min_freq <= peak_freq <= self.cfg.arm_max_freq
        arm_rms_ok = self.last_rms >= (self.rms_threshold + self.cfg.arm_rms_boost)
        arm_prom_ok = self.last_prominence >= self.cfg.arm_min_prominence_db
        should_arm = signal and arm_freq_ok and arm_rms_ok and arm_prom_ok
        if should_arm:
            if self.arm_tone_started == 0.0:
                self.arm_tone_started = now
            if now - self.arm_tone_started >= self.cfg.arm_min_tone:
                self.session_active = True
                self.tone_lock_freq = peak_freq
                self.sound_on = True
                self.pending_sound = True
                self.pending_since = now
                # Start timing from the actual arm moment to avoid inflating first symbol duration.
                self.last_state_change = now
                self.last_symbol_time = now
                self.space_added = False
                self.current_morse = ""
        else:
            self.arm_tone_started = 0.0

    def _update_state_machine(self, signal: bool, now: float) -> None:
        if signal != self.pending_sound:
            self.pending_sound = signal
            self.pending_since = now

        if self.pending_sound == self.sound_on:
            return

        if now - self.pending_since < self.cfg.state_hold:
            return

        duration = now - self.last_state_change
        if self.sound_on:
            if self.cfg.min_tone <= duration <= self.cfg.max_tone:
                self.current_morse += "." if duration < self.cfg.dot_max else "-"
                self.last_symbol_time = now
                self.space_added = False
        else:
            silence = now - self.last_symbol_time if self.last_symbol_time else 0.0
            if self.current_morse and silence >= self.cfg.letter_gap:
                self._decode_current()
            if (
                self.text
                and not self.text.endswith(" ")
                and silence >= self.cfg.word_gap
                and not self.space_added
            ):
                self.text += " "
                self.space_added = True

        self.sound_on = self.pending_sound
        self.last_state_change = now

    def _flush_silence(self, now: float) -> None:
        if self.sound_on or not self.last_symbol_time:
            return

        silence = now - self.last_symbol_time
        if self.current_morse and silence >= self.cfg.letter_gap:
            self._decode_current()

        if (
            self.text
            and not self.text.endswith(" ")
            and silence >= self.cfg.word_gap
            and not self.space_added
        ):
            self.text += " "
            self.space_added = True

        if silence >= self.cfg.session_end_silence:
            self._finalize_pending_decode()
            self.session_active = False
            self.tone_lock_freq = 0.0
            self.sound_on = False
            self.pending_sound = False
            self.pending_since = 0.0
            self.last_state_change = now
            self.last_symbol_time = 0.0
            self.arm_tone_started = 0.0

    def _finalize_pending_decode(self) -> None:
        if self.current_morse:
            self._decode_current()

    def _decode_current(self) -> None:
        if not self.current_morse:
            return
        self.last_chunk = self.current_morse
        ch = MORSE_DICT.get(self.current_morse, "")
        if not ch:
            recovered = self._recover_letters(self.current_morse)
            if recovered:
                self.text += recovered
                self.space_added = False
                self.last_decoded = recovered
        self.current_morse = ""
        if ch:
            self.text += ch
            self.space_added = False
            self.last_decoded = ch

    def _recover_letters(self, morse: str) -> str:
        # Recover merged letters when the inter-letter gap was missed.
        # Prefer fewer letters, then prefer longer first chunks.
        memo: dict[int, list[str] | None] = {}

        def better(a: list[str], b: list[str]) -> bool:
            if len(a) != len(b):
                return len(a) < len(b)
            for ac, bc in zip(a, b):
                if len(ac) != len(bc):
                    return len(ac) > len(bc)
            return False

        def dfs(i: int) -> list[str] | None:
            if i == len(morse):
                return []
            if i in memo:
                return memo[i]
            best: list[str] | None = None
            for j in range(min(len(morse), i + 5), i, -1):
                code = morse[i:j]
                if code not in LETTER_MORSE:
                    continue
                rest = dfs(j)
                if rest is None:
                    continue
                cand = [code] + rest
                if best is None or better(cand, best):
                    best = cand
            memo[i] = best
            return best

        chunks = dfs(0)
        if not chunks:
            return ""
        return "".join(LETTER_MORSE[c] for c in chunks)

    def _spectral_features(self, samples: np.ndarray) -> tuple[float, float, float]:
        window = np.hanning(samples.size).astype(np.float32)
        spectrum = np.fft.rfft(samples * window)
        mag = np.abs(spectrum) + 1e-12
        db = 20.0 * np.log10(mag)
        freqs = np.fft.rfftfreq(samples.size, d=1.0 / self.cfg.sample_rate)

        lo = int(np.searchsorted(freqs, self.cfg.min_freq))
        hi = int(np.searchsorted(freqs, self.cfg.max_freq))
        if hi <= lo:
            return -100.0, 0.0, 0.0

        band = db[lo:hi]
        idx_local = int(np.argmax(band))
        idx = lo + idx_local
        peak_db = float(db[idx])
        peak_freq = float(freqs[idx])

        n0 = max(idx - 2, lo)
        n1 = min(idx + 2, hi - 1)
        neighbors = np.concatenate((db[n0:idx], db[idx + 1 : n1 + 1]))
        if neighbors.size == 0:
            prominence = 0.0
        else:
            prominence = float(peak_db - float(np.mean(neighbors)))

        return peak_db, peak_freq, prominence


audio_detector = AudioDetector()

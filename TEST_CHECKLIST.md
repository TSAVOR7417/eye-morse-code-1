# LuminaFusion Test Checklist

Run this checklist before pushing major changes.

## A) Setup
- Backend running at `http://127.0.0.1:5000`
- Frontend opened from Live Server
- Browser permissions allowed for camera + microphone

## B) Camera Mode
- Start camera detection
- Verify blink input changes text output
- Stop camera detection
- Confirm no backend crash

## C) Audio Mode Core
- Start audio detection
- Wait for calibration to complete
- `E` test x5 (expected: 5/5)
- `H` test x5
- `O` test x5
- `5` test x5

## D) Audio Multi-Letter
- `HI` test x20
  - Expected: near-perfect repeat decode
- `HELLO` test x10
  - Expected: mostly accurate (minor occasional mismatch acceptable)

## E) Silence / Noise Stability
- Keep 10 seconds silence
  - Expected: no random text generated
- Play random non-Morse sounds briefly
  - Expected: no heavy spam output

## F) UI + UX
- Start/Stop buttons work for both camera and audio
- Clear text buttons work
- No console errors in browser DevTools

## G) Backend Debug
- Open `http://127.0.0.1:5000/audio_debug`
- Confirm endpoint responds and updates when audio session runs

## H) Pre-Push Check
- `venv` is not tracked in git
- `__pycache__` is not tracked
- README still matches current run steps

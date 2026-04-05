import cv2
import mediapipe as mp
import numpy as np
import threading
import time

# ---------------- GLOBAL STATE ----------------

blink_start_time = None
eye_closed = False

current_morse = ""
last_blink_time = None
translated_text = ""
latest_frame = None
latest_ear = 0.0
camera_running = False
camera_thread = None
camera_lock = threading.Lock()

LETTER_PAUSE = 1.2
WORD_PAUSE = 2.5

CLOSE_THRESHOLD = 0.20
OPEN_THRESHOLD = 0.23

MORSE_DICT = {
    ".-": "A", "-...": "B", "-.-.": "C", "-..": "D",
    ".": "E", "..-.": "F", "--.": "G", "....": "H",
    "..": "I", ".---": "J", "-.-": "K", ".-..": "L",
    "--": "M", "-.": "N", "---": "O", ".--.": "P",
    "--.-": "Q", ".-.": "R", "...": "S", "-": "T",
    "..-": "U", "...-": "V", ".--": "W", "-..-": "X",
    "-.--": "Y", "--..": "Z",
    "-----": "0", ".----": "1", "..---": "2", "...--": "3", "....-": "4",
    ".....": "5", "-....": "6", "--...": "7", "---..": "8", "----.": "9"
}

# ---------------- MEDIAPIPE INIT ----------------

mp_face_mesh = mp.solutions.face_mesh
face_mesh = mp_face_mesh.FaceMesh(refine_landmarks=True)

LEFT_EYE = [33, 160, 158, 133, 153, 144]
RIGHT_EYE = [362, 385, 387, 263, 373, 380]


def calculate_EAR(eye_points, landmarks, frame_w, frame_h):
    points = []
    for point in eye_points:
        x = int(landmarks[point].x * frame_w)
        y = int(landmarks[point].y * frame_h)
        points.append((x, y))

    vertical1 = np.linalg.norm(np.array(points[1]) - np.array(points[5]))
    vertical2 = np.linalg.norm(np.array(points[2]) - np.array(points[4]))
    horizontal = np.linalg.norm(np.array(points[0]) - np.array(points[3]))

    if horizontal == 0:
        return 0.0

    return (vertical1 + vertical2) / (2.0 * horizontal)


def draw_overlay(frame, ear_value, morse_value):
    cv2.putText(
        frame,
        f"EAR: {ear_value:.3f}",
        (20, 40),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.9,
        (0, 255, 0),
        2,
        cv2.LINE_AA,
    )

    display_morse = morse_value if morse_value else ""
    cv2.putText(
        frame,
        f"Morse: {display_morse}",
        (20, frame.shape[0] - 20),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.9,
        (255, 255, 0),
        2,
        cv2.LINE_AA,
    )


# ---------------- CAMERA LOOP FUNCTION ----------------

def start_camera():
    global blink_start_time
    global eye_closed
    global current_morse
    global last_blink_time
    global translated_text
    global latest_frame
    global latest_ear
    global camera_running
    global camera_thread

    cap = cv2.VideoCapture(0)

    if not cap.isOpened():
        with camera_lock:
            camera_running = False
            camera_thread = None
        return

    while True:
        with camera_lock:
            if not camera_running:
                break

        success, frame = cap.read()
        if not success:
            continue

        frame = cv2.flip(frame, 1)
        current_ear = 0.0

        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = face_mesh.process(rgb_frame)

        if results.multi_face_landmarks:
            for face_landmarks in results.multi_face_landmarks:
                h, w, _ = frame.shape
                landmarks = face_landmarks.landmark

                left_ear = calculate_EAR(LEFT_EYE, landmarks, w, h)
                right_ear = calculate_EAR(RIGHT_EYE, landmarks, w, h)
                avg_ear = (left_ear + right_ear) / 2.0
                current_ear = avg_ear

                if avg_ear < CLOSE_THRESHOLD:
                    if not eye_closed:
                        eye_closed = True
                        blink_start_time = time.time()

                elif avg_ear > OPEN_THRESHOLD:
                    if eye_closed and blink_start_time is not None:
                        eye_closed = False
                        blink_duration = time.time() - blink_start_time

                        if blink_duration < 0.4:
                            current_morse += "."
                        else:
                            current_morse += "-"

                        last_blink_time = time.time()
                        blink_start_time = None

                break

        latest_ear = current_ear

        if last_blink_time is not None:
            pause_duration = time.time() - last_blink_time

            if pause_duration > LETTER_PAUSE and current_morse != "":
                if current_morse in MORSE_DICT:
                    translated_text += MORSE_DICT[current_morse]
                current_morse = ""
                last_blink_time = time.time()

            elif pause_duration > WORD_PAUSE:
                translated_text += " "
                last_blink_time = None

        draw_overlay(frame, latest_ear, current_morse)
        latest_frame = frame.copy()

    cap.release()

    with camera_lock:
        camera_running = False
        camera_thread = None


def start_camera_thread():
    global camera_running
    global camera_thread
    global latest_frame
    global latest_ear
    global current_morse

    with camera_lock:
        if camera_running and camera_thread is not None and camera_thread.is_alive():
            return True

        latest_frame = None
        latest_ear = 0.0
        current_morse = ""
        camera_running = True
        camera_thread = threading.Thread(target=start_camera, daemon=True)
        camera_thread.start()
        return True


def stop_camera():
    global camera_running
    global latest_frame
    global latest_ear
    global current_morse

    with camera_lock:
        camera_running = False
        latest_frame = None
        latest_ear = 0.0
        current_morse = ""


def is_camera_running():
    with camera_lock:
        return camera_running


# ---------------- API HELPER ----------------

def get_text():
    global translated_text
    return translated_text


def generate_frames():
    global latest_frame

    while True:
        if not is_camera_running():
            time.sleep(0.1)
            continue

        if latest_frame is None:
            time.sleep(0.05)
            continue

        ret, buffer = cv2.imencode('.jpg', latest_frame)
        if not ret:
            time.sleep(0.05)
            continue
        frame_bytes = buffer.tobytes()

        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')



from flask import Flask, jsonify, Response
from flask_cors import CORS
from blink import (
    generate_frames,
    get_text,
    is_camera_running,
    start_camera_thread,
    stop_camera,
)
from audio_detector import audio_detector

app = Flask(__name__)
CORS(app)


@app.route("/clear_text")
def clear_text():
    import blink
    blink.translated_text = ""
    return jsonify({"status": "cleared"})


@app.route("/video_feed")
def video_feed():
    return Response(generate_frames(),
                    mimetype='multipart/x-mixed-replace; boundary=frame')


@app.route("/start_camera")
def start_camera():
    start_camera_thread()
    return jsonify({"status": "started", "running": is_camera_running()})


@app.route("/stop_camera")
def stop_camera_route():
    stop_camera()
    return jsonify({"status": "stopped", "running": is_camera_running()})


@app.route("/get_text")
def fetch_text():
    return jsonify({"text": get_text()})


@app.route("/start_audio")
def start_audio():
    audio_detector.start()
    return jsonify({"status": "started", "running": audio_detector.is_running()})


@app.route("/stop_audio")
def stop_audio():
    audio_detector.stop()
    return jsonify({"status": "stopped", "running": audio_detector.is_running()})


@app.route("/get_audio_text")
def get_audio_text():
    return jsonify({"text": audio_detector.get_text()})


@app.route("/clear_audio_text")
def clear_audio_text():
    audio_detector.clear_text()
    return jsonify({"status": "cleared"})


@app.route("/audio_debug")
def audio_debug():
    return jsonify(audio_detector.get_debug())


if __name__ == "__main__":
    app.run(debug=False, use_reloader=False)

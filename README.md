# LuminaFusion - Eye + Audio Morse Code Translator

LuminaFusion translates Morse input into text using:
- Eye blink detection (camera mode)
- Tone/beep detection (audio mode)

## Project Structure
- `fronted/` - frontend UI (`index.html`, `script.js`, `style.css`)
- `morse-backend/` - Flask backend APIs for camera/audio detection

## Quick Start (Windows)

### 1) Run Backend
```powershell
cd D:\lumi2\morse-backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
python app.py
```

Backend URL:
- `http://127.0.0.1:5000`

### 2) Run Frontend
Open `D:\lumi2\fronted\index.html` with VS Code Live Server.

Typical frontend URL:
- `http://127.0.0.1:5500/fronted/index.html`

## Features
- Real-time camera detection pipeline
- Real-time backend audio decoding with debug endpoint
- Morse chart + practice section
- Text <-> Morse translation

## API Endpoints (Backend)
- `GET /start_camera`
- `GET /stop_camera`
- `GET /get_text`
- `GET /clear_text`
- `GET /video_feed`
- `GET /start_audio`
- `GET /stop_audio`
- `GET /get_audio_text`
- `GET /clear_audio_text`
- `GET /audio_debug`

## Manual Test Checklist
Use [TEST_CHECKLIST.md](./TEST_CHECKLIST.md) before each release.

Recommended audio sanity tests:
- `E` x5
- `HI` x20
- `HELLO` x10
- 10 seconds silence (should not type random letters)

## Troubleshooting
- If camera/mic is blocked:
  - Browser address bar -> site permissions -> allow camera and microphone.
- If backend not connected:
  - Confirm Flask is running on `127.0.0.1:5000`.
- If your friend gets import errors:
  - Ensure they create and activate `venv`, then run `pip install -r requirements.txt`.

## GitHub Notes
- `venv` and `__pycache__` are ignored via `.gitignore`.
- Do not commit local virtual environments.

## Credits
Built by Pruthveeraj / TSAVOR7417.

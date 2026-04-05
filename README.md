# LuminaFusion (Morse Project)

This project has:
- `morse-backend` (Flask backend: camera + audio detection APIs)
- `fronted` (frontend files)

## 1) Run Backend

Open PowerShell:

```powershell
cd D:\lumi2\morse-backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
python app.py
```

Backend will run at `http://127.0.0.1:5000`.

## 2) Run Frontend

Use VS Code Live Server (recommended) and open:
- `D:\lumi2\fronted\index.html`

If Live Server uses port `5500`, frontend URL will be:
- `http://127.0.0.1:5500/fronted/index.html`

## 3) Important Notes

- Do not upload `venv` to GitHub.
- `.gitignore` is already set to ignore `venv` and `__pycache__`.
- If microphone/camera does not work, allow permissions in browser site settings.


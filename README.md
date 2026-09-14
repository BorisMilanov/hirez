# Auth App

A React + TypeScript login/register client with a FastAPI + SQLite API.

## Run the API

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

## Run the client

```powershell
cd frontend
npm install
npm run dev
```

The client runs at `http://localhost:5173` and calls the API at `http://localhost:8000`.
Pravish dump i go prehvarlqsh ot drugata

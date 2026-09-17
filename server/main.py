"""
Privacy-Guardrail data-donation backend.

A single FastAPI app that does two jobs:
  1. Serves the built React frontend (the contents of ../dist).
  2. Accepts POST /submit and stores ONE JSON file per participant.

It is meant to run behind the existing Nginx reverse proxy on the LMU server,
listening on localhost:50000 via uvicorn (same as the current dummy app).

No database and no Node.js required on the server - build the frontend locally
with `npm run build` and upload the resulting `dist/` folder next to this file.

Environment variables (all optional):
  FRONTEND_DIST   path to the built frontend (default: ./dist next to this file)
  SUBMISSION_DIR  where participant JSONs are written
                  (default: ./data/submissions next to this file)
"""

import json
import re
import datetime
from pathlib import Path
import os

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, FileResponse

BASE_DIR = Path(__file__).resolve().parent
DIST_DIR = Path(os.environ.get("FRONTEND_DIST", BASE_DIR / "dist")).resolve()
DATA_DIR = Path(os.environ.get("SUBMISSION_DIR", BASE_DIR / "data" / "submissions")).resolve()
DATA_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="Privacy Guardrail", docs_url=None, redoc_url=None)
@app.middleware("http")
async def strip_pre_prefix(request, call_next):
    """App läuft hinter Nginx unter /pre. Optionalen /pre-Präfix normalisieren,
    damit die Routen immer /, /assets/... und /submit sehen."""
    path = request.scope.get("path", "")
    if path == "/pre":
        request.scope["path"] = "/"
    elif path.startswith("/pre/"):
        request.scope["path"] = path[4:]
    return await call_next(request)


def _now_iso() -> str:
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def _safe_id(value) -> str:
    """Make an id_one safe to use inside a filename."""
    cleaned = re.sub(r"[^A-Za-z0-9_-]", "_", str(value))
    return (cleaned or "unknown")[:64]


@app.get("/healthz")
async def healthz():
    """Simple liveness check (useful for `curl localhost:50000/healthz`)."""
    return {"status": "ok", "submissions_dir": str(DATA_DIR)}


@app.post("/submit")
async def submit(request: Request):
    """Receive a data donation (or a help/error report) and store it as a file."""
    try:
        payload = await request.json()
    except Exception:
        return JSONResponse(
            {"status": "error", "detail": "Request body was not valid JSON."},
            status_code=400,
        )

    id_one = payload.get("id_one") if isinstance(payload, dict) else None
    id_safe = _safe_id(id_one if id_one else "unknown")
    ts = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%S_%f")

    record = {
        "received_at": _now_iso(),
        "payload": payload,
    }

    filename = f"{id_safe}__{ts}.json"
    target = DATA_DIR / filename
    try:
        target.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding="utf-8")
    except OSError as exc:
        return JSONResponse(
            {"status": "error", "detail": f"Could not store submission: {exc}"},
            status_code=500,
        )

    return {"status": "ok", "stored_as": filename}


@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    """
    Serve static files from the built frontend. Any path that isn't a real file
    falls back to index.html so the single-page app (and its ?id_one=... query)
    works on every URL.
    """
    index = DIST_DIR / "index.html"

    if full_path:
        candidate = (DIST_DIR / full_path).resolve()
        # Path-traversal guard: candidate must stay inside DIST_DIR.
        if candidate.is_file() and (candidate == DIST_DIR or DIST_DIR in candidate.parents):
            return FileResponse(candidate)

    if index.is_file():
        return FileResponse(index)

    return JSONResponse(
        {"status": "error", "detail": "Frontend build not found. Did you upload dist/?"},
        status_code=500,
    )

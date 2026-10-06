"""FastAPI entrypoint for the Credit Scoring frontend.

Run:  uvicorn api.main:app --reload --port 8000
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from api import state
from api.routes import predict, settings, meta, sop

app = FastAPI(title="Credit Score Analyzer API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(predict.router)
app.include_router(settings.router)
app.include_router(meta.router)
app.include_router(sop.router)


@app.on_event("startup")
def startup():
    if state.artifacts_available():
        try:
            state.load_artifacts()
            print("Model artifacts loaded.")
        except Exception as e:
            print(f"Warning: could not load model artifacts: {e}")
    else:
        print("No trained model found. Train via the Settings page or 'python train.py'.")

    # Warm up Ollama so the first memo request doesn't pay the model load cost
    from api.settings_store import load_settings
    llm = load_settings()["llm"]
    if llm["enabled"]:
        import threading
        import json as _json
        import urllib.request as _req

        def warmup():
            try:
                payload = _json.dumps({
                    "model": llm["model"],
                    "prompt": "ok",
                    "stream": False,
                    "keep_alive": llm.get("keep_alive", "10m"),
                    "options": {"num_predict": 1},
                }).encode("utf-8")
                request = _req.Request(
                    llm["ollama_url"].rstrip("/") + "/api/generate",
                    data=payload,
                    headers={"Content-Type": "application/json"},
                )
                _req.urlopen(request, timeout=60).read()
                print(f"Ollama warm-up done ({llm['model']}).")
            except Exception as e:
                print(f"Ollama warm-up skipped: {e}")

        threading.Thread(target=warmup, daemon=True).start()


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "model_ready": state.artifacts_available(),
    }


# Serve the built React app (frontend/dist) if it exists
_dist = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend", "dist")
if os.path.isdir(_dist):
    app.mount("/", StaticFiles(directory=_dist, html=True), name="frontend")

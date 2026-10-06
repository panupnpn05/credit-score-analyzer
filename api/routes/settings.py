"""Settings routes."""

import json
import urllib.request
import urllib.error

from fastapi import APIRouter

from api.settings_store import load_settings, save_settings, deep_merge
from api.schemas import SettingsUpdate

router = APIRouter(prefix="/api", tags=["settings"])


@router.get("/settings")
def get_settings():
    return load_settings()


@router.put("/settings")
def put_settings(update: SettingsUpdate):
    current = load_settings()
    payload = update.model_dump(exclude_unset=True)  # only fields the client actually sent
    merged = save_settings(deep_merge(current, payload))  # partial section updates must not clobber siblings
    return merged


@router.get("/ollama/models")
def list_ollama_models():
    """List installed Ollama models; returns empty list when Ollama is unreachable."""
    settings = load_settings()["llm"]
    url = settings["ollama_url"].rstrip("/") + "/api/tags"
    try:
        with urllib.request.urlopen(url, timeout=5) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        return {"models": [m["name"] for m in data.get("models", [])], "error": None}
    except (urllib.error.URLError, TimeoutError, OSError) as e:
        return {"models": [], "error": str(e)}

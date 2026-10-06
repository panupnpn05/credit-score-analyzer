#!/usr/bin/env bash
# Credit Score Analyzer — one-command launcher.
# Usage: ./run.sh            (starts everything and opens the browser)
#        ./run.sh --build   (force-rebuild the frontend before starting)
set -euo pipefail

cd "$(dirname "$0")"
PORT=8000
URL="http://localhost:$PORT"
VENV=.venv
PY="$VENV/bin/python"

bold() { printf '\033[1m%s\033[0m\n' "$*"; }
info() { printf '  %s\n' "$*"; }

# ---------- 1. Python environment ----------
bold "▶ Checking Python environment…"
if [ ! -x "$PY" ]; then
  info "Creating virtual environment in $VENV …"
  python3 -m venv "$VENV"
fi
if ! "$PY" -c "import fastapi, xgboost, shap" 2>/dev/null; then
  info "Installing Python dependencies…"
  "$PY" -m pip install -q -r requirements.txt
fi
info "OK ($("$PY" --version | awk '{print $2}'))"

# ---------- 2. Frontend build ----------
bold "▶ Checking frontend build…"
if [ ! -d frontend/node_modules ]; then
  info "Installing npm dependencies…"
  (cd frontend && npm install --no-audit --no-fund)
fi
if [ "${1:-}" = "--build" ] || [ ! -d frontend/dist ]; then
  info "Building React app…"
  (cd frontend && npm run build)
fi
info "OK"

# ---------- 3. Trained model ----------
bold "▶ Checking model artifacts…"
if [ ! -f models/credit_model.joblib ]; then
  info "No trained model found — training now (one-time)…"
  "$PY" train.py
fi
info "OK"

# ---------- 4. Ollama (optional — app falls back to demo memos without it) ----------
bold "▶ Checking local LLM (optional)…"
MODEL="$("$PY" - <<'EOF' 2>/dev/null || true
import json
print(json.load(open("settings.json")).get("llm", {}).get("model", "qwen2.5:7b"))
EOF
)"
MODEL="${MODEL:-qwen2.5:7b}"
if command -v ollama >/dev/null 2>&1; then
  if ! curl -s -m 2 http://localhost:11434/api/tags >/dev/null 2>&1; then
    info "Starting Ollama…"
    (ollama serve >/dev/null 2>&1 &)
    sleep 3
  fi
  if curl -s -m 2 http://localhost:11434/api/tags >/dev/null 2>&1; then
    if ollama list 2>/dev/null | awk '{print $1}' | grep -qx "$MODEL"; then
      info "OK — Ollama up, model $MODEL installed."
    else
      info "Ollama up, but model '$MODEL' missing — pull it with: ollama pull $MODEL"
      info "(Until then, memos use cached demo texts.)"
    fi
  else
    info "Ollama installed but not responding — memos will use cached demo texts."
  fi
else
  info "Ollama not installed — memos will use cached demo texts (install: https://ollama.com)"
fi

# ---------- 5. Already running? Just open the browser ----------
if curl -s -m 2 "$URL/api/health" >/dev/null 2>&1; then
  bold "▶ App is already running at $URL — opening browser."
  open "$URL" 2>/dev/null || xdg-open "$URL" 2>/dev/null || true
  exit 0
fi

# ---------- 6. Start the server ----------
bold "▶ Starting server on $URL …"
"$PY" -m uvicorn api.main:app --port "$PORT" &
SERVER_PID=$!
trap 'kill $SERVER_PID 2>/dev/null; exit' INT TERM

for _ in $(seq 1 30); do
  if curl -s -m 2 "$URL/api/health" >/dev/null 2>&1; then break; fi
  sleep 1
done

if ! curl -s -m 2 "$URL/api/health" >/dev/null 2>&1; then
  echo "Server failed to start. Log:" >&2
  wait "$SERVER_PID"
  exit 1
fi

bold "✔ Ready — opening $URL (Ctrl+C to stop)"
open "$URL" 2>/dev/null || xdg-open "$URL" 2>/dev/null || true
wait "$SERVER_PID"

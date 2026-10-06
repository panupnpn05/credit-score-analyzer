# ---------- Stage 1: build the React frontend ----------
FROM node:20-slim AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# ---------- Stage 2: Python runtime ----------
FROM python:3.12-slim
WORKDIR /app

# System deps for lightgbm/xgboost-free stack + matplotlib fonts
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# App source (api/, config.py, data_loader.py, ...) + trained model + data + demo cache
COPY config.py data_loader.py features.py model.py explainer.py train.py predict.py ./
COPY api/ ./api/
COPY models/ ./models/
COPY data/ ./data/
COPY docs/ ./docs/
COPY demo_cache/ ./demo_cache/
COPY --from=frontend /app/frontend/dist ./frontend/dist

ENV HOST=0.0.0.0 PORT=8000 \
    OLLAMA_URL=http://localhost:11434 \
    OLLAMA_MODEL=qwen2.5:7b

EXPOSE 8000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s \
  CMD curl -fsS http://localhost:8000/api/health || exit 1

CMD ["sh", "-c", "uvicorn api.main:app --host ${HOST} --port ${PORT}"]

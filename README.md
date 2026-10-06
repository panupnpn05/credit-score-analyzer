# AI Credit Scoring System

A local, production-ready credit risk scoring pipeline that predicts loan default probability, explains predictions with SHAP, and generates human-readable credit memos via a local LLM (Ollama or vLLM).

**Stack:** XGBoost · SHAP · scikit-learn · Ollama/vLLM (optional)

## Architecture

```
Applicant Data (CSV / XLSX)
       |
       v
[Feature Engineering] ---> [XGBoost Model] ---> Default Probability + Risk Grade (A-E)
       |                                        |
       v                                        v
[Preprocessor]                          [SHAP Explainer]
                                              |
                                              v
                                       [LLM Prompt Generator]
                                              |
                                              v
                                       Local LLM (Ollama / vLLM)
                                              |
                                              v
                                       Human-readable credit memo
```

## Project Structure

```
creditscoring/
├── config.py            # Paths, XGBoost hyperparameters, risk grades, target column
├── data_loader.py       # Load training data from CSV/XLSX (German Credit fallback)
├── features.py          # Preprocessing pipeline (imputation, scaling, one-hot)
├── model.py             # XGBoost training + credit-risk metrics + plots
├── explainer.py         # SHAP explanations + LLM prompt generator
├── train.py             # Main training script
├── predict.py           # Inference (demo / batch file scoring)
├── api/                 # FastAPI backend (predict, batch, settings, retrain)
│   └── main.py          # Run: uvicorn api.main:app
├── frontend/            # React (Vite) web UI
├── requirements.txt
├── data/                # Training data goes here
│   └── credit_data_template.csv   # Example format (auto-generated)
├── models/              # Saved artifacts
│   ├── credit_model.joblib
│   ├── preprocessor.joblib
│   └── metrics.json
└── output/              # Evaluation plots, SHAP summary, scoring results
```

## Quickstart (interview demo)

**Easiest — one command** (creates the venv, builds the frontend, trains if needed, starts Ollama if installed, launches the browser):

```bash
./run.sh            # macOS / Linux
run.bat             # Windows
./run.sh --build    # force-rebuild the frontend
```

**Docker — everything incl. the local LLM** (first run pulls ~4.7 GB model):

```bash
docker compose up --build
# open http://localhost:8000
```

**Manual** (Ollama optional — the app falls back to cached demo memos):

```bash
python -m pip install -r requirements.txt
cd frontend && npm install && npm run build && cd ..
python -m uvicorn api.main:app --port 8000
# open http://localhost:8000
```

Pre-made demo portfolios for the **Batch** page: `demo_data/stable_portfolio.csv` (no drift) and `demo_data/drifted_portfolio.csv` (triggers the drift alert).

## Setup

```powershell
cd D:\creditscoring
py -3 -m pip install -r requirements.txt
```

> Note: this project uses `py -3` because `python` is not on PATH. Use `python` instead if it works on your machine.

## Usage

### 1. Prepare training data (optional)

The repo currently ships with **Give Me Some Credit** (Kaggle, 150,000 rows, US borrowers) at `data\credit_data.csv` — the model trains on it out of the box (test AUC ≈ 0.86).

To use your own dataset, place it at `data\credit_data.csv` (or `.xlsx`). Requirements:

- A target column named **`default`**: `1` = defaulted, `0` = paid
- If your target column has a different name, set `TARGET_COLUMN` in `config.py`
- See `data\credit_data_template.csv` for the expected format

If no file is present, the pipeline falls back to the built-in **German Credit** dataset (1,000 rows).

### 2. Train the model

```powershell
py -3 train.py
```

This will:
1. Load data and split 60/20/20 (train/validation/test, stratified)
2. Fit and save the preprocessor (`models\preprocessor.joblib`)
3. Train XGBoost with early stopping (`models\credit_model.joblib`)
4. Print credit-risk metrics (AUC, Gini, KS, F1) and save plots to `output\`
5. Generate a SHAP summary plot (`output\shap_summary.png`)

Metric targets: **AUC > 0.70 · Gini > 0.40 · KS > 0.30 · F1 > 0.50**

### 3. Score a demo applicant

```powershell
py -3 predict.py --demo
```

Outputs default probability, risk grade (A–E), top SHAP risk/protective factors, and a ready-to-paste LLM prompt. Saved to `output\demo_result.json`.

### 4. Score applicants from a file

```powershell
py -3 predict.py --file data\applicants.xlsx
```

File must have the same feature columns as the training data (no `default` column needed). An optional `applicant_id` column will be used as the identifier. Results saved to `output\scoring_results.json`.

### 5. Generate credit memos with a local LLM (optional)

```powershell
# Install Ollama from https://ollama.com/download, then:
ollama pull qwen2.5:7b
ollama run qwen2.5:7b
# Paste the prompt printed by predict.py
```

Or call the Ollama API programmatically (`http://localhost:11434/api/generate`). For corporate deployment with concurrent users, the same integration works against a **vLLM** server (OpenAI-compatible endpoint).

### 6. Manual scoring SOP (points-based guideline)

[docs/SCORING_SOP.md](docs/SCORING_SOP.md) is a human-usable Standard Operating Procedure: start from a base score of 100, add/deduct points per applicant attribute, and map the total to a grade and loan decision. You define the point values; Appendix A shows how the XGBoost model weighs each attribute as a reference. Verify manual scores against the model with:

```powershell
py -3 scripts/verify_sop.py --demo
```

The web app has a dedicated **SOP page** for editing these tables, with a built-in "Test Applicant" verifier. When **Settings → "Include SOP guideline in memo prompt"** is on (default), the Predict page also shows the manual SOP score next to the model result, and the SOP rules + the applicant's point breakdown are appended to the LLM memo prompt — the LLM uses the SOP as its judging guideline when writing the credit memo.

## Configuration

All tunables live in `config.py`:

| Setting | Purpose |
|---|---|
| `TRAIN_DATA_FILE` | Path to your CSV/XLSX training data |
| `TARGET_COLUMN` | Name of the default flag column |
| `MODEL_PARAMS` | XGBoost hyperparameters (learning rate, depth, early stopping, class weight) |
| `SCORE_BINS` / `SCORE_LABELS` | Probability thresholds mapping to risk grades A–E |

After changing anything, retrain with `py -3 train.py`.

## Web Frontend (React + FastAPI)

A web UI for entering applicant data, predicting risk with a mockup approve / non-approve decision, batch scoring, an SOP editor (edit the manual points guideline in `docs/SCORING_SOP.md` and verify applicants against the model), and a settings page (prompt template, Ollama model, decision thresholds, XGBoost fine-tune + retrain).

### Run the backend

```powershell
py -3 -m pip install fastapi uvicorn python-multipart
py -3 -m uvicorn api.main:app --port 8000
```

### Run the frontend (development)

```powershell
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 (Vite proxies `/api` to the backend).

### Production mode

```powershell
cd frontend
npm run build
py -3 -m uvicorn api.main:app --port 8000
```

The backend serves the built app from `frontend/dist` at http://localhost:8000.

### Pages

| Page | What it does |
|---|---|
| **Predict** | Auto-generated applicant form (from training data schema) → probability gauge, risk grade (A–E), mockup APPROVE / MANUAL REVIEW / NON-APPROVE banner, SHAP factor bars, and one-click Ollama credit memo (with copyable LLM prompt fallback) |
| **What-If Simulator** (on Predict) | Counterfactual re-scoring: edit top risk factors → instant re-prediction, plus the *minimal single-feature change* that would improve the applicant's grade (candidate targets drawn from the training distribution). Deterministic — no LLM involved |
| **Memo verification** (on Predict) | After a memo streams in, a second LLM pass audits every factual claim against the structured evidence (SHAP values, probability, SOP result) and shows a "N/M claims grounded" badge — a faithfulness guardrail against hallucination |
| **Batch** | Upload CSV/XLSX with many applicants, get a scored table with decisions — plus **PSI drift monitoring** vs. the training distribution per feature (stable / warning / drift) with a one-click retrain shortcut |
| **SOP** | Edit the manual points guideline (`docs/SCORING_SOP.md`) and verify applicants against the model |
| **Settings** | Approve/decline probability thresholds, Ollama URL + model dropdown (auto-lists installed models), prompt template editor with placeholders, XGBoost hyperparameters, current model metrics, and **Save & Retrain** with live status |

The UI is bilingual — switch between English and Thai from the toggle in the header (choice is remembered in the browser).

Settings persist to `settings.json` in the project root. `OLLAMA_URL` / `OLLAMA_MODEL` environment variables override the stored LLM connection (used by Docker Compose).

## Demo mode (graceful degradation)

If Ollama is unreachable, memo generation falls back to cached memos in `demo_cache/memos.json` — the UI streams them identically and shows a "demo memo" badge. Regenerate the cache with:

```bash
python scripts/make_demo_cache.py   # requires the API running with a reachable Ollama
```

## Retraining

Every run of `train.py` overwrites the model, preprocessor, metrics, and plots. Safe to rerun anytime — e.g., after swapping in a bigger dataset or tuning hyperparameters. Retraining is also available from the Settings page in the web UI.

---

*For educational/side-project use only. Not financial advice. Do not use for real lending decisions without regulatory review.*
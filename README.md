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
├── requirements.txt
├── data/                # Training data goes here
│   └── credit_data_template.csv   # Example format (auto-generated)
├── models/              # Saved artifacts
│   ├── credit_model.joblib
│   ├── preprocessor.joblib
│   └── metrics.json
└── output/              # Evaluation plots, SHAP summary, scoring results
```

## Setup

```powershell
cd D:\creditscoring
py -3 -m pip install -r requirements.txt
```

> Note: this project uses `py -3` because `python` is not on PATH. Use `python` instead if it works on your machine.

## Usage

### 1. Prepare training data (optional)

Place your dataset at `data\credit_data.csv` (or `.xlsx`). Requirements:

- A target column named **`default`**: `1` = defaulted, `0` = paid
- If your target column has a different name, set `TARGET_COLUMN` in `config.py`
- See `data\credit_data_template.csv` for the expected format

If no file is present, the pipeline falls back to the built-in **German Credit** dataset (1,000 rows) — good for a first test run.

Free datasets you can use:
- **Give Me Some Credit** (Kaggle, 150k rows, CSV) — target: `SeriousDlqin2yrs`
- **Taiwan Credit Card Default** (UCI, 30k rows, XLSX) — target: `default payment next month`
- **Home Credit Default Risk** (Kaggle, 300k rows) — target: `TARGET`
- **Lending Club** (Kaggle, 2.2M rows) — map `loan_status` to default flag

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

## Configuration

All tunables live in `config.py`:

| Setting | Purpose |
|---|---|
| `TRAIN_DATA_FILE` | Path to your CSV/XLSX training data |
| `TARGET_COLUMN` | Name of the default flag column |
| `MODEL_PARAMS` | XGBoost hyperparameters (learning rate, depth, early stopping, class weight) |
| `SCORE_BINS` / `SCORE_LABELS` | Probability thresholds mapping to risk grades A–E |

After changing anything, retrain with `py -3 train.py`.

## Retraining

Every run of `train.py` overwrites the model, preprocessor, metrics, and plots. Safe to rerun anytime — e.g., after swapping in a bigger dataset or tuning hyperparameters.

---

*For educational/side-project use only. Not financial advice. Do not use for real lending decisions without regulatory review.*
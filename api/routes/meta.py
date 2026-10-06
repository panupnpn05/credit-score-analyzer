"""Meta routes: form schema, model metrics, retraining."""

import json
import os
import threading
import traceback

import matplotlib

matplotlib.use("Agg")

import matplotlib.pyplot as plt
import shap
from fastapi import APIRouter, HTTPException

import config
from data_loader import load_training_data, get_feature_target, split_data
from features import prepare_pipeline, transform_data
from model import train_model, evaluate_model, save_model
from explainer import build_explainer
from api import state
from api.settings_store import load_settings

router = APIRouter(prefix="/api", tags=["meta"])


@router.get("/schema")
def get_schema():
    """Feature names, types and categorical options to build the applicant form."""
    try:
        df = load_training_data()
    except Exception as e:
        raise HTTPException(500, f"Could not load training data for schema: {e}")

    df = df.drop(columns=[config.TARGET_COLUMN], errors="ignore")
    numeric_cols = df.select_dtypes(include="number").columns.tolist()
    categorical_cols = df.select_dtypes(include=["object", "category"]).columns.tolist()

    fields = []
    for col in numeric_cols:
        fields.append({
            "name": col,
            "type": "number",
            "min": float(df[col].min()) if len(df[col]) else None,
            "max": float(df[col].max()) if len(df[col]) else None,
            "mean": float(df[col].mean()) if len(df[col]) else None,
        })
    for col in categorical_cols:
        fields.append({
            "name": col,
            "type": "category",
            "options": sorted([str(v) for v in df[col].dropna().unique().tolist()]),
        })

    return {
        "target_column": config.TARGET_COLUMN,
        "fields": fields,
        "model_ready": state.artifacts_available(),
    }


@router.get("/metrics")
def get_metrics():
    path = os.path.join(config.MODEL_DIR, "metrics.json")
    if not os.path.exists(path):
        raise HTTPException(404, "No metrics found. Train the model first.")
    with open(path) as f:
        return json.load(f)


def _run_retrain():
    try:
        state.set_retrain_status(running=True, message="Loading data...", error=None, finished_at=None)

        settings = load_settings()
        params = {
            "objective": "binary:logistic",
            "eval_metric": ["auc", "logloss"],
            "random_state": config.RANDOM_STATE,
            "n_jobs": -1,
            **settings["xgboost"],
        }

        df = load_training_data()
        state.set_retrain_status(message="Splitting data...")
        X, y = get_feature_target(df)
        X_train, X_val, X_test, y_train, y_val, y_test = split_data(X, y)

        state.set_retrain_status(message="Fitting preprocessor...")
        preprocessor_path = os.path.join(config.MODEL_DIR, "preprocessor.joblib")
        preprocessor, feature_names = prepare_pipeline(X_train, save_path=preprocessor_path)

        X_train_t = transform_data(preprocessor, X_train)
        X_val_t = transform_data(preprocessor, X_val)
        X_test_t = transform_data(preprocessor, X_test)

        state.set_retrain_status(message="Training XGBoost...")
        model = train_model(X_train_t, y_train, X_val_t, y_val, feature_names, params=params)

        state.set_retrain_status(message="Evaluating...")
        metrics_val = evaluate_model(model, X_val_t, y_val, "Validation", config.OUTPUT_DIR)
        metrics_test = evaluate_model(model, X_test_t, y_test, "Test", config.OUTPUT_DIR)

        save_model(model, os.path.join(config.MODEL_DIR, "credit_model.joblib"))
        with open(os.path.join(config.MODEL_DIR, "metrics.json"), "w") as f:
            json.dump({"validation": metrics_val, "test": metrics_test, "features": len(feature_names)}, f, indent=2)

        # SHAP summary plot
        explainer = build_explainer(model, X_train_t[:100])
        X_sample = X_test_t[:200]
        shap_values = explainer.shap_values(X_sample)
        if isinstance(shap_values, list):
            shap_values = shap_values[1]
        plt.figure(figsize=(10, 8))
        shap.summary_plot(shap_values, X_sample, feature_names=feature_names, show=False, max_display=15)
        plt.tight_layout()
        plt.savefig(os.path.join(config.OUTPUT_DIR, "shap_summary.png"), dpi=150, bbox_inches="tight")
        plt.close()

        state.load_artifacts()  # reload newly trained model
        state.set_retrain_status(
            running=False,
            message=f"Retraining complete. Test AUC: {metrics_test['auc']:.4f}",
            error=None,
            finished_at="done",
        )
    except Exception:
        state.set_retrain_status(running=False, message="Retraining failed.", error=traceback.format_exc())


@router.post("/retrain")
def retrain():
    status = state.get_retrain_status()
    if status["running"]:
        raise HTTPException(409, "Retraining is already in progress.")
    thread = threading.Thread(target=_run_retrain, daemon=True)
    thread.start()
    return {"started": True}


@router.get("/retrain/status")
def retrain_status():
    return state.get_retrain_status()

"""Shared runtime state: loaded model artifacts."""

import os
import threading

import joblib

import config

_lock = threading.Lock()

_state = {
    "model": None,
    "preprocessor": None,
    "feature_names": None,
    "retrain_status": {"running": False, "message": "", "error": None, "finished_at": None},
    "drift_report": None,
}


def load_artifacts():
    """Load trained model and preprocessor from disk into memory."""
    model_path = os.path.join(config.MODEL_DIR, "credit_model.joblib")
    preprocessor_path = os.path.join(config.MODEL_DIR, "preprocessor.joblib")

    if not os.path.exists(model_path):
        raise FileNotFoundError(
            "Model not found. Run 'python train.py' (or retrain from the Settings page) first."
        )

    artifacts = joblib.load(preprocessor_path)
    with _lock:
        _state["model"] = joblib.load(model_path)
        _state["preprocessor"] = artifacts["preprocessor"]
        _state["feature_names"] = artifacts["feature_names"]
    return get_artifacts()


def get_artifacts():
    with _lock:
        if _state["model"] is None:
            raise RuntimeError("Artifacts not loaded yet.")
        return _state["model"], _state["preprocessor"], _state["feature_names"]


def artifacts_available():
    return os.path.exists(os.path.join(config.MODEL_DIR, "credit_model.joblib"))


def get_retrain_status():
    with _lock:
        return dict(_state["retrain_status"])


def set_retrain_status(**kwargs):
    with _lock:
        _state["retrain_status"].update(kwargs)


def get_drift_report():
    with _lock:
        return _state["drift_report"]


def set_drift_report(report):
    with _lock:
        _state["drift_report"] = report

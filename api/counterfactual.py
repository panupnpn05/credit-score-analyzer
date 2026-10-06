"""Counterfactual what-if scoring.

Re-predicts an applicant with modified feature values and searches the training
distribution for the smallest single-feature change that would improve the risk
grade. Pure re-prediction — no LLM involved, so it is fast and deterministic.
"""

import threading

import numpy as np
import pandas as pd

import config
from api import state
from explainer import build_explainer, explain_instance, probability_to_grade

_lock = threading.Lock()
_train_ref = None


def _training_ref():
    """Cached per-feature percentile reference from the training data."""
    global _train_ref
    with _lock:
        if _train_ref is None:
            from data_loader import load_training_data
            df = load_training_data().drop(columns=[config.TARGET_COLUMN], errors="ignore")
            numeric = df.select_dtypes(include="number")
            _train_ref = {
                col: np.nanpercentile(numeric[col].astype(float), [10, 25, 50]).tolist()
                for col in numeric.columns
            }
        return _train_ref


def _predict_prob(applicant: dict, model, preprocessor) -> float:
    df = pd.DataFrame([applicant])
    df = df.drop(columns=[config.TARGET_COLUMN], errors="ignore")
    X = preprocessor.transform(df)
    return float(model.predict_proba(X)[0, 1])


def grade_index(grade):
    try:
        return config.SCORE_LABELS.index(grade)
    except ValueError:
        return len(config.SCORE_LABELS) - 1


def what_if(applicant: dict, modifications: dict | None):
    """Score the base applicant and, optionally, a modified scenario.

    Always returns single-feature counterfactual suggestions derived from the
    top SHAP risk factors — candidate target values come from the training
    distribution (10th/25th/50th percentiles), so suggestions are realistic.
    """
    model, preprocessor, feature_names = state.get_artifacts()

    base_prob = _predict_prob(applicant, model, preprocessor)
    base_grade = probability_to_grade(base_prob)
    base_idx = grade_index(base_grade)

    scenario = None
    if modifications:
        # Only known applicant features are applied — sklearn would otherwise
        # silently drop unknown columns and report a misleading "no change".
        ignored = [k for k in modifications if k not in applicant]
        known = {k: v for k, v in modifications.items() if k in applicant}
        modified = {**applicant, **known}
        try:
            mod_prob = _predict_prob(modified, model, preprocessor)
            mod_grade = probability_to_grade(mod_prob)
            scenario = {
                "modifications": known,
                "ignored_fields": ignored,
                "default_probability": mod_prob,
                "risk_grade": mod_grade,
                "delta_probability": mod_prob - base_prob,
                "grade_improved": grade_index(mod_grade) < base_idx,
            }
        except Exception as e:
            scenario = {"error": str(e)}

    # SHAP on the base applicant to find which levers matter most
    df = pd.DataFrame([applicant]).drop(columns=[config.TARGET_COLUMN], errors="ignore")
    X = preprocessor.transform(df)
    explainer = build_explainer(model, X)
    explanation = explain_instance(explainer, X[0], feature_names, top_n=5)

    ref = _training_ref()
    suggestions = []
    for c in explanation["top_contributions"]:
        if c["shap_value"] <= 0:
            continue  # only risk-raising levers are interesting to lower
        field = c["feature"]
        current = applicant.get(field)
        if field not in ref or current is None:
            continue
        try:
            current = float(current)
        except (TypeError, ValueError):
            continue
        for target in ref[field]:
            target = float(target)
            if target >= current:
                continue  # must be an improvement direction
            trial = {**applicant, field: target}
            try:
                prob = _predict_prob(trial, model, preprocessor)
            except Exception:
                continue
            grade = probability_to_grade(prob)
            suggestions.append({
                "field": field,
                "from": current,
                "to": target,
                "new_probability": prob,
                "delta_probability": prob - base_prob,
                "new_grade": grade,
                "grade_improved": grade_index(grade) < base_idx,
            })

    suggestions.sort(key=lambda s: s["delta_probability"])
    upgrade = next((s for s in suggestions if s["grade_improved"]), None)

    return {
        "base": {
            "default_probability": base_prob,
            "risk_grade": base_grade,
        },
        "scenario": scenario,
        "suggestions": suggestions[:8],
        "minimal_upgrade": upgrade,
    }

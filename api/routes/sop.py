"""SOP routes: read, edit, and verify the manual points-based scoring guideline.

The points tables in docs/SCORING_SOP.md are the single source of truth.
PUT rewrites only the table rows inside the '## Points Tables' section; the
rest of the markdown (worked example, appendices) is preserved.
"""

import pandas as pd
from fastapi import APIRouter, HTTPException

import api.state as state
from api.schemas import SopUpdate, SopVerifyRequest
from api.settings_store import load_settings
from api.sop_store import (
    load_sop,
    save_sop,
    score_manual,
    manual_grade,
    manual_decision,
)
from explainer import probability_to_grade

router = APIRouter(prefix="/api", tags=["sop"])


@router.get("/sop")
def get_sop():
    try:
        return load_sop()
    except (ValueError, OSError) as e:
        raise HTTPException(500, f"Could not read SOP: {e}")


@router.put("/sop")
def put_sop(update: SopUpdate):
    try:
        return save_sop(update.model_dump())
    except ValueError as e:
        raise HTTPException(400, str(e))
    except OSError as e:
        raise HTTPException(500, f"Could not save SOP: {e}")


@router.post("/sop/verify")
def verify_sop(req: SopVerifyRequest):
    try:
        sop = load_sop()
    except (ValueError, OSError) as e:
        raise HTTPException(500, f"Could not read SOP: {e}")

    applicant = dict(req.applicant)
    total, details, warnings = score_manual(applicant, sop)
    grade = manual_grade(total, sop)

    manual = {
        "base_score": sop["base_score"],
        "total": total,
        "grade": grade,
        "decision": manual_decision(grade, sop),
        "details": [
            {"field": f, "value": v, "points": p, "note": n}
            for f, v, p, n in details
        ],
        "warnings": warnings,
    }

    model = {"error": "Model not available"}
    try:
        model_obj, preprocessor, _ = state.get_artifacts()
        df = pd.DataFrame([applicant]).drop(columns=["applicant_id", "default"], errors="ignore")
        X = preprocessor.transform(df)
        prob = float(model_obj.predict_proba(X)[0, 1])
        grade_m = probability_to_grade(prob)
        th = load_settings()["decision"]
        if prob < th["approve_threshold"]:
            decision_m = "APPROVE"
        elif prob > th["decline_threshold"]:
            decision_m = "NON-APPROVE"
        else:
            decision_m = "MANUAL_REVIEW"
        model = {
            "default_probability": prob,
            "grade": grade_m,
            "decision": decision_m,
            "thresholds": th,
        }
    except Exception as e:
        model = {"error": str(e)}

    return {"manual": manual, "model": model}

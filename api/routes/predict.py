"""Prediction + LLM memo routes."""

import io
import json
import os
import threading
import urllib.request
import urllib.error

import pandas as pd
from fastapi import APIRouter, HTTPException, UploadFile
from fastapi.responses import StreamingResponse

import config
from explainer import build_explainer, explain_instance, probability_to_grade
from api import state
from api.settings_store import load_settings
from api.schemas import PredictRequest, MemoRequest, WhatIfRequest, MemoVerifyRequest
from api.verifier import Verifier, build_evidence_text
from api.counterfactual import what_if

router = APIRouter(prefix="/api", tags=["predict"])

verifier = Verifier()

# Demo-mode fallback: cached memos served when Ollama is unreachable
_demo_cache_lock = threading.Lock()
_demo_cache = None
_demo_cache_idx = 0


def _load_demo_cache():
    global _demo_cache
    if _demo_cache is None:
        path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "demo_cache", "memos.json")
        try:
            with open(path) as f:
                _demo_cache = json.load(f).get("memos", [])
        except (OSError, json.JSONDecodeError):
            _demo_cache = []
    return _demo_cache


def _next_demo_memo():
    global _demo_cache_idx
    memos = _load_demo_cache()
    if not memos:
        return None
    with _demo_cache_lock:
        memo = memos[_demo_cache_idx % len(memos)]
        _demo_cache_idx += 1
    return memo


def _decision(prob, thresholds):
    """Mockup loan decision based on probability thresholds."""
    if prob < thresholds["approve_threshold"]:
        return "APPROVE"
    if prob > thresholds["decline_threshold"]:
        return "NON-APPROVE"
    return "MANUAL_REVIEW"


def _format_prompt(template, applicant_id, prob, grade, explanation, summary):
    def fmt_factors(factors):
        if not factors:
            return "  - None significant"
        return "\n".join(
            f"  - {c['feature']}: {c['value']:.4f} ({c['impact']})" for c in factors
        )

    summary_text = "\nApplicant Summary:\n" + "\n".join(
        f"  {k}: {v}" for k, v in summary.items()
    ) if summary else ""

    return template.format(
        applicant_id=applicant_id,
        probability=f"{prob:.2%}",
        grade=grade,
        applicant_summary=summary_text,
        risk_factors=fmt_factors(explanation["risk_factors"]),
        protective_factors=fmt_factors(explanation["protective_factors"]),
    )


def _score(applicant: dict, applicant_id: str):
    model, preprocessor, feature_names = state.get_artifacts()

    applicant_df = pd.DataFrame([applicant])
    if config.TARGET_COLUMN in applicant_df.columns:
        applicant_df = applicant_df.drop(columns=[config.TARGET_COLUMN])

    X = preprocessor.transform(applicant_df)
    default_prob = float(model.predict_proba(X)[0, 1])
    risk_grade = probability_to_grade(default_prob)

    explainer = build_explainer(model, X)
    explanation = explain_instance(explainer, X[0], feature_names, top_n=8)

    summary = {col: applicant_df[col].iloc[0] for col in applicant_df.columns}

    settings = load_settings()
    prompt = _format_prompt(
        settings["llm"]["prompt_template"],
        applicant_id, default_prob, risk_grade, explanation, summary,
    )

    # Inject the manual scoring SOP as the LLM's judging guideline
    sop_block = None
    if settings["llm"].get("include_sop", True):
        try:
            from api.sop_guidance import build_sop_guidance
            sop_block = build_sop_guidance(applicant)
            prompt = prompt + "\n\n---\n\n" + sop_block["text"]
        except Exception:
            sop_block = None  # SOP unreadable — memo still works without it

    return {
        "applicant_id": applicant_id,
        "default_probability": default_prob,
        "risk_grade": risk_grade,
        "decision": _decision(default_prob, settings["decision"]),
        "risk_factors": explanation["risk_factors"],
        "protective_factors": explanation["protective_factors"],
        "sop": {
            "score": sop_block["score"],
            "grade": sop_block["grade"],
            "decision": sop_block["decision"],
            "breakdown": sop_block["breakdown"],
            "warnings": sop_block["warnings"],
        } if sop_block else None,
        "llm_prompt": prompt,
        "llm_enabled": settings["llm"]["enabled"],
        "ollama_model": settings["llm"]["model"],
    }


def _ollama_payload(settings, prompt, stream):
    return json.dumps({
        "model": settings["model"],
        "prompt": prompt,
        "stream": stream,
        "keep_alive": settings.get("keep_alive", "10m"),
        "options": {
            "num_predict": settings.get("num_predict", 350),
            "temperature": settings.get("temperature", 0.3),
        },
    }).encode("utf-8")


def _call_ollama(settings, prompt):
    req = urllib.request.Request(
        settings["ollama_url"].rstrip("/") + "/api/generate",
        data=_ollama_payload(settings, prompt, stream=False),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    return data.get("response", ""), data.get("done_reason")


def _stream_demo_memo(memo_text):
    """Serve a cached memo as a fake token stream when Ollama is down."""
    tokens = memo_text.split(" ")
    step = 3
    for i in range(0, len(tokens), step):
        chunk = " ".join(tokens[i:i + step])
        yield f"data: {json.dumps({'token': chunk + ' '})}\n\n"
    yield f"data: {json.dumps({'done': True, 'finish_reason': 'demo', 'demo_fallback': True})}\n\n"


def _stream_ollama(settings, prompt):
    """Yield SSE events from Ollama's streaming generate endpoint."""
    req = urllib.request.Request(
        settings["ollama_url"].rstrip("/") + "/api/generate",
        data=_ollama_payload(settings, prompt, stream=True),
        headers={"Content-Type": "application/json"},
    )
    try:
        resp = urllib.request.urlopen(req, timeout=120)
    except (urllib.error.URLError, TimeoutError, OSError) as e:
        memo = _next_demo_memo()
        if memo:
            yield f"data: {json.dumps({'demo_notice': True})}\n\n"
            yield from _stream_demo_memo(memo)
            return
        err = f"Could not reach Ollama ({settings['ollama_url']}): {e}"
        yield f"data: {json.dumps({'error': err})}\n\n"
        return
    try:
        finish_reason = None
        with resp:
            for line in resp:
                line = line.strip()
                if not line:
                    continue
                chunk = json.loads(line.decode("utf-8"))
                token = chunk.get("response", "")
                if token:
                    yield f"data: {json.dumps({'token': token})}\n\n"
                if chunk.get("done"):
                    finish_reason = chunk.get("done_reason")
                    break
        yield f"data: {json.dumps({'done': True, 'finish_reason': finish_reason})}\n\n"
    except (urllib.error.URLError, TimeoutError, OSError) as e:
        err = f"Ollama stream failed: {e}"
        yield f"data: {json.dumps({'error': err})}\n\n"


def _resolve_prompt(req: MemoRequest):
    """Reuse a prompt from the predict step when provided, else re-score."""
    if req.llm_prompt:
        return req.llm_prompt
    result = _score(req.applicant, req.applicant_id or "APP_0001")
    return result["llm_prompt"]


@router.post("/predict")
def predict(req: PredictRequest):
    if not state.artifacts_available():
        raise HTTPException(400, "Model not trained yet. Train it first (Settings page or 'python train.py').")
    try:
        result = _score(req.applicant, req.applicant_id or "APP_0001")
    except Exception as e:
        raise HTTPException(400, f"Prediction failed: {e}")
    return result


@router.post("/memo")
def memo(req: MemoRequest):
    if not state.artifacts_available():
        raise HTTPException(400, "Model not trained yet. Train it first.")

    settings = load_settings()["llm"]
    try:
        prompt = _resolve_prompt(req)
    except Exception as e:
        raise HTTPException(400, f"Prediction failed: {e}")

    if not settings["enabled"]:
        return {"memo": None, "llm_prompt": prompt, "ollama_error": "LLM is disabled in Settings."}

    try:
        memo_text, finish_reason = _call_ollama(settings, prompt)
        return {"memo": memo_text, "llm_prompt": prompt, "ollama_error": None, "finish_reason": finish_reason}
    except (urllib.error.URLError, TimeoutError, OSError) as e:
        memo = _next_demo_memo()
        if memo:
            return {
                "memo": memo,
                "llm_prompt": prompt,
                "ollama_error": None,
                "finish_reason": "demo",
                "demo_fallback": True,
            }
        return {
            "memo": None,
            "llm_prompt": prompt,
            "ollama_error": f"Could not reach Ollama ({settings['ollama_url']}): {e}",
        }


@router.post("/memo/stream")
def memo_stream(req: MemoRequest):
    """Stream the credit memo token-by-token via Server-Sent Events."""
    if not state.artifacts_available():
        raise HTTPException(400, "Model not trained yet. Train it first.")

    settings = load_settings()["llm"]
    try:
        prompt = _resolve_prompt(req)
    except Exception as e:
        raise HTTPException(400, f"Prediction failed: {e}")

    if not settings["enabled"]:
        def disabled():
            yield f"data: {json.dumps({'error': 'LLM is disabled in Settings.'})}\n\n"
        return StreamingResponse(disabled(), media_type="text/event-stream")

    return StreamingResponse(
        _stream_ollama(settings, prompt),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/predict/whatif")
def predict_whatif(req: WhatIfRequest):
    """Counterfactual scoring: re-predict with modified features + minimal-change suggestions."""
    if not state.artifacts_available():
        raise HTTPException(400, "Model not trained yet. Train it first (Settings page or 'python train.py').")
    try:
        return what_if(req.applicant, req.modifications)
    except Exception as e:
        raise HTTPException(400, f"What-if failed: {e}")


@router.post("/memo/verify")
def memo_verify(req: MemoVerifyRequest):
    """Start a background faithfulness audit of a generated memo (LLM-as-judge)."""
    settings = load_settings()["llm"]
    if not settings["enabled"]:
        raise HTTPException(400, "LLM is disabled in Settings.")
    memo_text = (req.memo_text or "").strip()
    if len(memo_text) < 20:
        raise HTTPException(400, "Nothing to verify — memo is empty.")
    evidence_text = build_evidence_text(req.evidence)
    job_id = verifier.start(memo_text, evidence_text, settings)
    return {"verify_id": job_id}


@router.get("/memo/verify/{verify_id}")
def memo_verify_status(verify_id: str):
    job = verifier.get(verify_id)
    if job is None:
        raise HTTPException(404, "Unknown verify job.")
    return job


@router.get("/drift")
def drift_report():
    """Latest PSI drift report from the most recent batch scoring (None if none yet)."""
    report = state.get_drift_report()
    if report is None:
        return {"overall_status": "no_data", "rows": [], "checked": 0, "sample_size": 0}
    return report


@router.post("/batch")
async def batch(file: UploadFile):
    """Score applicants from an uploaded CSV/XLSX file."""
    if not state.artifacts_available():
        raise HTTPException(400, "Model not trained yet. Train it first.")

    content = await file.read()
    try:
        if file.filename.lower().endswith((".xlsx", ".xls")):
            applicants = pd.read_excel(io.BytesIO(content))
        else:
            applicants = pd.read_csv(io.BytesIO(content))
    except Exception as e:
        raise HTTPException(400, f"Could not parse file: {e}")

    results = []
    for i in range(len(applicants)):
        row = applicants.iloc[i].to_dict()
        applicant_id = str(row.pop("applicant_id", f"APP_{i+1:04d}"))
        try:
            res = _score(row, applicant_id)
            res.pop("llm_prompt")
            results.append(res)
        except Exception as e:
            results.append({"applicant_id": applicant_id, "error": str(e)})

    # PSI drift check: uploaded data vs. training distribution
    drift = None
    try:
        from api.drift import compute_drift
        drift = compute_drift(applicants.drop(columns=["applicant_id"], errors="ignore"))
        state.set_drift_report(drift)
    except Exception:
        drift = None

    return {"count": len(results), "results": results, "drift": drift}

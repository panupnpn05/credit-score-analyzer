"""Faithfulness verification for generated credit memos (hallucination guardrail).

A second LLM pass audits the memo: every factual claim is classified as
GROUNDED / CONTRADICTED / UNSUPPORTED against the structured evidence that was
injected into the memo prompt (SHAP factors, probability, grade, SOP result).
The LLM narrates; the verifier grounds. Claims themselves never affect the
score — only the audit.

Runs as a background job (same status-polling pattern as retraining).
"""

import json
import re
import threading
import time
import uuid
import urllib.request
import urllib.error

_verify_prompt = """You are a strict fact-checking auditor for a credit risk system.

EVIDENCE (ground truth computed by the scoring system — trust ONLY this):
{evidence}

MEMO TO AUDIT:
{memo}

Task: extract every factual or quantitative claim in the memo (numbers, grades,
probabilities, feature values, SOP results, statements about what increases or
decreases risk). For each claim, classify:
- "grounded": consistent with the evidence (rounding is fine)
- "contradicted": conflicts with the evidence
- "unsupported": not derivable from the evidence at all

Reply with ONLY a JSON object, no prose, no markdown fences:
{{"claims": [{{"claim": "...", "verdict": "grounded|contradicted|unsupported", "note": "short reason"}}]}}

If the memo contains no factual claims, return {{"claims": []}}.
"""


def _parse_verdicts(text):
    """Robustly extract the JSON array of claims from an LLM response."""
    text = text.strip()
    text = re.sub(r"^```(json)?", "", text).strip()
    text = re.sub(r"```$", "", text).strip()
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("No JSON object in verifier response")
    data = json.loads(text[start:end + 1])
    claims = data.get("claims", [])
    out = []
    for c in claims:
        verdict = str(c.get("verdict", "unsupported")).lower()
        if verdict not in ("grounded", "contradicted", "unsupported"):
            verdict = "unsupported"
        out.append({
            "claim": str(c.get("claim", ""))[:300],
            "verdict": verdict,
            "note": str(c.get("note", ""))[:300],
        })
    return out


def build_evidence_text(result: dict) -> str:
    """Flatten a predict result into the ground-truth evidence block."""
    lines = [
        f"Predicted default probability (model output): {result['default_probability']:.2%}",
        f"Risk grade (from probability): {result['risk_grade']}",
        f"Model decision (mockup policy): {result['decision']}",
        "\nSHAP attributions below: positive value = raises default risk, negative = lowers it.",
    ]
    for title, factors in (("Risk factors (increase default risk)", result.get("risk_factors")),
                           ("Protective factors (decrease default risk)", result.get("protective_factors"))):
        lines.append(f"\n{title}:")
        if factors:
            for f in factors:
                lines.append(f"  - {f['feature']} = {f['value']:.4g} (SHAP {f['shap_value']:+.4f}, {f['impact']})")
        else:
            lines.append("  - None significant")
    sop = result.get("sop")
    if sop:
        lines.append(
            f"\nManual SOP (already computed by the system): score {sop['score']:.1f} "
            f"-> Grade {sop['grade']} -> {sop['decision']}"
        )
    return "\n".join(lines)


def _run_verification(job_id, memo_text, evidence_text, llm_settings, jobs, jobs_lock):
    def finish(**kwargs):
        with jobs_lock:
            jobs[job_id].update(kwargs)

    try:
        prompt = _verify_prompt.format(evidence=evidence_text, memo=memo_text[:6000])
        payload = json.dumps({
            "model": llm_settings["model"],
            "prompt": prompt,
            "stream": False,
            "keep_alive": llm_settings.get("keep_alive", "10m"),
            "options": {"num_predict": 900, "temperature": 0.0},
        }).encode("utf-8")
        req = urllib.request.Request(
            llm_settings["ollama_url"].rstrip("/") + "/api/generate",
            data=payload,
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=120) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        claims = _parse_verdicts(data.get("response", ""))
        grounded = sum(1 for c in claims if c["verdict"] == "grounded")
        contradicted = sum(1 for c in claims if c["verdict"] == "contradicted")
        finish(
            status="done",
            claims=claims,
            grounded=grounded,
            contradicted=contradicted,
            unsupported=len(claims) - grounded - contradicted,
            total=len(claims),
            finished_at=time.time(),
        )
    except (urllib.error.URLError, TimeoutError, OSError) as e:
        finish(status="error", error=f"Could not reach Ollama: {e}", finished_at=time.time())
    except Exception as e:
        finish(status="error", error=f"Verification failed: {e}", finished_at=time.time())


class Verifier:
    """In-memory job store + runner for memo verification."""

    def __init__(self, max_jobs=50):
        self._jobs = {}
        self._lock = threading.Lock()
        self._max_jobs = max_jobs

    def start(self, memo_text: str, evidence_text: str, llm_settings: dict) -> str:
        job_id = uuid.uuid4().hex[:12]
        with self._lock:
            if len(self._jobs) >= self._max_jobs:
                oldest = min(self._jobs, key=lambda k: self._jobs[k].get("started_at", 0))
                self._jobs.pop(oldest, None)
            self._jobs[job_id] = {"status": "running", "started_at": time.time()}
        thread = threading.Thread(
            target=_run_verification,
            args=(job_id, memo_text, evidence_text, llm_settings, self._jobs, self._lock),
            daemon=True,
        )
        thread.start()
        return job_id

    def get(self, job_id: str):
        with self._lock:
            job = self._jobs.get(job_id)
            return dict(job) if job else None

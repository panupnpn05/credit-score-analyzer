"""Generate demo_cache/memos.json — cached memos served when Ollama is unreachable.

Regenerate with:  python scripts/make_demo_cache.py
Requires the API to be running with a reachable Ollama.
"""

import json
import os
import sys
import urllib.request

API = os.environ.get("API_URL", "http://localhost:8000")

ARCHETYPES = {
    "low_risk": {
        "RevolvingUtilizationOfUnsecuredLines": 0.05, "age": 52,
        "NumberOfTime30-59DaysPastDueNotWorse": 0, "DebtRatio": 0.25,
        "MonthlyIncome": 12000, "NumberOfOpenCreditLinesAndLoans": 6,
        "NumberOfTimes90DaysLate": 0, "NumberRealEstateLoansOrLines": 1,
        "NumberOfTime60-89DaysPastDueNotWorse": 0, "NumberOfDependents": 0,
    },
    "medium_risk": {
        "RevolvingUtilizationOfUnsecuredLines": 0.55, "age": 38,
        "NumberOfTime30-59DaysPastDueNotWorse": 1, "DebtRatio": 0.75,
        "MonthlyIncome": 5500, "NumberOfOpenCreditLinesAndLoans": 9,
        "NumberOfTimes90DaysLate": 0, "NumberRealEstateLoansOrLines": 1,
        "NumberOfTime60-89DaysPastDueNotWorse": 0, "NumberOfDependents": 2,
    },
    "high_risk": {
        "RevolvingUtilizationOfUnsecuredLines": 1.4, "age": 32,
        "NumberOfTime30-59DaysPastDueNotWorse": 4, "DebtRatio": 1.6,
        "MonthlyIncome": 2800, "NumberOfOpenCreditLinesAndLoans": 14,
        "NumberOfTimes90DaysLate": 2, "NumberRealEstateLoansOrLines": 3,
        "NumberOfTime60-89DaysPastDueNotWorse": 1, "NumberOfDependents": 4,
    },
}


def post(path, payload, timeout=180):
    req = urllib.request.Request(
        API + path, data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
    )
    return json.loads(urllib.request.urlopen(req, timeout=timeout).read())


def main():
    memos = []
    for name, applicant in ARCHETYPES.items():
        print(f"Scoring + generating memo for {name}...")
        res = post("/api/predict", {"applicant": applicant, "applicant_id": f"DEMO_{name}"})
        memo = post("/api/memo", {
            "applicant": applicant,
            "applicant_id": f"DEMO_{name}",
            "llm_prompt": res["llm_prompt"],
        })
        text = (memo.get("memo") or "").strip()
        if not text:
            print(f"  ! no memo returned ({memo.get('ollama_error')}); skipping")
            continue
        memos.append({"profile": name, "text": text})
        print(f"  ok ({len(text)} chars, finish={memo.get('finish_reason')})")

    if not memos:
        sys.exit("No memos generated — is the API up with LLM enabled?")

    out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "demo_cache", "memos.json")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w") as f:
        json.dump({"memos": [m["text"] for m in memos]}, f, ensure_ascii=False, indent=2)
    print(f"Wrote {len(memos)} demo memos to {out}")


if __name__ == "__main__":
    main()

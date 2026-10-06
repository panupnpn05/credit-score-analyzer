"""Verify manual SOP scores against the XGBoost model.

The points tables in docs/SCORING_SOP.md are the single source of truth for the
manual scoring policy. This script parses them directly from the markdown file,
computes the manual score for an applicant (base score + field points), and
prints it side-by-side with the XGBoost model's probability, grade, and decision.

Parsing and manual-scoring logic lives in api/sop_store.py (shared with the
web API); this script is only a CLI front-end.

Usage:
    python scripts/verify_sop.py --demo
    python scripts/verify_sop.py --file path/to/applicant.json
    python scripts/verify_sop.py --file applicants.csv          # all rows
    python scripts/verify_sop.py --sop docs/SCORING_SOP.md ...  # custom SOP file
"""

import argparse
import json
import os
import sys

import pandas as pd

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, PROJECT_ROOT)

from api.sop_store import load_sop, score_manual, manual_grade, manual_decision  # noqa: E402


# ---------------------------------------------------------------------------
# Model scoring (XGBoost)
# ---------------------------------------------------------------------------

def score_model(applicant_df, thresholds):
    from predict import load_artifacts
    from explainer import probability_to_grade

    model, preprocessor, _ = score_model._artifacts
    X = preprocessor.transform(applicant_df)
    prob = float(model.predict_proba(X)[0, 1])
    grade = probability_to_grade(prob)
    if prob < thresholds["approve_threshold"]:
        decision = "APPROVE"
    elif prob > thresholds["decline_threshold"]:
        decision = "NON-APPROVE"
    else:
        decision = "MANUAL_REVIEW"
    return prob, grade, decision


def load_thresholds():
    settings_path = os.path.join(PROJECT_ROOT, "settings.json")
    with open(settings_path, encoding="utf-8") as f:
        return json.load(f)["decision"]


def load_applicant_file(path):
    if path.lower().endswith(".json"):
        with open(path, encoding="utf-8") as f:
            return pd.DataFrame([json.load(f)])
    return pd.read_csv(path)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Verify manual SOP scores against the XGBoost model")
    parser.add_argument("--demo", action="store_true", help="Use the built-in demo applicant")
    parser.add_argument("--file", type=str, help="Applicant file (.json single object, or .csv)")
    parser.add_argument("--sop", type=str, default=os.path.join(PROJECT_ROOT, "docs", "SCORING_SOP.md"),
                        help="Path to the SOP markdown file")
    args = parser.parse_args()

    print(f"SOP file: {args.sop}")
    sop = load_sop(args.sop)
    n_cat = len({r["field"] for r in sop["categorical"]})
    n_num = len({r["field"] for r in sop["numeric"]})
    unassigned = sum(1 for r in sop["categorical"] + sop["numeric"] if r["points"] is None)
    print(f"Parsed: base score {sop['base_score']:g} | {len(sop['categorical'])} categorical values "
          f"({n_cat} fields) | {len(sop['numeric'])} numeric bands ({n_num} fields) | "
          f"{len(sop['grades'])} grades | {len(sop['decision'])} decision rules")
    if unassigned:
        print(f"Note: {unassigned} SOP entries have no points assigned yet (counted as 0)")

    if args.demo:
        from predict import create_demo_applicant
        applicants = create_demo_applicant()
    elif args.file:
        applicants = load_applicant_file(args.file)
    else:
        parser.print_help()
        print("\nRun with --demo or --file <path>")
        return

    from predict import load_artifacts
    print("Loading XGBoost model artifacts...")
    score_model._artifacts = load_artifacts()
    thresholds = load_thresholds()

    for idx in range(len(applicants)):
        row = applicants.iloc[idx]
        applicant_df = applicants.iloc[[idx]].drop(columns=["applicant_id"], errors="ignore")

        total, details, warnings = score_manual(row.to_dict(), sop)
        m_prob, m_grade, m_decision = score_model(applicant_df, thresholds)
        g_manual = manual_grade(total, sop)
        d_manual = manual_decision(g_manual, sop)

        print("\n" + "=" * 70)
        print(f"APPLICANT {idx + 1}")
        print("=" * 70)
        print(f"  {'Field':<24}{'Value':<28}{'Points':>8}")
        for field, value, pts, note in details:
            suffix = f"  <- {note}" if note else ""
            print(f"  {field:<24}{value:<28}{pts:>+8.1f}{suffix}")
        print(f"  {'-' * 60}")
        print(f"  {'MANUAL SOP':<52}{total:>8.1f}  -> Grade {g_manual} -> {d_manual}")
        print(f"  {'XGBOOST MODEL':<52}{m_prob:>8.1%}  -> Grade {m_grade} -> {m_decision}")

        if warnings:
            print(f"\n  Warnings ({len(warnings)}):")
            for w in warnings:
                print(f"    - {w}")

        agree = "AGREE ✅" if d_manual == m_decision else "DISAGREE ⚠️  (check your point values)"
        print(f"\n  Decision match: {agree}")


if __name__ == "__main__":
    main()

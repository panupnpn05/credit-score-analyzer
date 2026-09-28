"""Inference: Score applicant(s) from a file or demo, and generate LLM-ready explanation prompt."""

import argparse
import os
import json
import joblib
import pandas as pd

import config
from model import load_model
from explainer import build_explainer, explain_instance, generate_llm_prompt, probability_to_grade


def load_artifacts():
    """Load trained model and preprocessor."""
    model_path = os.path.join(config.MODEL_DIR, "credit_model.joblib")
    preprocessor_path = os.path.join(config.MODEL_DIR, "preprocessor.joblib")

    if not os.path.exists(model_path):
        raise FileNotFoundError("Model not found. Run 'python train.py' first.")

    model = load_model(model_path)
    artifacts = joblib.load(preprocessor_path)
    return model, artifacts["preprocessor"], artifacts["feature_names"]


def create_demo_applicant():
    """Create a synthetic applicant (German Credit format)."""
    return pd.DataFrame([{
        "checking_status": "<0",
        "duration": 24,
        "credit_history": "existing paid",
        "purpose": "furniture/equipment",
        "credit_amount": 5000,
        "savings_status": "<100",
        "employment": "4<=X<7",
        "installment_commitment": 3,
        "personal_status": "male single",
        "other_parties": "none",
        "residence_since": 3,
        "property_magnitude": "real estate",
        "age": 35,
        "other_payment_plans": "none",
        "housing": "own",
        "existing_credits": 1,
        "job": "skilled",
        "num_dependents": 1,
        "own_telephone": "yes",
        "foreign_worker": "yes",
    }])


def score_applicant(model, preprocessor, feature_names, applicant_df, applicant_id="DEMO_001"):
    """Full scoring pipeline for one applicant."""
    if config.TARGET_COLUMN in applicant_df.columns:
        applicant_df = applicant_df.drop(columns=[config.TARGET_COLUMN])

    X = preprocessor.transform(applicant_df)
    default_prob = float(model.predict_proba(X)[0, 1])
    risk_grade = probability_to_grade(default_prob)

    explainer = build_explainer(model, X)
    explanation = explain_instance(explainer, X[0], feature_names, top_n=8)

    summary = {col: applicant_df[col].iloc[0] for col in applicant_df.columns}

    llm_prompt = generate_llm_prompt(
        applicant_id=applicant_id,
        prediction_prob=default_prob,
        risk_grade=risk_grade,
        explanation=explanation,
        applicant_summary=summary,
    )

    return {
        "applicant_id": applicant_id,
        "default_probability": default_prob,
        "risk_grade": risk_grade,
        "risk_factors": explanation["risk_factors"],
        "protective_factors": explanation["protective_factors"],
        "llm_prompt": llm_prompt,
    }


def print_result(result):
    print(f"\nApplicant:           {result['applicant_id']}")
    print(f"Default Probability: {result['default_probability']:.2%}")
    print(f"Risk Grade:          {result['risk_grade']}")

    print(f"\nRisk Factors:")
    for f in result["risk_factors"]:
        print(f"  - {f['feature']}: {f['value']:.4f} (SHAP: +{f['shap_value']:.4f})")

    print(f"\nProtective Factors:")
    for f in result["protective_factors"]:
        print(f"  - {f['feature']}: {f['value']:.4f} (SHAP: {f['shap_value']:.4f})")

    print("\n" + "-" * 60)
    print("LLM PROMPT (paste into Ollama):")
    print("-" * 60)
    print(result["llm_prompt"])
    print("-" * 60)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--demo", action="store_true", help="Run with demo applicant")
    parser.add_argument("--file", type=str, help="Path to CSV/XLSX file with applicant(s) to score")
    args = parser.parse_args()

    print("Loading artifacts...")
    model, preprocessor, feature_names = load_artifacts()

    if args.demo:
        print("\n" + "=" * 60)
        print("SCORING DEMO APPLICANT")
        print("=" * 60)

        applicant = create_demo_applicant()
        result = score_applicant(model, preprocessor, feature_names, applicant)
        print_result(result)

        out_path = os.path.join(config.OUTPUT_DIR, "demo_result.json")
        with open(out_path, "w") as f:
            json.dump(result, f, indent=2, default=str)
        print(f"\nSaved to {out_path}")

    elif args.file:
        if args.file.lower().endswith((".xlsx", ".xls")):
            applicants = pd.read_excel(args.file)
        else:
            applicants = pd.read_csv(args.file)

        print(f"\nScoring {len(applicants)} applicant(s) from {args.file}...")
        results = []
        for i in range(len(applicants)):
            row = applicants.iloc[[i]]
            applicant_id = row["applicant_id"].iloc[0] if "applicant_id" in row.columns else f"APP_{i+1:04d}"
            row = row.drop(columns=["applicant_id"], errors="ignore")
            result = score_applicant(model, preprocessor, feature_names, row, applicant_id)
            results.append(result)
            print(f"{applicant_id}: {result['default_probability']:.2%} -> Grade {result['risk_grade']}")

        out_path = os.path.join(config.OUTPUT_DIR, "scoring_results.json")
        with open(out_path, "w") as f:
            json.dump(results, f, indent=2, default=str)
        print(f"\nSaved {len(results)} result(s) to {out_path}")
    else:
        print("Usage: python predict.py --demo")
        print("       python predict.py --file data\\applicants.xlsx")


if __name__ == "__main__":
    main()

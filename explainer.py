"""SHAP explainability that produces LLM-ready structured output."""

import numpy as np
import shap

import config


def build_explainer(model, X_background):
    """Build SHAP TreeExplainer."""
    return shap.TreeExplainer(model)


def explain_instance(explainer, X_instance, feature_names, top_n=8):
    """Generate SHAP explanation for a single applicant."""
    X_instance = np.asarray(X_instance)
    X_input = X_instance.reshape(1, -1) if X_instance.ndim == 1 else X_instance
    shap_values = explainer.shap_values(X_input)

    if isinstance(shap_values, list):
        shap_values = shap_values[1]

    shap_values = np.asarray(shap_values).flatten()
    X_instance = X_instance.flatten()

    contributions = []
    for i, fname in enumerate(feature_names):
        if i >= len(shap_values):
            break
        contributions.append({
            "feature": fname,
            "value": float(X_instance[i]),
            "shap_value": float(shap_values[i]),
            "impact": "increases risk" if shap_values[i] > 0 else "decreases risk",
            "abs_impact": abs(float(shap_values[i])),
        })

    contributions.sort(key=lambda x: x["abs_impact"], reverse=True)
    top = contributions[:top_n]

    expected = explainer.expected_value
    if isinstance(expected, (list, np.ndarray)):
        expected = expected[-1] if np.ndim(expected) else expected

    return {
        "base_value": float(expected),
        "top_contributions": top,
        "risk_factors": [c for c in top if c["shap_value"] > 0],
        "protective_factors": [c for c in top if c["shap_value"] < 0],
    }


def generate_llm_prompt(applicant_id, prediction_prob, risk_grade, explanation, applicant_summary=None):
    """Generate structured prompt for Local LLM."""
    risk_text = "\n".join(
        f"  - {c['feature']}: {c['value']:.4f} ({c['impact']})"
        for c in explanation["risk_factors"]
    ) or "  - None significant"

    protect_text = "\n".join(
        f"  - {c['feature']}: {c['value']:.4f} ({c['impact']})"
        for c in explanation["protective_factors"]
    ) or "  - None significant"

    summary_text = ""
    if applicant_summary:
        summary_text = "\nApplicant Summary:\n" + "\n".join(
            f"  {k}: {v}" for k, v in applicant_summary.items()
        )

    return f"""You are a senior credit risk analyst. Write a concise, professional credit risk assessment.

Applicant ID: {applicant_id}
Predicted Default Probability: {prediction_prob:.2%}
Risk Grade: {risk_grade}
{summary_text}

Key Risk Factors:
{risk_text}

Key Protective Factors:
{protect_text}

Instructions:
- Write 2-3 paragraphs in professional banking language.
- Explain WHY the risk factors matter in plain language.
- Mention any mitigating strengths.
- Do NOT make a final approve/reject recommendation; only assess risk.
- Keep it under 200 words.
"""


def probability_to_grade(prob):
    for i, threshold in enumerate(config.SCORE_BINS[1:]):
        if prob <= threshold:
            return config.SCORE_LABELS[i]
    return config.SCORE_LABELS[-1]

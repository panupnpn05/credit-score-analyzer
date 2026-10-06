"""Build the SOP guideline section injected into LLM memo prompts.

The manual scoring SOP (docs/SCORING_SOP.md) is the judging guideline the LLM
should follow when writing the memo. The SOP score itself is computed
deterministically here (LLMs are unreliable at arithmetic) — the LLM's job is
to reason and explain, not to calculate.
"""

from api.sop_store import load_sop, score_manual, manual_grade, manual_decision


def _fmt_pts(p):
    if p is None:
        return "0"
    v = float(p)
    return f"{v:+g}"


def _rules_text(sop):
    lines = []
    lines.append("### SOP Rules")
    lines.append(f"- Base score: {_fmt_pts(sop['base_score']).lstrip('+')}")
    lines.append("- Start at the base score, add the points for each matching attribute, "
                 "then map the total to a grade and decision.")
    lines.append("- Positive points = lowers risk (good). Negative points = raises risk (bad).")

    grades = ", ".join(f"{g['grade']}: {g['min']:g}–{g['max']:g}" for g in sop["grades"])
    lines.append(f"- Grade cutoffs (total score): {grades}")

    decision = ", ".join(f"{d['grade']} = {d['decision']}" for d in sop["decision"])
    lines.append(f"- Decision policy: {decision}")

    # Compact points tables, grouped by field
    lines.append("\n### SOP Points Tables")
    lines.append("Categorical fields (field: value = points, `*` = model baseline):")
    current_field = None
    chunks = []
    for r in sop["categorical"]:
        if r["field"] != current_field:
            current_field = r["field"]
            chunks.append(f"\n- {current_field}: ")
        chunks.append(f"{r['value']}{'*' if r.get('baseline') else ''}={_fmt_pts(r['points'])}, ")
    lines.append("".join(chunks).rstrip(", "))

    lines.append("\nNumeric fields (band = points):")
    current_field = None
    chunks = []
    for r in sop["numeric"]:
        if r["field"] != current_field:
            current_field = r["field"]
            chunks.append(f"\n- {current_field}: ")
        chunks.append(f"{r['band']}={_fmt_pts(r['points'])}, ")
    lines.append("".join(chunks).rstrip(", "))
    return "\n".join(lines)


def _breakdown_text(total, grade, decision, details):
    lines = ["\n### This applicant's SOP scoring (computed by system)"]
    for field, value, pts, note in details:
        suffix = f" ({note})" if note else ""
        lines.append(f"- {field}: {value} -> {_fmt_pts(pts)} pts{suffix}")
    lines.append(f"\nSOP total = {total:g} -> Grade {grade} -> Decision: {decision}")
    return "\n".join(lines)


def build_sop_guidance(applicant):
    """Score `applicant` under the manual SOP and build the LLM guidance section.

    Returns dict with text (prompt-ready markdown) plus structured score fields.
    """
    sop = load_sop()
    total, details, warnings = score_manual(applicant, sop)
    grade = manual_grade(total, sop)
    decision = manual_decision(grade, sop)

    header = [
        "## Manual Scoring SOP (judging guideline)",
        "",
        "The company uses a manual points-based scoring guideline (SOP) below. "
        "Use it as the guideline for your judgment: explain the application in terms "
        "of the SOP rules, and state whether the SOP result agrees with the model. "
        "The SOP score for this applicant has already been computed by the system — "
        "do NOT recompute or change it.",
        "",
    ]

    unassigned = sum(1 for w in warnings if "no points assigned" in w)
    if unassigned:
        header.append(f"Note: {unassigned} attribute(s) of this applicant hit SOP entries "
                      "with no points assigned; they count as 0.\n")

    text = "\n".join(header) + _rules_text(sop) + _breakdown_text(total, grade, decision, details)

    return {
        "text": text,
        "score": total,
        "grade": grade,
        "decision": decision,
        "breakdown": [
            {"field": f, "value": v, "points": p, "note": n} for f, v, p, n in details
        ],
        "warnings": warnings,
    }

# Credit Scoring SOP — Manual Points-Based Guideline

**Purpose:** This Standard Operating Procedure lets a credit officer score an applicant **by hand**, using a simple points system: start from a base score, add or deduct points for each applicant attribute, and convert the total into a risk grade and loan decision — no computer required.

**Dataset:** The current model is trained on the **Give Me Some Credit** dataset (150,000 US borrowers, Kaggle competition data). All 10 input fields are numeric — there are no categorical fields.

**Relationship to the XGBoost model:** This SOP is a *manual policy*. It is **not** the XGBoost model's output, and it does not change when the model is retrained. The XGBoost model (see `README.md`) scores applicants automatically; this SOP is your own human-applied scoring guideline. Use the **SOP page → Test Applicant** verifier (or `python scripts/verify_sop.py`) to compare manual scores against the model.

> ⚠️ **Disclaimer:** For educational/demo use only. Not for real lending decisions.

---

## How Scoring Works

```
Base score (100)
   + points from each of the 10 applicant fields (positive = good, negative = bad)
= Total score
   → Grade (A–E) via the Grade Cutoffs table
   → Decision (APPROVE / MANUAL_REVIEW / NON-APPROVE) via the Decision Policy table
```

## How to Use This SOP

1. **Collect applicant data** for all 10 fields listed in Appendix B.
2. **Look up points** for each field in the Points Tables below. For each field, find the band that contains the applicant's value (bands are inclusive: `30-45` means 30 to 45).
3. **Compute the total:** `Total = Base score + sum of all 10 field points`.
4. **Assign the grade** from the Grade Cutoffs table.
5. **Apply the decision** from the Decision Policy table.

---

## Points Tables (EDIT THESE)

> **This is your policy.** Fill in the `Points` column with your own values
> (positive = lowers risk, negative = raises risk). Leave a cell empty = 0 points.
> Appendix A shows how the XGBoost model weighs each band — use it as a
> reference when deciding your points, then tune to your own risk appetite.
>
> The SOP page in the web app edits these tables directly, and
> `scripts/verify_sop.py` reads them **from this file**.

### Scoring Parameters

| Parameter | Value |
|-----------|-------|
| Base score | 100 |

### Categorical Fields

*This dataset has no categorical fields — every input is numeric. The table is kept empty for structure; if you retrain on data with categories, list each value here.*

| Field | Value | Points |
|-------|-------|--------|

### Numeric Fields (Bands)

Find the applicant's value in the band; bands are checked top-to-bottom and are inclusive.

| Field | Band | Points |
|-------|------|--------|
| RevolvingUtilizationOfUnsecuredLines | <0.2 | 11 |
| RevolvingUtilizationOfUnsecuredLines | 0.2-0.5 | 3 |
| RevolvingUtilizationOfUnsecuredLines | 0.5-1 | -7 |
| RevolvingUtilizationOfUnsecuredLines | 1-2 | -13 |
| RevolvingUtilizationOfUnsecuredLines | >2 | -10 |
| age | <30 | -3 |
| age | 30-45 | -1 |
| age | 46-60 | 0 |
| age | >60 | 5 |
| NumberOfTime30-59DaysPastDueNotWorse | 0 | 3 |
| NumberOfTime30-59DaysPastDueNotWorse | 1 | -6 |
| NumberOfTime30-59DaysPastDueNotWorse | 2 | -10 |
| NumberOfTime30-59DaysPastDueNotWorse | >2 | -12 |
| DebtRatio | <0.5 | 2 |
| DebtRatio | 0.5-1 | -2 |
| DebtRatio | 1-2 | -4 |
| DebtRatio | >2 | 1 |
| MonthlyIncome | <3000 | -1 |
| MonthlyIncome | 3000-6000 | 0 |
| MonthlyIncome | 6000-10000 | 1 |
| MonthlyIncome | >10000 | 3 |
| NumberOfOpenCreditLinesAndLoans | <5 | 2 |
| NumberOfOpenCreditLinesAndLoans | 5-10 | 1 |
| NumberOfOpenCreditLinesAndLoans | 10-15 | -1 |
| NumberOfOpenCreditLinesAndLoans | >15 | -3 |
| NumberOfTimes90DaysLate | 0 | 3 |
| NumberOfTimes90DaysLate | 1 | -14 |
| NumberOfTimes90DaysLate | >1 | -18 |
| NumberRealEstateLoansOrLines | 0 | 0 |
| NumberRealEstateLoansOrLines | 1 | 2 |
| NumberRealEstateLoansOrLines | 2 | 0 |
| NumberRealEstateLoansOrLines | >2 | -4 |
| NumberOfTime60-89DaysPastDueNotWorse | 0 | 1 |
| NumberOfTime60-89DaysPastDueNotWorse | 1 | -11 |
| NumberOfTime60-89DaysPastDueNotWorse | >1 | -13 |
| NumberOfDependents | 0 | 0 |
| NumberOfDependents | 1 | 0 |
| NumberOfDependents | 2 | 0 |
| NumberOfDependents | >2 | -1 |

### Grade Cutoffs

Total score → risk grade. (Suggested starting values — edit to fit your point scale.)

| Grade | Min score | Max score |
|-------|-----------|-----------|
| A | 100 | 999 |
| B | 90 | 99 |
| C | 80 | 89 |
| D | 70 | 79 |
| E | -999 | 69 |

### Decision Policy

Risk grade → loan decision. (Suggested starting values — edit freely.)

| Grade | Decision |
|-------|----------|
| A | APPROVE |
| B | APPROVE |
| C | MANUAL_REVIEW |
| D | NON-APPROVE |
| E | NON-APPROVE |

---

## Worked Example

Applicant (first row of `data/credit_data.csv`, a real default from the training data):

| Field | Applicant value |
|-------|-----------------|
| RevolvingUtilizationOfUnsecuredLines | 0.77 |
| age | 45 |
| NumberOfTime30-59DaysPastDueNotWorse | 2 |
| DebtRatio | 0.80 |
| MonthlyIncome | 9,120 |
| NumberOfOpenCreditLinesAndLoans | 13 |
| NumberOfTimes90DaysLate | 0 |
| NumberRealEstateLoansOrLines | 6 |
| NumberOfTime60-89DaysPastDueNotWorse | 0 |
| NumberOfDependents | 2 |

**Step 1–2:** Look up each field's points. *The values below are EXAMPLE POINTS for illustration only — they are not the real table above.*

| Field | Value (band) | Example points |
|-------|--------------|----------------|
| RevolvingUtilizationOfUnsecuredLines | 0.77 (0.5-1) | −10 |
| age | 45 (30-45) | +2 |
| NumberOfTime30-59DaysPastDueNotWorse | 2 (2) | −12 |
| DebtRatio | 0.80 (0.5-1) | −4 |
| MonthlyIncome | 9,120 (6000-10000) | +2 |
| NumberOfOpenCreditLinesAndLoans | 13 (10-15) | −1 |
| NumberOfTimes90DaysLate | 0 (0) | +3 |
| NumberRealEstateLoansOrLines | 6 (>2) | −3 |
| NumberOfTime60-89DaysPastDueNotWorse | 0 (0) | +2 |
| NumberOfDependents | 2 (2) | 0 |

**Step 3:** Total = 100 + (−10 +2 −12 −4 +2 −1 +3 −3 +2 +0) = **79**

**Step 4:** 79 is in 70–79 → **Grade D**

**Step 5:** Grade D → **NON-APPROVE**

*For reference: the XGBoost model scores this same applicant at P(default) = 40.6% → Grade C → NON-APPROVE — the manual example and the model reach the same decision.* ✅

---

## Verification

The SOP tables above are machine-readable. To check how well your manual policy agrees with the XGBoost model:

```bash
python scripts/verify_sop.py --file path/to/applicant.json   # one applicant as JSON
python scripts/verify_sop.py --file applicants.csv           # or CSV (all rows)
```

Or use the **SOP page → Test Applicant** panel in the web app. Fields with empty `Points` cells count as 0 and are listed as warnings — so you can fill the tables in gradually and watch the agreement improve.

---

## Appendix A — Model Reference Impacts

Measured from the trained XGBoost model (SHAP analysis over a 20,000-row sample of the training data). Unit is **log-odds of default** for applicants in that band:

- **Positive** value → the model sees this as **risk-raising** → consider **negative points**
- **Negative** value → the model sees this as **protective** → consider **positive points**
- Magnitude = strength. Rough guide: `±0.1` weak, `±0.3` moderate, `±0.6+` strong

Note: `MonthlyIncome` and `NumberOfDependents` had missing values in the data (filled with the training median before scoring), so the band impacts below are computed on the filled values.

| Field | Band | Model impact (log-odds) |
|-------|------|--------------------------|
| RevolvingUtilizationOfUnsecuredLines | <0.2 | −1.056 |
| RevolvingUtilizationOfUnsecuredLines | 0.2-0.5 | −0.313 |
| RevolvingUtilizationOfUnsecuredLines | 0.5-1 | +0.713 |
| RevolvingUtilizationOfUnsecuredLines | 1-2 | +1.293 |
| RevolvingUtilizationOfUnsecuredLines | >2 | +1.039 |
| age | <30 | +0.257 |
| age | 30-45 | +0.120 |
| age | 46-60 | −0.010 |
| age | >60 | −0.455 |
| NumberOfTime30-59DaysPastDueNotWorse | 0 | −0.310 |
| NumberOfTime30-59DaysPastDueNotWorse | 1 | +0.602 |
| NumberOfTime30-59DaysPastDueNotWorse | 2 | +1.012 |
| NumberOfTime30-59DaysPastDueNotWorse | >2 | +1.152 |
| DebtRatio | <0.5 | −0.150 |
| DebtRatio | 0.5-1 | +0.176 |
| DebtRatio | 1-2 | +0.367 |
| DebtRatio | >2 | −0.090 |
| MonthlyIncome | <3000 | +0.068 |
| MonthlyIncome | 3000-6000 | −0.046 |
| MonthlyIncome | 6000-10000 | −0.083 |
| MonthlyIncome | >10000 | −0.290 |
| NumberOfOpenCreditLinesAndLoans | <5 | −0.157 |
| NumberOfOpenCreditLinesAndLoans | 5-10 | −0.110 |
| NumberOfOpenCreditLinesAndLoans | 10-15 | +0.093 |
| NumberOfOpenCreditLinesAndLoans | >15 | +0.295 |
| NumberOfTimes90DaysLate | 0 | −0.278 |
| NumberOfTimes90DaysLate | 1 | +1.413 |
| NumberOfTimes90DaysLate | >1 | +1.814 |
| NumberRealEstateLoansOrLines | 0 | +0.008 |
| NumberRealEstateLoansOrLines | 1 | −0.174 |
| NumberRealEstateLoansOrLines | 2 | −0.037 |
| NumberRealEstateLoansOrLines | >2 | +0.362 |
| NumberOfTime60-89DaysPastDueNotWorse | 0 | −0.127 |
| NumberOfTime60-89DaysPastDueNotWorse | 1 | +1.065 |
| NumberOfTime60-89DaysPastDueNotWorse | >1 | +1.320 |
| NumberOfDependents | 0 | −0.033 |
| NumberOfDependents | 1 | +0.018 |
| NumberOfDependents | 2 | +0.008 |
| NumberOfDependents | >2 | +0.065 |

*Note:* some impacts look counter-intuitive (e.g. `DebtRatio >2` is mildly protective in this data because those rows behave differently from the bulk — and the dataset contains extreme outliers). Treat these as reference signals, not ground truth, and adjust your manual points to your own judgment and regulatory constraints (be careful using attributes that may be legally protected, such as `age`, in real policies).

---

## Appendix B — Field Dictionary

| # | Field | Unit | Description |
|---|-------|------|-------------|
| 1 | RevolvingUtilizationOfUnsecuredLines | ratio 0+ | Credit card / credit line utilization (balance ÷ limit); >1 = over limit |
| 2 | age | years | Applicant age |
| 3 | NumberOfTime30-59DaysPastDueNotWorse | count | Times 30–59 days past due in the last 2 years |
| 4 | DebtRatio | ratio | Monthly debt payments ÷ monthly income |
| 5 | MonthlyIncome | USD | Monthly income (some values missing in the raw data) |
| 6 | NumberOfOpenCreditLinesAndLoans | count | Number of open credit lines and loans |
| 7 | NumberOfTimes90DaysLate | count | Times 90+ days past due |
| 8 | NumberRealEstateLoansOrLines | count | Number of mortgage / real-estate loans incl. home equity |
| 9 | NumberOfTime60-89DaysPastDueNotWorse | count | Times 60–89 days past due in the last 2 years |
| 10 | NumberOfDependents | count | Number of dependents |

---

## Maintenance Notes

- **Your points, your policy:** the Points Tables, Grade Cutoffs, and Decision Policy are entirely yours to define and tune. The appendix values are only a starting reference from the current model.
- **Model retraining:** if the XGBoost model is retrained (e.g. `POST /api/retrain` or `python train.py`), Appendix A becomes stale. Re-run the SHAP analysis to refresh it; the manual tables are *not* updated automatically and will not drift unless you edit them.
- **Changing datasets:** this SOP's tables match the Give Me Some Credit fields. If you train on a different dataset, regenerate the Points Tables and appendices for its fields (the previous German Credit version of this SOP is kept at `docs/SCORING_SOP.german-credit.md` as a format reference).

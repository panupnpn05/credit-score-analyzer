# Credit Scoring SOP — Manual Points-Based Guideline

**Purpose:** This Standard Operating Procedure lets a credit officer score an applicant **by hand**, using a simple points system: start from a base score, add or deduct points for each applicant attribute, and convert the total into a risk grade and loan decision — no computer required.

**Relationship to the XGBoost model:** This SOP is a *manual policy*. It is **not** the XGBoost model's output, and it does not change when the model is retrained. The XGBoost model (see `README.md`) scores applicants automatically from 20 fields; this SOP is your own human-applied scoring guideline. Use `scripts/verify_sop.py` to compare manual scores against the model (see *Verification* below).

> ⚠️ **Disclaimer:** For educational/demo use only. Not for real lending decisions.

---

## How Scoring Works

```
Base score (100)
   + points from each of the 20 applicant fields (positive = good, negative = bad)
= Total score
   → Grade (A–E) via the Grade Cutoffs table
   → Decision (APPROVE / MANUAL_REVIEW / NON-APPROVE) via the Decision Policy table
```

## How to Use This SOP

1. **Collect applicant data** for all 20 fields listed in Appendix B (use the exact allowed values — scoring is case-sensitive).
2. **Look up points** for each field in the Points Tables below. For numeric fields, find the band that contains the applicant's value (bands are inclusive: `12-24` means 12 to 24).
3. **Compute the total:** `Total = Base score + sum of all 20 field points`.
4. **Assign the grade** from the Grade Cutoffs table.
5. **Apply the decision** from the Decision Policy table.

---

## Points Tables (EDIT THESE)

> **This is your policy.** Fill in the `Points` column with your own values
> (positive = lowers risk, negative = raises risk). Leave a cell empty = 0 points.
> Appendix A shows how the XGBoost model weighs each attribute — use it as a
> reference when deciding your points, then tune to your own risk appetite.
>
> `scripts/verify_sop.py` reads the tables **directly from this file**, so any
> edit here is immediately verifiable against the model.

### Scoring Parameters

| Parameter | Value |
|-----------|-------|
| Base score | 100 |

### Categorical Fields

Values marked `*` are the model's baseline (reference) category for that field — in the XGBoost model these are exactly "average", which is a natural candidate for **0 points** in your manual system too.

| Field | Value | Points |
|-------|-------|--------|
| checking_status | 0<=X<200 * | 123 |
| checking_status | <0 | -40 |
| checking_status | >=200 | |
| checking_status | no checking | |
| credit_history | all paid * | |
| credit_history | critical/other existing credit | |
| credit_history | delayed previously | |
| credit_history | existing paid | |
| credit_history | no credits/all paid | |
| purpose | business * | |
| purpose | domestic appliance | |
| purpose | education | |
| purpose | furniture/equipment | |
| purpose | new car | |
| purpose | other | |
| purpose | radio/tv | |
| purpose | repairs | |
| purpose | retraining | |
| purpose | used car | |
| savings_status | 100<=X<500 * | |
| savings_status | 500<=X<1000 | |
| savings_status | <100 | |
| savings_status | >=1000 | |
| savings_status | no known savings | |
| employment | 1<=X<4 * | |
| employment | 4<=X<7 | |
| employment | <1 | |
| employment | >=7 | |
| employment | unemployed | |
| personal_status | female div/dep/mar * | |
| personal_status | male div/sep | |
| personal_status | male mar/wid | |
| personal_status | male single | |
| other_parties | co applicant * | |
| other_parties | guarantor | |
| other_parties | none | |
| property_magnitude | car * | |
| property_magnitude | life insurance | |
| property_magnitude | no known property | |
| property_magnitude | real estate | |
| other_payment_plans | bank * | |
| other_payment_plans | none | |
| other_payment_plans | stores | |
| housing | for free * | |
| housing | own | |
| housing | rent | |
| job | high qualif/self emp/mgmt * | |
| job | skilled | |
| job | unemp/unskilled non res | |
| job | unskilled resident | |
| own_telephone | none * | |
| own_telephone | yes | |
| foreign_worker | no * | |
| foreign_worker | yes | |

### Numeric Fields (Bands)

Find the applicant's value in the band; bands are checked top-to-bottom and are inclusive.

| Field | Band | Points |
|-------|------|--------|
| duration | <12 | |
| duration | 12-24 | |
| duration | 25-36 | |
| duration | 37-48 | |
| duration | >48 | |
| credit_amount | <1000 | |
| credit_amount | 1000-3000 | |
| credit_amount | 3001-5000 | |
| credit_amount | 5001-10000 | |
| credit_amount | >10000 | |
| installment_commitment | 1 | |
| installment_commitment | 2 | |
| installment_commitment | 3 | |
| installment_commitment | >3 | |
| residence_since | <2 | |
| residence_since | 2 | |
| residence_since | 3 | |
| residence_since | >3 | |
| age | <25 | |
| age | 25-35 | |
| age | 36-45 | |
| age | 46-60 | |
| age | >60 | |
| existing_credits | 1 | |
| existing_credits | 2 | |
| existing_credits | 3 | |
| existing_credits | >3 | |
| num_dependents | 1 | |
| num_dependents | 2 | |
| num_dependents | >2 | |

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

Applicant (first row of `data/credit_data_template.csv`):

| Field | Applicant value |
|-------|-----------------|
| checking_status | <0 |
| duration | 6 months |
| credit_history | critical/other existing credit |
| purpose | radio/tv |
| credit_amount | 1169 |
| savings_status | no known savings |
| employment | >=7 |
| installment_commitment | 4 |
| personal_status | male single |
| other_parties | none |
| residence_since | 4 years |
| property_magnitude | real estate |
| age | 67 |
| other_payment_plans | none |
| housing | own |
| existing_credits | 2 |
| job | skilled |
| num_dependents | 1 |
| own_telephone | yes |
| foreign_worker | yes |

**Step 1–2:** Look up each field's points. *The values below are EXAMPLE POINTS for illustration only — they are not the real table above.*

| Field | Value | Example points |
|-------|-------|----------------|
| checking_status | <0 | −8 |
| duration | 6 (<12) | +6 |
| credit_history | critical/other existing credit | +7 |
| purpose | radio/tv | +3 |
| credit_amount | 1169 (1000-3000) | +4 |
| savings_status | no known savings | +5 |
| employment | >=7 | +3 |
| installment_commitment | 4 (>3) | −4 |
| personal_status | male single | +1 |
| other_parties | none | 0 |
| residence_since | 4 (>3) | 0 |
| property_magnitude | real estate | +2 |
| age | 67 (>60) | +2 |
| other_payment_plans | none | +1 |
| housing | own | +1 |
| existing_credits | 2 | −1 |
| job | skilled | 0 |
| num_dependents | 1 | 0 |
| own_telephone | yes | +1 |
| foreign_worker | yes | 0 |

**Step 3:** Total = 100 + (−8 +6 +7 +3 +4 +5 +3 −4 +1 +0 +0 +2 +2 +1 +1 −1 +0 +0 +1 +0) = **123**

**Step 4:** 123 ≥ 100 → **Grade A**

**Step 5:** Grade A → **APPROVE**

*For reference: the XGBoost model scores this same applicant at P(default) = 1.8% → Grade A → APPROVE — the manual example agrees with the model.* ✅

---

## Verification

The SOP tables above are machine-readable. To check how well your manual policy agrees with the XGBoost model:

```bash
python scripts/verify_sop.py --demo                          # built-in demo applicant
python scripts/verify_sop.py --file path/to/applicant.json   # one applicant as JSON
python scripts/verify_sop.py --file applicants.csv           # or CSV (all rows)
```

The script parses the Points Tables directly from **this file**, computes the manual score, and prints it side-by-side with the model's probability, grade, and decision. Fields with empty `Points` cells count as 0 and are listed as warnings — so you can fill the tables in gradually and watch the agreement improve.

---

## Appendix A — Model Reference Impacts

Measured from the trained XGBoost model (SHAP analysis over the 1,000-row training dataset). Unit is **log-odds of default** for applicants with that value/band:

- **Positive** value → the model sees this as **risk-raising** → consider **negative points**
- **Negative** value → the model sees this as **protective** → consider **positive points**
- Magnitude = strength. Rough guide: `±0.1` weak, `±0.3` moderate, `±0.6+` strong

### Categorical fields (mean impact of each value)

| Field | Value | Model impact (log-odds) |
|-------|-------|--------------------------|
| checking_status | 0<=X<200 * | +0.265 |
| checking_status | <0 | +0.737 |
| checking_status | >=200 | +0.037 |
| checking_status | no checking | −1.199 |
| credit_history | all paid * | +0.221 |
| credit_history | critical/other existing credit | −0.697 |
| credit_history | delayed previously | +0.220 |
| credit_history | existing paid | +0.091 |
| credit_history | no credits/all paid | +0.412 |
| purpose | business * | +0.009 |
| purpose | domestic appliance | −0.042 |
| purpose | education | +0.621 |
| purpose | furniture/equipment | +0.066 |
| purpose | new car | +0.110 |
| purpose | other | +0.033 |
| purpose | radio/tv | −0.280 |
| purpose | repairs | −0.047 |
| purpose | retraining | −0.033 |
| purpose | used car | −0.779 |
| savings_status | 100<=X<500 * | −0.238 |
| savings_status | 500<=X<1000 | −0.482 |
| savings_status | <100 | +0.223 |
| savings_status | >=1000 | −1.193 |
| savings_status | no known savings | −0.616 |
| employment | 1<=X<4 * | +0.022 |
| employment | 4<=X<7 | −0.787 |
| employment | <1 | +0.296 |
| employment | >=7 | −0.183 |
| employment | unemployed | +0.379 |
| personal_status | female div/dep/mar * | +0.096 |
| personal_status | male div/sep | +0.271 |
| personal_status | male mar/wid | +0.059 |
| personal_status | male single | −0.147 |
| other_parties | co applicant * | +0.074 |
| other_parties | guarantor | −0.530 |
| other_parties | none | +0.010 |
| property_magnitude | car * | +0.010 |
| property_magnitude | life insurance | +0.007 |
| property_magnitude | no known property | +0.154 |
| property_magnitude | real estate | −0.257 |
| other_payment_plans | bank * | +0.607 |
| other_payment_plans | none | −0.222 |
| other_payment_plans | stores | +0.501 |
| housing | for free * | +0.033 |
| housing | own | −0.153 |
| housing | rent | +0.436 |
| job | high qualif/self emp/mgmt * | −0.027 |
| job | skilled | −0.031 |
| job | unemp/unskilled non res | −0.013 |
| job | unskilled resident | −0.000 |
| own_telephone | none * | +0.071 |
| own_telephone | yes | −0.167 |
| foreign_worker | no * | −0.795 |
| foreign_worker | yes | +0.015 |

### Numeric fields (mean impact per band)

| Field | Band | Model impact (log-odds) |
|-------|------|--------------------------|
| duration | <12 | −1.102 |
| duration | 12-24 | −0.039 |
| duration | 25-36 | +0.441 |
| duration | 37-48 | +0.172 |
| duration | >48 | +0.022 |
| credit_amount | <1000 | +0.230 |
| credit_amount | 1000-3000 | −0.378 |
| credit_amount | 3001-5000 | −0.540 |
| credit_amount | 5001-10000 | −0.056 |
| credit_amount | >10000 | +0.554 |
| installment_commitment | 1 | −0.338 |
| installment_commitment | 2 | −0.285 |
| installment_commitment | 3 | +0.086 |
| installment_commitment | >3 | +0.128 |
| residence_since | <2 | −0.071 |
| residence_since | 2 | −0.017 |
| residence_since | 3 | −0.010 |
| residence_since | >3 | −0.062 |
| age | <25 | −0.009 |
| age | 25-35 | −0.066 |
| age | 36-45 | −0.300 |
| age | 46-60 | −0.195 |
| age | >60 | −0.186 |
| existing_credits | 1 | −0.062 |
| existing_credits | 2 | +0.073 |
| existing_credits | 3 | +0.079 |
| existing_credits | >3 | +0.023 |
| num_dependents | 1 | −0.021 |
| num_dependents | 2 | +0.068 |
| num_dependents | >2 | (no data) |

*Note:* some impacts look counter-intuitive (e.g. age bands, `foreign_worker`) — that is what the model learned from this small 1,000-row dataset. Treat these as reference signals, not ground truth, and adjust your manual points to your own judgment and regulatory constraints (in particular, be careful using attributes that may be legally protected, such as age, personal status, or foreign worker status, in real policies).

---

## Appendix B — Field Dictionary

| # | Field | Type | Description / unit |
|---|-------|------|--------------------|
| 1 | checking_status | categorical | Status of existing checking account |
| 2 | duration | numeric | Loan duration in months |
| 3 | credit_history | categorical | Credit history of the applicant |
| 4 | purpose | categorical | Purpose of the loan |
| 5 | credit_amount | numeric | Loan amount in DM |
| 6 | savings_status | categorical | Status of savings account/bonds |
| 7 | employment | categorical | Present employment since |
| 8 | installment_commitment | numeric | Installment rate (% of disposable income) |
| 9 | personal_status | categorical | Personal status and sex |
| 10 | other_parties | categorical | Other debtors / guarantors |
| 11 | residence_since | numeric | Present residence since (years) |
| 12 | property_magnitude | categorical | Property ownership |
| 13 | age | numeric | Age in years |
| 14 | other_payment_plans | categorical | Other installment plans |
| 15 | housing | categorical | Housing situation |
| 16 | existing_credits | numeric | Number of existing credits at this bank |
| 17 | job | categorical | Job type / skill level |
| 18 | num_dependents | numeric | Number of dependents |
| 19 | own_telephone | categorical | Has a telephone registered under their name |
| 20 | foreign_worker | categorical | Foreign worker status |

---

## Maintenance Notes

- **Your points, your policy:** the Points Tables, Grade Cutoffs, and Decision Policy are entirely yours to define and tune. The appendix values are only a starting reference from the current model.
- **Model retraining:** if the XGBoost model is retrained (e.g. `POST /api/retrain`), Appendix A becomes stale. Re-run the SHAP analysis to refresh it; the manual tables are *not* updated automatically and will not drift unless you edit them.
- **Changing fields or bands:** if you add/remove fields or change band edges, update this file *and* keep it consistent with `data/credit_data_template.csv` so the verifier keeps working.

# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: **hiring managers, recruiters, and interviewers** watching a demo of the system, plus technically literate reviewers evaluating the author's ML + product craft. Secondary: the author themselves, driving the demo live under observation. The UI must therefore impress on first sight *and* hold up when the reviewer asks "show me how it handles drift / retraining / a bad applicant."

## Product Purpose

An **AI credit scoring system**: a local pipeline that predicts loan-default probability (XGBoost), explains each prediction with SHAP, and generates human-readable credit memos via a local LLM (Ollama or vLLM). The React web UI is the product's face: applicant scoring with a decision banner, a deterministic what-if simulator, batch scoring with PSI drift monitoring, an editable manual scoring SOP, and settings/retraining controls. Success in the primary context means a reviewer immediately grasps what the system does, trusts what it shows, and remembers it as unusually complete for a side project.

## Positioning

A neighboring credit-scoring demo could copy the model; it could not truthfully copy "**fully local, end-to-end explainable scoring**": SHAP explanations on every prediction, LLM-written credit memos that are *machine-verified* for faithfulness against the structured evidence, population-drift monitoring with one-click retraining, and a human points-based SOP that sits alongside the model as a cross-check — all running offline on the demonstrator's own machine.

## Operating Context

- Runs locally: FastAPI backend serves the built app at `http://localhost:8000` (production) or Vite dev server at `:5173` with `/api` proxied.
- Docker Compose provides an all-in-one demo (first run pulls a ~4.7 GB LLM).
- LLM is optional: when Ollama/vLLM is unreachable, memo generation falls back to cached demo memos (`demo_cache/memos.json`) streamed identically, with a visible "demo memo" badge.
- Pre-made batch demo files: `demo_data/stable_portfolio.csv` (no drift) and `demo_data/drifted_portfolio.csv` (triggers drift alert).
- Settings persist to `settings.json` in the project root; `OLLAMA_URL`/`OLLAMA_MODEL` env vars override the stored LLM connection.
- Demonstrated live in interviews — the operator narrates while clicking; load time and offline robustness matter.

## Capabilities and Constraints

Confirmed functionality (must be preserved in any redesign):

- **Predict page**: auto-generated applicant form from the training-data schema → probability gauge, risk grade (A–E), mockup APPROVE / MANUAL REVIEW / NON-APPROVE decision banner, SHAP factor bars (risk + protective), one-click LLM credit memo with copyable raw prompt fallback.
- **What-If Simulator** (on Predict): counterfactual re-scoring of top risk factors → instant re-prediction, plus the minimal single-feature change that would improve the grade. Deterministic, no LLM.
- **Memo verification** (on Predict): after a memo streams, a second LLM pass audits every factual claim against structured evidence and shows an "N/M claims grounded" badge.
- **Batch page**: CSV/XLSX upload → scored table with decisions + PSI drift monitoring per feature vs. training distribution (stable / warning / drift) with a retrain shortcut.
- **SOP page**: edit the manual points guideline (`docs/SCORING_SOP.md`) and verify applicants against the model.
- **Settings page**: approve/decline probability thresholds, Ollama URL + model dropdown (auto-lists installed models), prompt-template editor with placeholders, XGBoost hyperparameters, current model metrics, Save & Retrain with live status.

Constraints and terminology:

- Risk grades **A–E** mapped from probability thresholds (`SCORE_BINS`/`SCORE_LABELS`); decision banner is explicitly a **mockup** for demo purposes.
- Terminology in use: risk grade, default probability, SHAP / risk & protective factors, PSI drift, credit memo, SOP.
- **Offline-first:** the app must work without internet (Docker/local demo). Web fonts must be **bundled locally**, not loaded from a CDN. (User-confirmed decision.)
- Real model metrics exist (test AUC ≈ 0.86 on the shipped dataset) and may be shown; they are evidence, not marketing copy.
- Educational disclaimer must remain visible in appropriate places: *"For educational/side-project use only. Not financial advice. Do not use for real lending decisions without regulatory review."*

## Brand Commitments

- Product name: **AI Credit Scoring System**. No logo, no existing brand identity, no voice guide beyond what the repo documents.
- Existing repo voice: factual, technical, understated (README and UI copy). No emojis in UI (Lucide icons only) — a standing commitment carried from the incumbent design doc.
- No invented testimonials, customers, benchmarks, or pricing may appear anywhere.

## Evidence on Hand

- Real artifacts: trained model + `models/metrics.json`, SHAP summary plot (`output/shap_summary.png`), evaluation plots, demo portfolios, cached demo memos.
- Absences that must not be fabricated: no customer logos, no case studies, no press, no team page, no pricing.

## Product Principles

1. **Local-first, private, offline-capable.** Everything a reviewer sees runs on the demonstrator's machine; degradation paths (demo memo cache) are honest and labeled.
2. **Explainability is the product.** Every score carries its reasons (SHAP), every memo carries its verification — the UI must make evidence visible, not hide it behind a number.
3. **Production thinking on display.** Drift monitoring, retraining, thresholds, and a human SOP cross-check are first-class screens, not footnotes — they are what separates this from a notebook demo.
4. **Honest by design.** Mockup decisions, demo badges, and the educational disclaimer stay visible; never blur simulated and real.
5. **Demo-grade performance.** Fast load, no jank during a live interview, no dependency on the network.

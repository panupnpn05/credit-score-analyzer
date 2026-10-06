"""Population Stability Index (PSI) drift detection.

Compares the distribution of incoming scoring data (batch uploads) against the
training distribution, per feature. PSI < 0.1 = stable, 0.1-0.25 = warning,
> 0.25 = significant drift (bank-standard thresholds). The newest report is
kept in memory so the UI can surface a "consider retraining" alert.
"""

import threading

import numpy as np

import config

_lock = threading.Lock()
_ref = None  # cached training numeric frame + decile bin edges per feature


def _training_ref(n_bins=10):
    """Training numeric frame + per-feature decile bin edges, cached."""
    global _ref
    with _lock:
        if _ref is None:
            from data_loader import load_training_data
            df = load_training_data().drop(columns=[config.TARGET_COLUMN], errors="ignore")
            numeric = df.select_dtypes(include="number").astype(float)
            bins = {}
            for col in numeric.columns:
                qs = np.nanpercentile(numeric[col].to_numpy(), np.linspace(0, 100, n_bins + 1))
                qs[0], qs[-1] = -np.inf, np.inf
                bins[col] = np.unique(qs)  # dedupe degenerate/constant columns
            _ref = {"frame": numeric, "bins": bins}
        return _ref


def psi(expected: np.ndarray, actual: np.ndarray, bins) -> float:
    """Population Stability Index over fixed bins.

    Both distributions are clipped away from 0 so log() stays finite.
    """
    expected = np.asarray(expected, dtype=float)
    actual = np.asarray(actual, dtype=float)
    expected = expected[~np.isnan(expected)]
    actual = actual[~np.isnan(actual)]
    if len(expected) == 0 or len(actual) < 5 or len(bins) < 2:
        return float("nan")
    e = np.histogram(expected, bins)[0] / len(expected)
    a = np.histogram(actual, bins)[0] / len(actual)
    e = np.clip(e, 1e-4, None)
    a = np.clip(a, 1e-4, None)
    return float(np.sum((a - e) * np.log(a / e)))


def _status(value: float) -> str:
    if np.isnan(value):
        return "unknown"
    if value < 0.1:
        return "stable"
    if value <= 0.25:
        return "warning"
    return "drift"


def compute_drift(df, n_bins=10) -> dict:
    """PSI report for a scored DataFrame vs. the training distribution.

    PSI is positively biased for small samples (~(k-1)/n under no drift), so
    we subtract that bias before applying the bank-standard thresholds.
    """
    ref = _training_ref()
    n = int(len(df))
    bias = (len(next(iter(ref["bins"].values()))) - 1) / max(n, 1)
    rows = []
    for col, bins in ref["bins"].items():
        if col not in df.columns:
            continue
        try:
            raw = psi(ref["frame"][col].to_numpy(), df[col].astype(float).to_numpy(), bins)
            value = max(0.0, raw - bias)  # small-sample bias correction
        except Exception:
            continue
        rows.append({
            "feature": col,
            "psi": None if np.isnan(value) else round(value, 4),
            "status": _status(value),
        })

    rows.sort(key=lambda r: (r["psi"] is None, -(r["psi"] or 0)))
    worst = next((r["psi"] for r in rows if r["psi"] is not None), None)
    return {
        "rows": rows,
        "checked": len(rows),
        "sample_size": n,
        "overall_psi": worst,
        "overall_status": _status(worst) if worst is not None else "unknown",
        "note": "PSI bias-corrected for sample size; thresholds: <0.1 stable, 0.1-0.25 warning, >0.25 drift.",
    }

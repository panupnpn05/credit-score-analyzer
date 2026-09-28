"""XGBoost model training with credit-risk metrics."""

import os
import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.metrics import (
    roc_auc_score, accuracy_score, precision_score, recall_score,
    f1_score, classification_report, confusion_matrix, roc_curve,
)
import matplotlib.pyplot as plt
import seaborn as sns
import joblib

import config


def train_model(X_train, y_train, X_val, y_val, feature_names, params=None):
    """Train XGBoost with early stopping."""
    params = params or config.MODEL_PARAMS
    model = xgb.XGBClassifier(**params)

    print("Training XGBoost...")
    model.fit(
        X_train, y_train,
        eval_set=[(X_val, y_val)],
        verbose=50,
    )
    print(f"Best iteration: {model.best_iteration} | Best score: {model.best_score:.4f}")
    return model


def calculate_ks(y_true, y_proba):
    """Kolmogorov-Smirnov statistic."""
    from scipy import stats
    y_true = np.asarray(y_true)
    pos = y_proba[y_true == 1]
    neg = y_proba[y_true == 0]
    if len(pos) == 0 or len(neg) == 0:
        return 0.0
    return stats.ks_2samp(pos, neg)[0]


def calculate_gini(y_true, y_proba):
    """Gini = 2*AUC - 1."""
    return 2 * roc_auc_score(y_true, y_proba) - 1


def evaluate_model(model, X, y, dataset_name="Test", save_plots_dir=None):
    """Evaluate with credit-risk metrics."""
    y_proba = model.predict_proba(X)[:, 1]
    y_pred = (y_proba >= 0.5).astype(int)

    auc = roc_auc_score(y, y_proba)
    gini = calculate_gini(y, y_proba)
    ks = calculate_ks(y, y_proba)

    print(f"\n{'='*50}")
    print(f"Evaluation: {dataset_name}")
    print(f"{'='*50}")
    print(f"AUC-ROC:  {auc:.4f}")
    print(f"Gini:     {gini:.4f}")
    print(f"KS:       {ks:.4f}")
    print(f"F1:       {f1_score(y, y_pred, zero_division=0):.4f}")
    print(classification_report(y, y_pred, target_names=["Non-Default", "Default"]))

    if save_plots_dir:
        os.makedirs(save_plots_dir, exist_ok=True)
        _plot_roc(y, y_proba, dataset_name, save_plots_dir)
        _plot_confusion(y, y_pred, dataset_name, save_plots_dir)
        _plot_distribution(y, y_proba, dataset_name, save_plots_dir)

    return {"auc": float(auc), "gini": float(gini), "ks": float(ks), "f1": float(f1_score(y, y_pred, zero_division=0))}


def _plot_roc(y_true, y_proba, name, save_dir):
    fpr, tpr, _ = roc_curve(y_true, y_proba)
    plt.figure(figsize=(8, 6))
    plt.plot(fpr, tpr, label=f"AUC = {roc_auc_score(y_true, y_proba):.4f}", linewidth=2)
    plt.plot([0, 1], [0, 1], "k--")
    plt.xlabel("False Positive Rate")
    plt.ylabel("True Positive Rate")
    plt.title(f"ROC Curve - {name}")
    plt.legend()
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    plt.savefig(os.path.join(save_dir, f"roc_{name.lower()}.png"), dpi=150)
    plt.close()


def _plot_confusion(y_true, y_pred, name, save_dir):
    cm = confusion_matrix(y_true, y_pred)
    plt.figure(figsize=(6, 5))
    sns.heatmap(cm, annot=True, fmt="d", cmap="Blues", cbar=False)
    plt.xlabel("Predicted")
    plt.ylabel("Actual")
    plt.title(f"Confusion Matrix - {name}")
    plt.tight_layout()
    plt.savefig(os.path.join(save_dir, f"cm_{name.lower()}.png"), dpi=150)
    plt.close()


def _plot_distribution(y_true, y_proba, name, save_dir):
    y_true = np.asarray(y_true)
    plt.figure(figsize=(10, 6))
    plt.hist(y_proba[y_true == 0], bins=50, alpha=0.6, label="Non-Default", color="green", density=True)
    plt.hist(y_proba[y_true == 1], bins=50, alpha=0.6, label="Default", color="red", density=True)
    plt.xlabel("Default Probability")
    plt.ylabel("Density")
    plt.title(f"Score Distribution - {name}")
    plt.legend()
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    plt.savefig(os.path.join(save_dir, f"dist_{name.lower()}.png"), dpi=150)
    plt.close()


def save_model(model, path):
    joblib.dump(model, path)
    print(f"Model saved to {path}")


def load_model(path):
    return joblib.load(path)

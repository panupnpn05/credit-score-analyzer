"""Main training script."""

import os
import json

import config
from data_loader import load_training_data, get_feature_target, split_data
from features import prepare_pipeline, transform_data
from model import train_model, evaluate_model, save_model
from explainer import build_explainer
import shap
import matplotlib.pyplot as plt


def main():
    print("=" * 60)
    print("CREDIT SCORING - TRAINING PIPELINE (XGBoost)")
    print("=" * 60)

    # 1. Load data (from config.TRAIN_DATA_FILE, or built-in German Credit)
    df = load_training_data()

    # 2. Split
    X, y = get_feature_target(df)
    X_train, X_val, X_test, y_train, y_val, y_test = split_data(X, y)

    # 3. Preprocessing
    print("\nFitting preprocessor...")
    preprocessor_path = os.path.join(config.MODEL_DIR, "preprocessor.joblib")
    preprocessor, feature_names = prepare_pipeline(X_train, save_path=preprocessor_path)
    print(f"Total features: {len(feature_names)}")

    X_train_t = transform_data(preprocessor, X_train)
    X_val_t = transform_data(preprocessor, X_val)
    X_test_t = transform_data(preprocessor, X_test)

    # 4. Train
    print("\nTraining model...")
    model = train_model(X_train_t, y_train, X_val_t, y_val, feature_names)

    # 5. Evaluate
    print("\nEvaluating...")
    metrics_val = evaluate_model(model, X_val_t, y_val, "Validation", config.OUTPUT_DIR)
    metrics_test = evaluate_model(model, X_test_t, y_test, "Test", config.OUTPUT_DIR)

    # 6. Save
    model_path = os.path.join(config.MODEL_DIR, "credit_model.joblib")
    save_model(model, model_path)

    metrics = {"validation": metrics_val, "test": metrics_test, "features": len(feature_names)}
    with open(os.path.join(config.MODEL_DIR, "metrics.json"), "w") as f:
        json.dump(metrics, f, indent=2)

    # 7. SHAP summary plot
    print("\nGenerating SHAP summary...")
    explainer = build_explainer(model, X_train_t[:100])
    X_sample = X_test_t[:200]
    shap_values = explainer.shap_values(X_sample)
    if isinstance(shap_values, list):
        shap_values = shap_values[1]

    plt.figure(figsize=(10, 8))
    shap.summary_plot(shap_values, X_sample, feature_names=feature_names, show=False, max_display=15)
    plt.tight_layout()
    plt.savefig(os.path.join(config.OUTPUT_DIR, "shap_summary.png"), dpi=150, bbox_inches="tight")
    plt.close()
    print("SHAP summary saved.")

    print("\n" + "=" * 60)
    print("TRAINING COMPLETE")
    print(f"Model: {model_path}")
    print(f"Output: {config.OUTPUT_DIR}")
    print("Next: python predict.py --demo")


if __name__ == "__main__":
    main()

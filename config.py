"""Configuration for Credit Scoring Pipeline."""

import os

# Paths
DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
MODEL_DIR = os.path.join(os.path.dirname(__file__), "models")
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "output")

os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(MODEL_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Training data file (CSV or XLSX). Set to None to use built-in German Credit.
TRAIN_DATA_FILE = os.path.join(DATA_DIR, "credit_data.csv")

# Name of the target column in your file (1 = default, 0 = non-default)
TARGET_COLUMN = "default"

# Risk score bins (probability thresholds)
SCORE_BINS = [0, 0.2, 0.4, 0.6, 0.8, 1.0]
SCORE_LABELS = ["A", "B", "C", "D", "E"]

# XGBoost hyperparameters
MODEL_PARAMS = {
    "objective": "binary:logistic",
    "eval_metric": ["auc", "logloss"],
    "max_depth": 6,
    "learning_rate": 0.05,
    "n_estimators": 1000,
    "subsample": 0.8,
    "colsample_bytree": 0.8,
    "scale_pos_weight": 3.0,
    "random_state": 42,
    "n_jobs": -1,
    "early_stopping_rounds": 50,
}

# Train/test split
TEST_SIZE = 0.2
RANDOM_STATE = 42

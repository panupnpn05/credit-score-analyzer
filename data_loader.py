"""Data loading from CSV/XLSX files, with built-in German Credit fallback."""

import os
import pandas as pd
from typing import Tuple
from sklearn.model_selection import train_test_split
from sklearn.datasets import fetch_openml

import config


def load_from_file(path: str, target_col: str = config.TARGET_COLUMN) -> pd.DataFrame:
    """Load training data from a CSV or Excel file."""
    if not os.path.exists(path):
        raise FileNotFoundError(
            f"Training file not found: {path}\n"
            f"Place your dataset there or set TRAIN_DATA_FILE = None in config.py "
            f"to use the built-in German Credit dataset."
        )
    if path.lower().endswith((".xlsx", ".xls")):
        df = pd.read_excel(path)
    else:
        df = pd.read_csv(path)

    if target_col not in df.columns:
        raise ValueError(
            f"Target column '{target_col}' not found. "
            f"Columns present: {list(df.columns)}\n"
            f"Rename your target column or set TARGET_COLUMN in config.py."
        )
    print(f"Loaded: {df.shape[0]} rows | Default rate: {df[target_col].mean():.1%}")
    return df


def load_german_credit() -> pd.DataFrame:
    """Load UCI German Credit dataset (1000 rows, built-in) and save as CSV template."""
    print("Loading German Credit dataset...")
    X, y = fetch_openml("credit-g", version=1, as_frame=True, parser="auto", return_X_y=True)
    df = X.copy()
    df["default"] = (y == "bad").astype(int)

    template_path = os.path.join(config.DATA_DIR, "credit_data_template.csv")
    df.to_csv(template_path, index=False)
    print(f"Template saved to {template_path} (use this format for your own data)")
    print(f"Loaded: {df.shape[0]} rows | Default rate: {df['default'].mean():.1%}")
    return df


def load_training_data() -> pd.DataFrame:
    """Load from configured file if set, else fall back to German Credit."""
    if config.TRAIN_DATA_FILE and os.path.exists(config.TRAIN_DATA_FILE):
        return load_from_file(config.TRAIN_DATA_FILE)
    if config.TRAIN_DATA_FILE:
        print(f"No file at {config.TRAIN_DATA_FILE}, falling back to German Credit.")
    return load_german_credit()


def get_feature_target(df: pd.DataFrame, target_col: str = config.TARGET_COLUMN) -> Tuple[pd.DataFrame, pd.Series]:
    """Separate features and target."""
    y = df[target_col].copy()
    X = df.drop(columns=[target_col])
    return X, y


def split_data(X: pd.DataFrame, y: pd.Series):
    """Train/validation/test split (60/20/20)."""
    X_train, X_temp, y_train, y_temp = train_test_split(
        X, y, test_size=config.TEST_SIZE * 2, random_state=config.RANDOM_STATE, stratify=y
    )
    X_val, X_test, y_val, y_test = train_test_split(
        X_temp, y_temp, test_size=0.5, random_state=config.RANDOM_STATE, stratify=y_temp
    )
    print(f"Train: {len(X_train)} | Val: {len(X_val)} | Test: {len(X_test)}")
    return X_train, X_val, X_test, y_train, y_val, y_test

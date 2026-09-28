"""Feature engineering and preprocessing pipeline."""

import pandas as pd
import numpy as np
from typing import Tuple, Optional
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
import joblib


def identify_column_types(X: pd.DataFrame) -> Tuple[list, list]:
    """Identify numeric and categorical columns."""
    numeric_cols = X.select_dtypes(include=[np.number]).columns.tolist()
    categorical_cols = X.select_dtypes(include=["object", "category"]).columns.tolist()
    return numeric_cols, categorical_cols


def build_preprocessor(numeric_cols: list, categorical_cols: list) -> ColumnTransformer:
    """Build sklearn preprocessing pipeline."""
    numeric_pipeline = Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("scaler", StandardScaler()),
    ])

    categorical_pipeline = Pipeline([
        ("imputer", SimpleImputer(strategy="most_frequent")),
        ("onehot", OneHotEncoder(handle_unknown="ignore", sparse_output=False, drop="first")),
    ])

    preprocessor = ColumnTransformer([
        ("num", numeric_pipeline, numeric_cols),
        ("cat", categorical_pipeline, categorical_cols),
    ], remainder="drop")

    return preprocessor


def prepare_pipeline(X_train: pd.DataFrame, save_path: Optional[str] = None):
    """Fit preprocessor on training data and optionally save."""
    numeric_cols, categorical_cols = identify_column_types(X_train)
    print(f"Numeric: {len(numeric_cols)} | Categorical: {len(categorical_cols)}")

    preprocessor = build_preprocessor(numeric_cols, categorical_cols)
    preprocessor.fit(X_train)

    feature_names = numeric_cols.copy()
    cat_encoder = preprocessor.named_transformers_["cat"].named_steps["onehot"]
    cat_features = cat_encoder.get_feature_names_out(categorical_cols)
    feature_names.extend(cat_features)

    if save_path:
        joblib.dump({"preprocessor": preprocessor, "feature_names": feature_names}, save_path)
        print(f"Preprocessor saved to {save_path}")

    return preprocessor, feature_names


def transform_data(preprocessor: ColumnTransformer, X: pd.DataFrame) -> np.ndarray:
    """Transform dataframe using fitted preprocessor."""
    return preprocessor.transform(X)

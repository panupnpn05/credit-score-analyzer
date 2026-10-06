"""Pydantic schemas for the API."""

from typing import Dict, Any, List, Optional

from pydantic import BaseModel, Field


class PredictRequest(BaseModel):
    applicant: Dict[str, Any]
    applicant_id: Optional[str] = "APP_0001"


class MemoRequest(BaseModel):
    applicant: Dict[str, Any] = {}
    applicant_id: Optional[str] = "APP_0001"
    llm_prompt: Optional[str] = None  # reuse prompt from predict to skip re-scoring


class WhatIfRequest(BaseModel):
    applicant: Dict[str, Any]
    modifications: Dict[str, Any] = {}  # feature -> hypothetical new value


class MemoVerifyRequest(BaseModel):
    memo_text: str
    evidence: Dict[str, Any]  # predict result fields used as ground truth


class DecisionSettings(BaseModel):
    approve_threshold: float = Field(0.20, ge=0.0, le=1.0)
    decline_threshold: float = Field(0.40, ge=0.0, le=1.0)


class LLMSettings(BaseModel):
    enabled: bool = False
    ollama_url: str = "http://localhost:11434"
    model: str = "qwen2.5:7b"
    prompt_template: str = ""
    num_predict: int = Field(1200, ge=16, le=8192)
    temperature: float = Field(0.3, ge=0.0, le=2.0)
    keep_alive: str = "10m"
    include_sop: bool = True  # append the manual scoring SOP + this applicant's SOP breakdown to memo prompts


class XGBoostSettings(BaseModel):
    max_depth: int = Field(6, ge=1, le=16)
    learning_rate: float = Field(0.05, gt=0, le=1)
    n_estimators: int = Field(1000, ge=10, le=10000)
    subsample: float = Field(0.8, gt=0, le=1)
    colsample_bytree: float = Field(0.8, gt=0, le=1)
    scale_pos_weight: float = Field(3.0, ge=0)
    early_stopping_rounds: int = Field(50, ge=1, le=1000)


class SettingsUpdate(BaseModel):
    decision: Optional[DecisionSettings] = None
    llm: Optional[LLMSettings] = None
    xgboost: Optional[XGBoostSettings] = None


class SopCategoricalRow(BaseModel):
    field: str
    value: str
    baseline: bool = False
    points: Optional[float] = None  # None = blank cell (unassigned, counts as 0)


class SopNumericRow(BaseModel):
    field: str
    band: str  # '<12', '12-24', '>48' or an exact value like '1'
    points: Optional[float] = None


class SopGradeRow(BaseModel):
    grade: str
    min: float
    max: float


class SopDecisionRow(BaseModel):
    grade: str
    decision: str


class SopUpdate(BaseModel):
    """Full replacement of the editable Points Tables section of the SOP."""
    base_score: float
    categorical: List[SopCategoricalRow]
    numeric: List[SopNumericRow]
    grades: List[SopGradeRow]
    decision: List[SopDecisionRow]


class SopVerifyRequest(BaseModel):
    applicant: Dict[str, Any]

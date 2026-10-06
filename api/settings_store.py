"""Persistent settings store backed by settings.json in the project root."""

import json
import os
import threading

import config

SETTINGS_PATH = os.path.join(os.path.dirname(config.DATA_DIR), "settings.json")

_lock = threading.Lock()

DEFAULT_PROMPT_TEMPLATE = """You are a senior credit risk analyst. Write a concise, professional credit risk assessment.

Applicant ID: {applicant_id}
Predicted Default Probability: {probability}
Risk Grade: {grade}
{applicant_summary}

Key Risk Factors:
{risk_factors}

Key Protective Factors:
{protective_factors}

คำสั่ง (Instructions):
- ตอบเป็นภาษาไทยเท่านั้น (Respond entirely in Thai)
- จัดรูปแบบคำตอบเป็น Markdown ใช้หัวข้อ (##), bullet points และ **ตัวหนา** สำหรับตัวเลขสำคัญ
- เขียนประมาณ 200 คำ
- อธิบายว่าปัจจัยเสี่ยงแต่ละข้อสำคัญอย่างไรในภาษาที่เข้าใจง่าย
- กล่าวถึงจุดแข็งที่ช่วยลดความเสี่ยงด้วย
- ห้ามสรุปผลอนุมัติหรือปฏิเสธสินเชื่อ — ประเมินความเสี่ยงเท่านั้น
"""

# Previous default, kept for migrating existing settings.json files
_LEGACY_PROMPT_TEMPLATE = """You are a senior credit risk analyst. Write a concise, professional credit risk assessment.

Applicant ID: {applicant_id}
Predicted Default Probability: {probability}
Risk Grade: {grade}
{applicant_summary}

Key Risk Factors:
{risk_factors}

Key Protective Factors:
{protective_factors}

Instructions:
- Write 2-3 paragraphs in professional banking language.
- Explain WHY the risk factors matter in plain language.
- Mention any mitigating strengths.
- Do NOT make a final approve/reject recommendation; only assess risk.
- Keep it under 200 words.
"""

DEFAULTS = {
    "decision": {
        "approve_threshold": 0.20,   # below this -> APPROVE (mockup)
        "decline_threshold": 0.40,   # above this -> NON-APPROVE (mockup)
    },
    "llm": {
        "enabled": False,
        "ollama_url": "http://localhost:11434",
        "model": "qwen2.5:7b",
        "prompt_template": DEFAULT_PROMPT_TEMPLATE,
        "num_predict": 1200,  # Thai output needs ~2-3x more tokens than English
        "temperature": 0.3,
        "keep_alive": "10m",
        "include_sop": True,  # append manual scoring SOP + this applicant's SOP breakdown to memo prompts
    },
    "xgboost": {
        "max_depth": 6,
        "learning_rate": 0.05,
        "n_estimators": 1000,
        "subsample": 0.8,
        "colsample_bytree": 0.8,
        "scale_pos_weight": 3.0,
        "early_stopping_rounds": 50,
    },
}


def deep_merge(base, override):
    out = dict(base)
    for k, v in (override or {}).items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = deep_merge(out[k], v)
        else:
            out[k] = v
    return out


def load_settings():
    with _lock:
        data = {}
        if os.path.exists(SETTINGS_PATH):
            try:
                with open(SETTINGS_PATH) as f:
                    data = json.load(f)
            except (json.JSONDecodeError, OSError):
                data = {}
        merged = deep_merge(DEFAULTS, data)
        template = merged["llm"].get("prompt_template", "")
        # Migrate the old default template to the Thai-markdown default;
        # leave user-customized templates untouched
        if not template or template.strip() == _LEGACY_PROMPT_TEMPLATE.strip():
            merged["llm"]["prompt_template"] = DEFAULT_PROMPT_TEMPLATE
        # Environment override (e.g. Docker: point at the ollama service host)
        env_ollama = os.environ.get("OLLAMA_URL")
        if env_ollama:
            merged["llm"]["ollama_url"] = env_ollama
        env_model = os.environ.get("OLLAMA_MODEL")
        if env_model:
            merged["llm"]["model"] = env_model
        return merged


def save_settings(settings):
    merged = deep_merge(DEFAULTS, settings)
    with _lock:
        with open(SETTINGS_PATH, "w") as f:
            json.dump(merged, f, indent=2)
    return merged

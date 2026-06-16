"""
Prahari Backend — Centralized LLM Models & Fallback Configurations
==================================================================
Defines the models and fallback chains for both Symptom Triage and Prescription OCR.
"""

# ---------------------------------------------------------------------------
# Supported Models Registry
# ---------------------------------------------------------------------------
# Map generic provider-agnostic identifiers to their specific model registry names.

GEMINI_MODELS = {
    "gemini-3.1-flash-lite": "gemini-3.1-flash-lite",
    "gemini-2.5-flash": "gemini-2.5-flash",
}

GROQ_MODELS = {
    "llama-3.3-70b-versatile": "llama-3.3-70b-versatile",
    "llama-4-scout": "meta-llama/llama-4-scout-17b-16e-instruct",
    "llama-3.1-8b-instant": "llama-3.1-8b-instant",
    "qwen-32b": "qwen/qwen3-32b",
}

# ---------------------------------------------------------------------------
# Fallback Chains Configurations
# ---------------------------------------------------------------------------
# The services iterate dynamically through these lists. 
# Re-ordering or editing these configurations will automatically change the 
# execution flow and models used.

OCR_FALLBACK_CHAIN = [
    {
        "tier": 1,
        "provider": "gemini",
        "model_name": "gemini-3.1-flash-lite",
        "description": "Primary multimodal OCR using Google Gemini Flash"
    },
    {
        "tier": 2,
        "provider": "groq",
        "model_name": "llama-3.3-70b-versatile",
        "description": "Fallback OCR using Groq Llama-Vision"
    },
    {
        "tier": 3,
        "provider": "local",
        "model_name": "tesseract",
        "description": "Offline fail-safe using local Tesseract OCR engine"
    }
]

TRIAGE_FALLBACK_CHAIN = [
    {
        "tier": 1,
        "provider": "infermedica",
        "model_name": "clinical-api",
        "description": "Primary clinically-grounded diagnostics via Infermedica"
    },
    {
        "tier": 2,
        "provider": "groq",
        "model_name": "llama-3.3-70b-versatile",
        "description": "Primary symptom check follow-ups using Groq Llama"
    },
    {
        "tier": 3,
        "provider": "gemini",
        "model_name": "gemini-3.1-flash-lite",
        "description": "Fallback symptom check using Google Gemini Flash"
    },
    {
        "tier": 4,
        "provider": "local",
        "model_name": "simulator",
        "description": "Fail-safe deterministic local symptom dialog simulator"
    }
]

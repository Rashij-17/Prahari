"""
Prahari (The Sentinel) — FastAPI Backend Entry Point
=====================================================
Application: MedLens — Medication Demystifier, Symptom Triage & Doctor Directory
Stack: FastAPI · Uvicorn · OpenCV · Tesseract · openFDA · RxNorm · Infermedica · Google Places
Author: Lead Systems Architect
Version: 0.1.0 (Phase 1 — Scaffold)

This file is the ASGI entry point consumed by Uvicorn.
It bootstraps the FastAPI application, registers CORS middleware,
and mounts all router modules (added in subsequent phases).
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# ---------------------------------------------------------------------------
# Application Factory
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Prahari — MedLens API",
    description=(
        "Backend engine for the Prahari health companion application. "
        "Provides OCR-based medication scanning, drug intelligence lookup, "
        "symptom triage, and geographic specialist directory capabilities."
    ),
    version="0.1.0",
    docs_url="/docs",        # Swagger UI available at http://localhost:8000/docs
    redoc_url="/redoc",      # ReDoc available at  http://localhost:8000/redoc
)

# ---------------------------------------------------------------------------
# CORS Middleware
# ---------------------------------------------------------------------------
# Allow the Vite React dev server (port 5173) to communicate with this API.
# In production, replace the wildcard origin with the exact frontend domain.

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",   # Vite default dev server
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],           # Allow all HTTP methods
    allow_headers=["*"],           # Allow all headers
)

# ---------------------------------------------------------------------------
# Core Routes
# ---------------------------------------------------------------------------

@app.get("/", tags=["Root"])
async def root() -> dict:
    """
    Root endpoint — confirms the API is reachable.
    Returns a welcome message with the application name.
    """
    return {
        "application": "Prahari — MedLens API",
        "version": "0.1.0",
        "message": "Sentinel is standing watch. Navigate to /docs for the API explorer.",
    }


@app.get("/health", tags=["Health"])
async def health_check() -> dict:
    """
    Health-check endpoint — used by monitoring systems and the frontend
    to verify backend availability before initiating heavy operations
    (e.g., camera scan submissions).

    Returns:
        dict: Status payload confirming the service is operational.
    """
    return {"status": "Sentinel Active"}


# ---------------------------------------------------------------------------
# Router Registration
# ---------------------------------------------------------------------------
# Phase 3 — Database Initialization
from models.db import init_db, SessionLocal
from services.guidelines_service import seed_clinical_rules
init_db()
db_session = SessionLocal()
try:
    seed_clinical_rules(db_session)
finally:
    db_session.close()

# Phase 3 — Vision / OCR
# Running from inside /backend, so imports are relative (no 'backend.' prefix)
from routers import vision

app.include_router(vision.router, prefix="/scan", tags=["Vision"])

# Phase 4 — Medication Intelligence
from routers import medication

app.include_router(medication.router, prefix="/medication", tags=["Medication"])

# Phase 5 — Symptom Triage + Provider Directory
from routers import triage, directory

app.include_router(triage.router, prefix="/triage",    tags=["Triage"],    include_in_schema=True)
app.include_router(directory.router, prefix="/directory", tags=["Directory"], include_in_schema=True)

# Phase 4 — Contextual AI & Caregiver Alerts
from routers import clinician, alerts
app.include_router(clinician.router, prefix="/clinician", tags=["Clinician"], include_in_schema=True)
app.include_router(alerts.router, prefix="/alerts", tags=["Alerts"], include_in_schema=True)

# ---------------------------------------------------------------------------
# Development Entry Point
# ---------------------------------------------------------------------------
# Run directly with:  python main.py
# Or via Uvicorn CLI: uvicorn main:app --reload --port 8000

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,          # Hot-reload on source file changes (dev only)
        log_level="info",
    )

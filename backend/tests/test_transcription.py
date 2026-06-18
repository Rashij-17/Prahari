import pytest
from fastapi.testclient import TestClient
import jwt
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from main import app
from models.db import Base, get_db, User
from unittest.mock import patch
from core.config import settings

client = TestClient(app)

# Setup in-memory SQLite for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_transcription.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

# Generate a mock token for testing
def get_test_token(user_id="test_user_999", email="test@example.com"):
    payload = {
        "sub": user_id,
        "email": email,
        "aud": "authenticated"
    }
    secret = settings.supabase_jwt_secret or "dummy_secret_not_used_in_test"
    if secret == "your_supabase_jwt_secret":
        secret = "dummy_secret_not_used_in_test"
    return jwt.encode(payload, secret, algorithm="HS256")

@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    # Add mock user
    user = User(
        id="test_user_999",
        email="test@example.com",
        allergies="",
        lab_results=""
    )
    db.add(user)
    db.commit()
    
    # Register overrides
    app.dependency_overrides[get_db] = override_get_db
    yield
    # Cleanup overrides and database
    app.dependency_overrides.pop(get_db, None)
    Base.metadata.drop_all(bind=engine)


def test_transcribe_audio_endpoint_fallback():
    # Test POST /triage/transcribe endpoint using fallback
    audio_data = b"dummy_audio_bytes"
    
    with patch("services.transcription_service.settings.groq_api_key", ""), \
         patch("services.transcription_service.settings.gemini_api_key", ""):
        
        response = client.post(
            "/triage/transcribe",
            files={"file": ("test_recording.wav", audio_data, "audio/wav")}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "transcript" in data
        assert "medications" in data
        assert "appointments" in data
        assert "warnings" in data
        assert len(data["medications"]) > 0


def test_sync_routes_unauthenticated():
    # Test getting cabinet without auth header (should return 403 or 401 depending on Bearer config)
    res_cabinet = client.get("/medication/cabinet")
    assert res_cabinet.status_code in (401, 403)
    
    res_appointments = client.get("/medication/appointments")
    assert res_appointments.status_code in (401, 403)


def test_sync_medication_cabinet_success():
    # Mock JWT decoding to return a valid user payload
    token = get_test_token()
    headers = {"Authorization": f"Bearer {token}"}
    
    # 1. Post item to cabinet
    payload = {
        "brand_name": "TestMeds 500",
        "generic_name": "Testium",
        "dosage_strength": "500mg",
        "frequency": "once daily",
        "instructions": "Take for 5 days"
    }
    response = client.post("/medication/cabinet", json=payload, headers=headers)
    assert response.status_code == 200
    assert response.json()["status"] == "success"
    
    # 2. Get cabinet items
    response = client.get("/medication/cabinet", headers=headers)
    assert response.status_code == 200
    items = response.json()
    assert len(items) > 0
    assert items[0]["brand_name"] == "TestMeds 500"
    item_id = items[0]["id"]
    
    # 3. Delete cabinet item
    response = client.delete(f"/medication/cabinet/{item_id}", headers=headers)
    assert response.status_code == 200
    assert response.json()["status"] == "success"


def test_sync_appointments_success():
    token = get_test_token()
    headers = {"Authorization": f"Bearer {token}"}
    
    # 1. Post appointment
    payload = {
        "title": "Dr. Smith Checkup",
        "date": "2026-06-30",
        "time": "10:30 AM",
        "notes": "Bring reports"
    }
    response = client.post("/medication/appointments", json=payload, headers=headers)
    assert response.status_code == 200
    assert response.json()["status"] == "success"
    
    # 2. Get appointments
    response = client.get("/medication/appointments", headers=headers)
    assert response.status_code == 200
    items = response.json()
    assert len(items) > 0
    assert items[0]["title"] == "Dr. Smith Checkup"
    appt_id = items[0]["id"]
    
    # 3. Delete appointment
    response = client.delete(f"/medication/appointments/{appt_id}", headers=headers)
    assert response.status_code == 200
    assert response.json()["status"] == "success"

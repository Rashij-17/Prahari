import pytest
import jwt
from unittest.mock import patch
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from main import app
from models.db import Base, get_db, User, DBCaregiver, DBWebPushSubscription
from core.config import settings

# Setup in-memory SQLite for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_alerts.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

# Generate a mock token for testing
def get_test_token(user_id="mock_user_12345", email="demo-patient@prahari.org"):
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
        id="mock_user_12345",
        email="demo-patient@prahari.org"
    )
    db.add(user)
    
    # Add push subscription
    sub = DBWebPushSubscription(
        user_id="mock_user_12345",
        endpoint="https://fcm.googleapis.com/fcm/send/test_token",
        keys_p256dh="test_p256dh",
        keys_auth="test_auth"
    )
    db.add(sub)
    db.commit()
    
    # Register overrides
    app.dependency_overrides[get_db] = override_get_db
    yield
    # Cleanup overrides and database
    app.dependency_overrides.pop(get_db, None)
    Base.metadata.drop_all(bind=engine)


@patch("routers.alerts.smtplib.SMTP")
def test_escalate_alert_console_fallback(mock_smtp, caplog):
    # Set dummy SMTP credentials to trigger the SMTP send path
    settings.smtp_username = "test@gmail.com"
    settings.smtp_password = "test_password_123"
    client = TestClient(app)
    token = get_test_token()
    headers = {"Authorization": f"Bearer {token}"}
    
    # We call escalation passing caregiver circle directly
    res = client.post(
        "/alerts/escalate",
        headers=headers,
        json={
            "missed_medication_name": "Warfarin",
            "patient_name": "Demo Patient",
            "patient_email": "demo-patient@prahari.org",
            "inactivity_duration_minutes": 120,
            "decrypted_caregiver_circle": [
                {
                    "name": "Son",
                    "phone": "+919999999999",
                    "email": "son@example.com",
                    "notification_type": "all"
                }
            ]
        }
    )
    assert res.status_code == 200
    data = res.json()
    # Since VAPID keys are missing in testing env, it flags is_mock = True
    assert data["is_mock"] is True
    # SMS count should be 0 as SMS is mock only
    # In alerts.py: mock SMS returns False, so sms_sent_count remains 0.
    assert data["sms_sent_count"] == 0
    # Push count should be 0 (fail due to missing VAPID keys)
    assert data["push_sent_count"] == 0
    # Email is simulated logging, so it returns 1 (success)
    assert data["email_sent_count"] == 1
    assert "dispatched" in data["details"].lower()

import pytest
import jwt
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from main import app
from models.db import Base, get_db, User, DBCaregiver, DBClinicalSafetyRule
from services.guidelines_service import seed_clinical_rules, check_local_safety_rules, extract_active_ingredients

from core.config import settings

# Setup in-memory SQLite for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_clinician.db"
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
    # Setup database
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    # Seed rules
    seed_clinical_rules(db)
    # Add mock user
    user = User(
        id="mock_user_12345",
        email="demo-patient@prahari.org",
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


def test_seed_clinical_rules():
    db = TestingSessionLocal()
    rules = db.query(DBClinicalSafetyRule).all()
    assert len(rules) > 0
    # Check if warfarin vs ibuprofen was seeded
    warfarin_rule = db.query(DBClinicalSafetyRule).filter(
        DBClinicalSafetyRule.ingredient_name == "warfarin",
        DBClinicalSafetyRule.value_match == "ibuprofen"
    ).first()
    assert warfarin_rule is not None
    assert warfarin_rule.severity == "critical"


def test_extract_active_ingredients():
    res1 = extract_active_ingredients("Montelukast Sodium + Levocetirizine Dihydrochloride")
    assert "montelukast" in res1
    assert "levocetirizine" in res1

    res2 = extract_active_ingredients("Amoxicillin Sodium 500mg ip")
    assert "amoxicillin" in res2


def test_check_local_safety_rules():
    db = TestingSessionLocal()
    # 1. Drug-Drug interaction check
    warnings = check_local_safety_rules(
        db=db,
        active_ingredients=["warfarin", "ibuprofen"],
        user_allergies=[],
        user_labs=[]
    )
    assert len(warnings) == 1
    assert warnings[0]["rule_type"] == "drug_interaction"
    assert warnings[0]["severity"] == "critical"

    # 2. Drug-Allergy conflict check
    warnings_all = check_local_safety_rules(
        db=db,
        active_ingredients=["amoxicillin"],
        user_allergies=["penicillin"],
        user_labs=[]
    )
    assert len(warnings_all) == 1
    assert warnings_all[0]["rule_type"] == "allergy_conflict"
    assert "amoxicillin" in warnings_all[0]["warning_text"].lower()

    # 3. Drug-Lab conflict check
    warnings_lab = check_local_safety_rules(
        db=db,
        active_ingredients=["metformin"],
        user_allergies=[],
        user_labs=["Creatinine: High"]
    )
    assert len(warnings_lab) == 1
    assert warnings_lab[0]["rule_type"] == "condition_conflict"


def test_caregiver_crud():
    client = TestClient(app)
    token = get_test_token()
    headers = {"Authorization": f"Bearer {token}"}
    
    # 1. Create Caregiver
    res = client.post(
        "/clinician/caregivers",
        headers=headers,
        json={
            "name": "EncryptedName==",
            "phone": "EncryptedPhone==",
            "email": "EncryptedEmail==",
            "notification_type": "all"
        }
    )
    assert res.status_code == 200
    data = res.json()
    assert data["name"] == "EncryptedName=="
    cg_id = data["id"]

    # 2. Get Caregivers
    res_get = client.get("/clinician/caregivers", headers=headers)
    assert res_get.status_code == 200
    assert len(res_get.json()) == 1

    # 3. Delete Caregiver
    res_del = client.delete(f"/clinician/caregivers/{cg_id}", headers=headers)
    assert res_del.status_code == 200
    assert res_del.json()["status"] == "success"


def test_clinician_chat_emergency():
    client = TestClient(app)
    token = get_test_token()
    headers = {"Authorization": f"Bearer {token}"}
    
    res = client.post(
        "/clinician/chat",
        headers=headers,
        json={
            "query": "I am experiencing severe chest pain spreading to my left arm",
            "history": [],
            "run_ai_scan": False,
            "decrypted_allergies": [],
            "decrypted_labs": []
        }
    )
    assert res.status_code == 200
    data = res.json()
    assert data["is_emergency"] is True
    assert "IMMEDIATE EMERGENCY" in data["response"]

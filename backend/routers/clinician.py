import logging
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from google import genai
from google.genai import types

from core.config import settings
from models.db import get_db, User, DBCaregiver, DBWebPushSubscription, DBMedicineCabinet
from utils.auth import get_current_user
from services.guidelines_service import check_local_safety_rules, extract_active_ingredients

logger = logging.getLogger(__name__)

router = APIRouter()

# --- Schemas ---

class UserProfileUpdate(BaseModel):
    allergies: str  # Encrypted base64
    lab_results: str  # Encrypted base64

class UserProfileResponse(BaseModel):
    allergies: str
    lab_results: str

class CaregiverBase(BaseModel):
    id: Optional[int] = None
    name: str  # Encrypted base64
    phone: str = ""  # Encrypted base64
    email: str = ""  # Encrypted base64
    notification_type: str = "all"  # Encrypted base64

class CaregiverResponse(BaseModel):
    id: int
    user_id: str
    name: str
    phone: str
    email: str
    notification_type: str

class PushSubscriptionRegister(BaseModel):
    endpoint: str
    keys_p256dh: str
    keys_auth: str

class ChatMessage(BaseModel):
    role: str  # "user" or "model"
    text: str

class ClinicianChatRequest(BaseModel):
    query: str
    history: List[ChatMessage] = []
    run_ai_scan: bool = False
    
    # Client passes decrypted values for rule checks and LLM prompt context
    decrypted_allergies: List[str] = []
    decrypted_labs: List[str] = []

class ClinicianChatResponse(BaseModel):
    response: str
    local_warnings: List[dict] = []
    is_emergency: bool = False
    is_mock: bool = False

# --- Endpoints ---

@router.get("/profile", response_model=UserProfileResponse, summary="Get user medical profile")
async def get_user_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return UserProfileResponse(
        allergies=current_user.allergies or "",
        lab_results=current_user.lab_results or ""
    )

@router.post("/profile", response_model=UserProfileResponse, summary="Update user medical profile")
async def update_user_profile(
    body: UserProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    current_user.allergies = body.allergies
    current_user.lab_results = body.lab_results
    db.commit()
    return UserProfileResponse(
        allergies=current_user.allergies,
        lab_results=current_user.lab_results
    )

@router.get("/caregivers", response_model=List[CaregiverResponse], summary="Get user caregivers")
async def get_caregivers(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    caregivers = db.query(DBCaregiver).filter(DBCaregiver.user_id == current_user.id).all()
    return [
        CaregiverResponse(
            id=c.id,
            user_id=c.user_id,
            name=c.name,
            phone=c.phone,
            email=c.email,
            notification_type=c.notification_type
        )
        for c in caregivers
    ]

@router.post("/caregivers", response_model=CaregiverResponse, summary="Add or update caregiver")
async def add_or_update_caregiver(
    body: CaregiverBase,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if body.id:
        cg = db.query(DBCaregiver).filter(DBCaregiver.id == body.id, DBCaregiver.user_id == current_user.id).first()
        if not cg:
            raise HTTPException(status_code=404, detail="Caregiver not found")
        cg.name = body.name
        cg.phone = body.phone
        cg.email = body.email
        cg.notification_type = body.notification_type
    else:
        cg = DBCaregiver(
            user_id=current_user.id,
            name=body.name,
            phone=body.phone,
            email=body.email,
            notification_type=body.notification_type
        )
        db.add(cg)
        
    db.commit()
    db.refresh(cg)
    return CaregiverResponse(
        id=cg.id,
        user_id=cg.user_id,
        name=cg.name,
        phone=cg.phone,
        email=cg.email,
        notification_type=cg.notification_type
    )

@router.delete("/caregivers/{caregiver_id}", summary="Delete caregiver")
async def delete_caregiver(
    caregiver_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    cg = db.query(DBCaregiver).filter(DBCaregiver.id == caregiver_id, DBCaregiver.user_id == current_user.id).first()
    if not cg:
        raise HTTPException(status_code=404, detail="Caregiver not found")
    db.delete(cg)
    db.commit()
    return {"status": "success", "message": "Caregiver deleted"}

@router.post("/push-subscription", summary="Register user's browser push subscription")
async def register_push_subscription(
    body: PushSubscriptionRegister,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Check if subscription already exists
    existing = db.query(DBWebPushSubscription).filter(
        DBWebPushSubscription.user_id == current_user.id,
        DBWebPushSubscription.endpoint == body.endpoint
    ).first()
    
    if existing:
        existing.keys_p256dh = body.keys_p256dh
        existing.keys_auth = body.keys_auth
    else:
        new_sub = DBWebPushSubscription(
            user_id=current_user.id,
            endpoint=body.endpoint,
            keys_p256dh=body.keys_p256dh,
            keys_auth=body.keys_auth
        )
        db.add(new_sub)
        
    db.commit()
    return {"status": "success", "message": "Subscription registered"}


@router.post("/chat", response_model=ClinicianChatResponse, summary="Pocket Clinician context-aware safety chat")
async def pocket_clinician_chat(
    body: ClinicianChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    logger.info("Clinician chat query: %s", body.query)
    
    # 1. Emergency Keyword Override Check
    emergency_keywords = ["chest pain", "crushing pain", "slurred speech", "stroke", "paralysis", "difficulty breathing", "severe bleeding"]
    query_lower = body.query.lower()
    is_emergency = any(kw in query_lower for kw in emergency_keywords)
    
    if is_emergency:
        return ClinicianChatResponse(
            response=(
                "🚨 **IMMEDIATE EMERGENCY DETECTED** 🚨\n\n"
                "Your symptoms suggest a potentially life-threatening emergency (e.g., potential heart attack or stroke).\n\n"
                "**Action required:**\n"
                "- Please call emergency services (112 or 911) immediately.\n"
                "- Do NOT take any medications or wait for a doctor's call.\n"
                "- Sit or lie down in a safe position."
            ),
            local_warnings=[{
                "rule_type": "emergency_override",
                "warning_text": "Emergency keywords detected in query. Immediate care required.",
                "severity": "critical",
                "matched_value": "Emergency Symptoms"
            }],
            is_emergency=True
        )

    # 2. Compile Patient Medication Context
    # Load all user cabinet medicines to cross-reference
    cabinet_items = db.query(DBMedicineCabinet).filter(DBMedicineCabinet.user_id == current_user.id).all()
    active_ingredients = []
    meds_context_str = ""
    
    if cabinet_items:
        meds_list = []
        for item in cabinet_items:
            gen_name = item.generic_name or item.brand_name
            # Extract active ingredients for local SQL rules
            active_ingredients.extend(extract_active_ingredients(gen_name))
            meds_list.append(f"- {item.brand_name} (Active ingredient: {item.generic_name or 'Unknown'})")
        meds_context_str = "\n".join(meds_list)
    else:
        meds_context_str = "None registered."

    # 3. Check Local SQL Safety Rules (Offline-friendly Safety Net)
    # Check if the query itself mentions a drug, and add it to ingredients list for rule checking
    # Simple keyword extraction of common drugs
    common_test_drugs = ["ibuprofen", "aspirin", "nitroglycerin", "sildenafil", "amoxicillin", "cephalexin", "metformin", "pseudoephedrine", "atorvastatin", "spironolactone", "lisinopril"]
    mentioned_ingredients = [d for d in common_test_drugs if d in query_lower]
    
    all_check_ingredients = list(set(active_ingredients + mentioned_ingredients))
    
    local_warnings = check_local_safety_rules(
        db=db,
        active_ingredients=all_check_ingredients,
        user_allergies=body.decrypted_allergies,
        user_labs=body.decrypted_labs
    )
    
    # 4. Generate Response (Local rule alert or Gemini detailed scan)
    # If there are critical local warnings, and the user did NOT explicitly request Gemini,
    # we block the query and warn them immediately, saving API quota.
    has_critical_warning = any(w["severity"] == "critical" for w in local_warnings)
    
    if has_critical_warning and not body.run_ai_scan:
        warnings_desc = "\n".join([f"- ⚠️ **{w['matched_value']}**: {w['warning_text']}" for w in local_warnings])
        return ClinicianChatResponse(
            response=(
                "⚠️ **Safety Warning Alert** ⚠️\n\n"
                "Our local clinical safety check has flagged a high-risk conflict with your health profile:\n\n"
                f"{warnings_desc}\n\n"
                "To run a more detailed analysis, please click the **'Detailed AI Scan'** button below."
            ),
            local_warnings=local_warnings
        )
        
    # If no warnings OR user clicked "Detailed AI Scan"
    is_gemini_configured = bool(
        settings.gemini_api_key and 
        "your_gemini_api_key" not in settings.gemini_api_key and
        settings.gemini_api_key.strip() != ""
    )
    
    if body.run_ai_scan and is_gemini_configured:
        try:
            logger.info("Executing Gemini Clinician prompt...")
            client = genai.Client(api_key=settings.gemini_api_key)
            
            # Compile system prompt with user profile context
            system_instruction = (
                "You are Prahari's Pocket Clinician, an expert clinical AI doctor assistant. "
                "You provide safe, empathetic, patient-friendly medical explanations. "
                "Guidelines:\n"
                "- Keep explanations simple and easily understandable by patients.\n"
                "- NEVER prescribe medications. Suggest general over-the-counter safety rules.\n"
                "- Warn patients of active contradictions from their profile details.\n"
                "- Always include a disclaimer that this is informational advice.\n"
            )
            
            # Format history
            gemini_contents = []
            for msg in body.history[-6:]:  # Only keep last 6 turns
                role = "user" if msg.role == "user" else "model"
                gemini_contents.append(types.Content(
                    role=role,
                    parts=[types.Part.from_text(text=msg.text)]
                ))
                
            # Compile profile context prompt
            context_prompt = (
                f"### Patient Medical Profile Context:\n"
                f"- **Active Cabinet Medications**:\n{meds_context_str}\n"
                f"- **Allergies**: {', '.join(body.decrypted_allergies) if body.decrypted_allergies else 'None'}\n"
                f"- **Active Health Conditions / Lab Results**: {', '.join(body.decrypted_labs) if body.decrypted_labs else 'None'}\n\n"
                f"### User Query:\n"
                f"\"{body.query}\"\n\n"
                f"Please analyze safety and respond."
            )
            
            gemini_contents.append(types.Content(
                role="user",
                parts=[types.Part.from_text(text=context_prompt)]
            ))
            
            response = client.models.generate_content(
                model="gemini-3.1-flash-lite",
                contents=gemini_contents,
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    temperature=0.3
                )
            )
            
            ai_text = response.text.strip() if response and response.text else "Sorry, I could not generate a response."
            
            return ClinicianChatResponse(
                response=ai_text,
                local_warnings=local_warnings
            )
        except Exception as e:
            logger.error("Gemini Clinician Chat failed: %s", e)
            return ClinicianChatResponse(
                response="Failed to run detailed AI scan. Displaying local warning checks.",
                local_warnings=local_warnings,
                is_mock=True
            )
            
    # Default local lookup response (if no Gemini or not requested)
    local_warnings_text = ""
    if local_warnings:
        warnings_desc = "\n".join([f"- ⚠️ **{w['matched_value']}**: {w['warning_text']}" for w in local_warnings])
        local_warnings_text = f"\n\n### Profile Safety Warnings:\n{warnings_desc}"
        
    return ClinicianChatResponse(
        response=(
            f"Hello. I am Prahari's Pocket Clinician. "
            f"Based on your query: \"{body.query}\", I have evaluated your profile. "
            f"Always consult your doctor before modifying your medicine intake."
            f"{local_warnings_text}"
        ),
        local_warnings=local_warnings,
        is_mock=True
    )

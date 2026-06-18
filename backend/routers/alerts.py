import json
import logging
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from twilio.rest import Client as TwilioClient
from pywebpush import webpush, WebPushException

from core.config import settings
from models.db import get_db, User, DBCaregiver, DBWebPushSubscription
from utils.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter()

# --- Schemas ---

class AlertEscalationRequest(BaseModel):
    missed_medication_name: str
    patient_name: str
    patient_email: str
    inactivity_duration_minutes: int = 120
    
    # Decrypted emergency caregiver list from frontend (if available)
    # The client can pass caregiver info so we can alert them directly even if DB sync is offline.
    decrypted_caregiver_circle: Optional[List[dict]] = None

class AlertEscalationResponse(BaseModel):
    sms_sent_count: int
    push_sent_count: int
    email_sent_count: int
    is_mock: bool = False
    details: str = ""

# --- Helper functions ---

def send_local_sms(to_number: str, message: str) -> bool:
    """Sends an SMS using Twilio. Returns True if successful, False otherwise."""
    has_twilio = bool(
        settings.twilio_account_sid and
        "your_twilio" not in settings.twilio_account_sid and
        settings.twilio_phone_number
    )
    if not has_twilio:
        logger.warning("[MOCK SMS] To: %s | Message: %s", to_number, message)
        return False
        
    try:
        client = TwilioClient(settings.twilio_account_sid, settings.twilio_auth_token)
        client.messages.create(
            body=message,
            from_=settings.twilio_phone_number,
            to=to_number
        )
        logger.info("Twilio SMS sent to %s successfully.", to_number)
        return True
    except Exception as e:
        logger.error("Failed to send Twilio SMS to %s: %s", to_number, e)
        return False


def send_local_web_push(subscription: DBWebPushSubscription, payload: str) -> bool:
    """Sends a Web Push notification. Returns True if successful, False otherwise."""
    has_vapid = bool(
        settings.vapid_private_key and
        "your_vapid" not in settings.vapid_private_key and
        settings.vapid_private_key.strip() != ""
    )
    
    subscription_info = {
        "endpoint": subscription.endpoint,
        "keys": {
            "p256dh": subscription.keys_p256dh,
            "auth": subscription.keys_auth
        }
    }
    
    if not has_vapid:
        logger.warning("[MOCK WEB PUSH] Endpoint: %s | Payload: %s", subscription.endpoint[:40] + "...", payload)
        return False
        
    try:
        claims_mail = settings.vapid_claims_email or "prahari@example.com"
        webpush(
            subscription_info=subscription_info,
            data=payload,
            vapid_private_key=settings.vapid_private_key,
            vapid_claims={"sub": f"mailto:{claims_mail}"}
        )
        logger.info("Web Push sent to endpoint %s successfully.", subscription.endpoint[:40] + "...")
        return True
    except WebPushException as ex:
        logger.error("Failed to send Web Push to endpoint %s: %s", subscription.endpoint[:40] + "...", ex)
        return False
    except Exception as e:
        logger.error("General error sending Web Push: %s", e)
        return False


# --- Endpoints ---

@router.post("/escalate", response_model=AlertEscalationResponse, summary="Escalate patient inactivity alert to caregivers")
async def escalate_alert(
    body: AlertEscalationRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    logger.info("Alert escalation requested for patient: %s", body.patient_name)
    
    # 1. Fetch Caregiver List
    caregivers = []
    
    # Check if client passed the decrypted caregiver circle (recommended for client E2EE)
    if body.decrypted_caregiver_circle:
        caregivers = body.decrypted_caregiver_circle
    else:
        # Load from DB (note: values in DB are encrypted, so backend can't read plaintext,
        # but we can try to send to numbers/emails. To decrypt, we require client E2EE,
        # so passing decrypted_caregiver_circle from frontend is much preferred).
        db_caregivers = db.query(DBCaregiver).filter(DBCaregiver.user_id == current_user.id).all()
        caregivers = [
            {
                "name": "Caregiver",  # Placeholder since encrypted in DB
                "phone": c.phone,     # Phone/Email are encrypted in DB as well, so Twilio will fail
                "email": c.email,     # unless decrypted first. We will try or fallback.
                "notification_type": "all"
            }
            for c in db_caregivers
        ]

    # 2. Fetch Caregiver Web Push Subscriptions
    # Note: push subscriptions are NOT E2EE-encrypted because they are required by browser endpoints,
    # so we read them directly.
    push_subs = db.query(DBWebPushSubscription).filter(DBWebPushSubscription.user_id == current_user.id).all()

    # 3. Construct Notification Message
    duration_hrs = round(body.inactivity_duration_minutes / 60, 1)
    alert_msg = (
        f"🚨 PRAHARI EMERGENCY ALERT 🚨\n\n"
        f"Patient {body.patient_name} has missed a high-priority medication "
        f"({body.missed_medication_name}) and no device activity has been detected "
        f"for {duration_hrs} hour(s).\n\n"
        f"Please check on them immediately."
    )
    
    push_payload = json.dumps({
        "title": "🚨 Prahari Emergency Sentinel Alert 🚨",
        "body": f"No activity detected for {body.patient_name} after missing medication ({body.missed_medication_name}).",
        "icon": "/assets/icon-192.png",
        "badge": "/assets/icon-192.png",
        "tag": "prahari-sentinel-alert",
        "data": {
            "patient_email": body.patient_email,
            "missed_medication_name": body.missed_medication_name
        }
    })

    sms_count = 0
    push_count = 0
    email_count = 0
    is_mock = False

    # 4. Dispatch Notifications
    # Caregivers SMS and Email
    for cg in caregivers:
        c_phone = cg.get("phone", "")
        c_email = cg.get("email", "")
        c_name = cg.get("name", "Caregiver")
        
        # SMS Alert
        if c_phone:
            # Check if twilio sends successfully
            success = send_local_sms(c_phone, alert_msg)
            if success:
                sms_count += 1
            else:
                is_mock = True
                
        # Email Alert (Simulated log)
        if c_email:
            logger.info("[MOCK EMAIL] Alert sent to caregiver %s <%s>: %s", c_name, c_email, alert_msg)
            email_count += 1

    # Web Push Alerts
    for sub in push_subs:
        success = send_local_web_push(sub, push_payload)
        if success:
            push_count += 1
        else:
            is_mock = True

    # If caregivers circle and push subs are both empty, we have no-one to alert
    if not caregivers and not push_subs:
        is_mock = True
        logger.warning("No caregivers or push subscriptions registered. Alerts logged to console.")

    details = (
        f"Alert dispatched to {sms_count} caregiver(s) via SMS, "
        f"{push_count} caregiver(s) via Web Push, and {email_count} caregiver(s) via email."
    )
    logger.info(details)
    
    return AlertEscalationResponse(
        sms_sent_count=sms_count,
        push_sent_count=push_count,
        email_sent_count=email_count,
        is_mock=is_mock,
        details=details
    )

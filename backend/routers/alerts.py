import json
import logging
from typing import List, Optional, Tuple
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
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
    inactivity_duration_minutes: float = 120.0
    
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
    """Mock SMS sender."""
    logger.info("[MOCK SMS] To: %s | Message: %s", to_number, message)
    return False


def send_smtp_email(to_email: str, caregiver_name: str, subject: str, html_content: str) -> Tuple[bool, bool]:
    """Sends an email alert using standard SMTP (Gmail). Falls back to mock if credentials are not configured.
    
    Returns:
        (success: bool, is_mock: bool)
    """
    has_smtp = bool(settings.smtp_username and settings.smtp_password)
    if not has_smtp:
        logger.warning("[MOCK EMAIL] Alert sent to caregiver %s <%s>: %s", caregiver_name, to_email, html_content)
        return True, True
        
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"Prahari Alerts <{settings.smtp_username}>"
        msg["To"] = to_email
        
        msg.attach(MIMEText(html_content, "html"))
        
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
            server.starttls()
            server.login(settings.smtp_username, settings.smtp_password)
            server.sendmail(settings.smtp_username, to_email, msg.as_string())
            
        logger.info("SMTP email successfully sent to %s.", to_email)
        return True, False
    except Exception as ex:
        logger.error("Failed to send SMTP email to %s: %s", to_email, ex)
        return False, False


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
        if not claims_mail.startswith("mailto:"):
            claims_mail = f"mailto:{claims_mail}"
        webpush(
            subscription_info=subscription_info,
            data=payload,
            vapid_private_key=settings.vapid_private_key,
            vapid_claims={"sub": claims_mail}
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
    
    # Short message specifically for SMS to stay within standard character limits
    sms_msg = (
        f"🚨 Prahari Alert: {body.patient_name} missed {body.missed_medication_name}. "
        f"No activity for {duration_hrs}h. Check immediately."
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
            success = send_local_sms(c_phone, sms_msg)
            if success:
                sms_count += 1
            else:
                is_mock = True
                
        # Email Alert
        if c_email:
            email_html = (
                f"<div style='font-family: sans-serif; line-height: 1.5; color: #1e293b;'>"
                f"<h2 style='color: #dc2626;'>🚨 Prahari Emergency Sentinel Alert</h2>"
                f"<p>Dear {c_name},</p>"
                f"<p><strong>Patient {body.patient_name}</strong> has missed a high-priority medication "
                f"({body.missed_medication_name}) and no device activity has been detected "
                f"for {duration_hrs} hour(s).</p>"
                f"<p>Please check on them immediately.</p>"
                f"<hr style='border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;'>"
                f"<p style='font-size: 0.875rem; color: #64748b;'>This is an automated alert from Prahari. "
                f"Please do not reply directly to this email.</p></div>"
            )
            email_subject = f"🚨 Prahari Emergency Alert: {body.patient_name} Inactivity Detected"
            success, was_mock = send_smtp_email(c_email, c_name, email_subject, email_html)
            if success:
                email_count += 1
            if was_mock:
                is_mock = True

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

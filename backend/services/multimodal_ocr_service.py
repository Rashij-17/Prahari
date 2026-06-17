"""
Prahari — Multimodal OCR Fallback Service
==========================================
Implements a 3-tier fallback image decryption pipeline:
1. Tier 1: Google Gemini (gemini-3.1-flash-lite) with structured JSON output schema.
2. Tier 2: Groq Llama (llama-4-scout or fallback) with JSON response formatting.
3. Tier 3: Local Tesseract OCR (opencv preprocessing + raw candidate text refinement).
"""

import base64
import json
import logging
from google import genai
from google.genai import types
from groq import Groq

from core.config import settings
from models.vision import DecipheredDrug, DecipheredPrescription
from services.ocr_service import process_image_frame

import cv2
import numpy as np

logger = logging.getLogger(__name__)


def _preprocess_handwriting(b64_image: str) -> str:
    """
    Decodes a base64 image, applies OpenCV image preprocessing for cursive/handwritten clinical text
    (Grayscaling, Bilateral Filtering to preserve edges, CLAHE to enhance local contrast),
    and returns a base64-encoded JPEG image string.
    """
    image_bytes, _ = _get_image_bytes_and_clean_b64(b64_image)
    np_arr = np.frombuffer(image_bytes, dtype=np.uint8)
    img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    if img is None:
        logger.warning("OpenCV failed to decode base64 image. Proceeding with original image.")
        return b64_image

    # 1. Convert to Grayscale
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # 2. Apply Bilateral Filtering to reduce noise while keeping stroke edges sharp
    filtered = cv2.bilateralFilter(gray, 9, 75, 75)

    # 3. Apply Contrast Limited Adaptive Histogram Equalization (CLAHE) for thin/faded ink strokes
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(filtered)

    # 4. Re-encode to JPEG
    _, encoded_img = cv2.imencode('.jpg', enhanced)
    processed_bytes = encoded_img.tobytes()
    processed_b64 = base64.b64encode(processed_bytes).decode('utf-8')

    # Re-attach original data URI prefix if it was present
    if "," in b64_image:
        prefix = b64_image.split(",", 1)[0]
        return f"{prefix},{processed_b64}"
    return processed_b64


def _get_image_bytes_and_clean_b64(b64_string: str) -> tuple[bytes, str]:
    """
    Decodes the base64 string to raw bytes and returns clean base64 content.
    Strips data URI prefixes if present.
    """
    if "," in b64_string:
        b64_clean = b64_string.split(",", 1)[1]
    else:
        b64_clean = b64_string
    return base64.b64decode(b64_clean), b64_clean


from core.models import OCR_FALLBACK_CHAIN

def decipher_prescription(b64_image: str) -> dict:
    """
    Decipher prescription from base64 image using a dynamic fallback pipeline.
    Iterates through OCR_FALLBACK_CHAIN defined in core/models.py.
    """
    # Apply OpenCV preprocessing to optimize image for cursive handwriting
    try:
        logger.info("Applying OpenCV preprocessing (Grayscale + CLAHE + Bilateral Filtering) to prescription image...")
        b64_image = _preprocess_handwriting(b64_image)
    except Exception as exc:
        logger.error("Failed to preprocess handwriting image: %s", exc)

    last_error = None
    
    for step in OCR_FALLBACK_CHAIN:
        provider = step["provider"]
        model = step["model_name"]
        
        # --- Gemini Tier ---
        if provider == "gemini":
            is_gemini_configured = bool(
                settings.gemini_api_key and 
                "your_gemini_api_key" not in settings.gemini_api_key and
                settings.gemini_api_key.strip() != ""
            )
            if is_gemini_configured:
                try:
                    logger.info("Attempting OCR Step: Gemini (%s)", model)
                    client = genai.Client(api_key=settings.gemini_api_key)
                    image_bytes, _ = _get_image_bytes_and_clean_b64(b64_image)
                    
                    prompt = (
                        "You are an expert pharmacist and clinical AI assistant. "
                        "Analyze this prescription image. Decipher and extract the list of drugs "
                        "with their brand name, generic name, dosage strength, frequency, "
                        "and intake instructions. Also extract any additional patient notes or guidance."
                    )
                    
                    response = client.models.generate_content(
                        model=model,
                        contents=[
                            types.Part.from_bytes(
                                data=image_bytes,
                                mime_type="image/jpeg",
                            ),
                            prompt
                        ],
                        config=types.GenerateContentConfig(
                            response_mime_type="application/json",
                            response_schema=DecipheredPrescription,
                        ),
                    )
                    
                    if response and response.text:
                        result = json.loads(response.text)
                        logger.info("OCR Step (Gemini) succeeded.")
                        return result
                    else:
                        raise ValueError("Empty response text from Gemini API")
                except Exception as exc:
                    logger.warning("OCR Step (Gemini) failed: %s. Proceeding to next step...", exc, exc_info=True)
                    last_error = exc
            else:
                logger.info("OCR Step (Gemini) skipped: GEMINI_API_KEY is not configured.")
                
        # --- Groq Tier ---
        elif provider == "groq":
            is_groq_configured = bool(
                settings.groq_api_key and 
                "your_groq_api_key" not in settings.groq_api_key and
                settings.groq_api_key.strip() != ""
            )
            if is_groq_configured:
                try:
                    logger.info("Attempting OCR Step: Groq (%s)", model)
                    client = Groq(api_key=settings.groq_api_key)
                    _, b64_clean = _get_image_bytes_and_clean_b64(b64_image)
                    
                    prompt = (
                        "Decipher the prescription in this image. "
                        "Return a JSON object matching this schema exactly:\n"
                        "{\n"
                        "  \"drugs\": [\n"
                        "    {\n"
                        "      \"brand_name\": \"string\",\n"
                        "      \"generic_name\": \"string\",\n"
                        "      \"dosage_strength\": \"string\",\n"
                        "      \"frequency\": \"string\",\n"
                        "      \"instructions\": \"string\"\n"
                        "    }\n"
                        "  ],\n"
                        "  \"patient_notes\": \"string\"\n"
                        "}\n"
                        "Ensure the response is valid JSON and contains only the JSON object, nothing else."
                    )
                    
                    response = client.chat.completions.create(
                        model=model,
                        messages=[
                            {
                                "role": "user",
                                "content": [
                                    {"type": "text", "text": prompt},
                                    {
                                        "type": "image_url",
                                        "image_url": {
                                            "url": f"data:image/jpeg;base64,{b64_clean}"
                                        }
                                    }
                                ]
                            }
                        ],
                        response_format={"type": "json_object"},
                    )
                    
                    content = response.choices[0].message.content
                    if content:
                        result = json.loads(content)
                        logger.info("OCR Step (Groq) succeeded.")
                        return result
                    else:
                        raise ValueError("Empty response content from Groq API")
                except Exception as exc:
                    logger.warning("OCR Step (Groq) failed: %s. Proceeding to next step...", exc, exc_info=True)
                    last_error = exc
            else:
                logger.info("OCR Step (Groq) skipped: GROQ_API_KEY is not configured.")
                
        # --- Local Tesseract Tier ---
        elif provider == "local" and model == "tesseract":
            logger.info("Executing fail-safe OCR Step: Tesseract")
            try:
                tesseract_res = process_image_frame(b64_image)
                drugs = []
                for candidate in tesseract_res.get("candidates", []):
                    drugs.append({
                        "brand_name": candidate,
                        "generic_name": "",
                        "dosage_strength": "",
                        "frequency": "",
                        "instructions": "Raw"
                    })
                    
                if not drugs:
                    drugs.append({
                        "brand_name": "Tesseract Fallback",
                        "generic_name": "",
                        "dosage_strength": "",
                        "frequency": "",
                        "instructions": "No candidates extracted"
                    })
                    
                notes = (
                    f"Tesseract raw output:\n{tesseract_res.get('raw_text', '')}\n\n"
                    f"Note: {tesseract_res.get('processing_note', '')}"
                )
                
                logger.info("OCR Step (Tesseract) complete.")
                return {
                    "drugs": drugs,
                    "patient_notes": notes
                }
            except Exception as exc:
                logger.error("OCR Step (Tesseract) failed: %s", exc, exc_info=True)
                last_error = exc

    # Ultimate fallback to avoid crashing if everything failed
    logger.error("All configured OCR fallback steps failed.")
    return {
        "drugs": [{
            "brand_name": "OCR Service Unavailable",
            "generic_name": "",
            "dosage_strength": "",
            "frequency": "",
            "instructions": "Failed to process image"
        }],
        "patient_notes": f"All OCR steps failed. Last error: {str(last_error)}"
    }

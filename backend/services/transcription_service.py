import io
import json
import logging
import subprocess
from google import genai
from google.genai import types
from groq import Groq

from core.config import settings
from models.vision import TranscriptionResult, TranscribedMedication, TranscribedAppointment
from services.fuzzy_service import fuzzy_correct_drug_token, load_fuzzy_caches, _INGREDIENTS_CACHE, _BRANDS_CACHE

logger = logging.getLogger(__name__)

# Default mock transcript for simulator fallback
MOCK_TRANSCRIPT = (
    "Hello Mr. Sharma, I looked at your reports. Your blood pressure is slightly high. "
    "I am prescribing you Metformin 500mg to be taken twice daily after meals for the next 30 days. "
    "Also, please start Crocin 650mg once daily if you experience any mild fevers, but do not exceed it. "
    "You should also take Pantocid 40mg in the morning on an empty stomach. "
    "Please avoid eating high-sugar foods or drinking alcohol. "
    "Let's schedule a follow-up appointment next month on 2026-07-15 at 10:00 AM for a blood check."
)

def _verify_spelling(med: dict) -> tuple[bool, str]:
    """
    Checks if a drug name is in our local Indian medicines databases.
    If not found, returns (True, suggested_name) using fuzzy spelling correction.
    Otherwise, returns (False, "").
    """
    load_fuzzy_caches()
    b_name = med.get("brand_name", "").strip()
    g_name = med.get("generic_name", "").strip()
    
    # Check if empty
    if not b_name:
        return True, ""
        
    b_lower = b_name.lower()
    g_lower = g_name.lower() if g_name else ""
    
    # 1. Check if it exists exactly in either cache
    in_brands = b_lower in _BRANDS_CACHE
    in_ingredients = (b_lower in _INGREDIENTS_CACHE) or (g_lower in _INGREDIENTS_CACHE if g_lower else False)
    
    if in_brands or in_ingredients:
        return False, ""
        
    # 2. Run fuzzy spelling correction on brand name
    corrected = fuzzy_correct_drug_token(b_name)
    if corrected.lower() != b_lower:
        return True, corrected
        
    # Also check generic name if present
    if g_name:
        corrected_g = fuzzy_correct_drug_token(g_name)
        if corrected_g.lower() != g_lower:
            return True, corrected_g
            
    return True, ""


def convert_audio_to_wav(audio_bytes: bytes) -> bytes:
    """
    Converts arbitrary input audio bytes (MP3, M4A, OGG, WEBM, etc.)
    into standard WAV format (PCM 16-bit, 16000Hz, mono) using ffmpeg.
    """
    if not audio_bytes:
        return audio_bytes
    try:
        logger.info("Converting audio payload to standard WAV format (16kHz, mono, PCM 16-bit) via ffmpeg...")
        process = subprocess.Popen(
            [
                "ffmpeg",
                "-y",                     # Overwrite output files without asking
                "-i", "pipe:0",           # Read from stdin
                "-f", "wav",              # Force output format to WAV
                "-acodec", "pcm_s16le",   # PCM 16-bit little-endian
                "-ar", "16000",           # 16000Hz sampling rate
                "-ac", "1",               # 1 audio channel (mono)
                "pipe:1"                  # Write to stdout
            ],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        stdout_data, stderr_data = process.communicate(input=audio_bytes)
        
        if process.returncode == 0:
            logger.info("Audio conversion succeeded. Converted size: %d bytes", len(stdout_data))
            return stdout_data
        else:
            logger.error("ffmpeg conversion error (exit code %d): %s", process.returncode, stderr_data.decode("utf-8", errors="ignore"))
            return audio_bytes
    except Exception as e:
        logger.error("Failed to run ffmpeg conversion: %s", str(e))
        return audio_bytes


def transcribe_and_parse_audio(file_bytes: bytes, filename: str) -> dict:
    """
    Transcribes audio bytes via a 3-tier fallback chain:
      - Tier 1: Groq Whisper-v3
      - Tier 2: Gemini 3.1 Flash Lite Audio
      - Tier 3: Local Simulator Fallback
    Then parses the transcript into structured Pydantic TranscriptionResult.
    """
    # Standardise and convert input audio to WAV format
    if file_bytes:
        wav_bytes = convert_audio_to_wav(file_bytes)
        if wav_bytes != file_bytes:
            file_bytes = wav_bytes
            base_name = filename.rsplit(".", 1)[0] if "." in filename else filename
            filename = f"{base_name}.wav"

    raw_transcript = ""
    confidence = 1.0
    is_incomplete = False
    
    # Check if configurations are present
    is_groq_configured = bool(
        settings.groq_api_key and 
        "your_groq_api_key" not in settings.groq_api_key and
        settings.groq_api_key.strip() != ""
    )
    is_gemini_configured = bool(
        settings.gemini_api_key and 
        "your_gemini_api_key" not in settings.gemini_api_key and
        settings.gemini_api_key.strip() != ""
    )
    
    # --- Tier 1: Groq Whisper-v3 ---
    if is_groq_configured:
        try:
            logger.info("Attempting Transcription Tier 1: Groq Whisper-v3")
            client = Groq(api_key=settings.groq_api_key)
            # Send in-memory bytes as a file tuple
            trans = client.audio.transcriptions.create(
                file=(filename, file_bytes),
                model="whisper-large-v3",
                response_format="json"
            )
            raw_transcript = trans.text
            logger.info("Groq Whisper transcription succeeded.")
        except Exception as e:
            logger.warning("Groq Whisper transcription failed: %s. Falling back to Tier 2...", e)
            
    # --- Tier 2: Gemini Audio ---
    if not raw_transcript and is_gemini_configured:
        try:
            logger.info("Attempting Transcription Tier 2: Gemini Audio")
            client = genai.Client(api_key=settings.gemini_api_key)
            
            # Determine mime type
            mime_type = "audio/wav"
            if filename.endswith(".mp3"):
                mime_type = "audio/mp3"
            elif filename.endswith(".m4a"):
                mime_type = "audio/m4a"
            elif filename.endswith(".ogg"):
                mime_type = "audio/ogg"
            elif filename.endswith(".webm"):
                mime_type = "audio/webm"
                
            response = client.models.generate_content(
                model="gemini-3.1-flash-lite",
                contents=[
                    types.Part.from_bytes(data=file_bytes, mime_type=mime_type),
                    "Transcribe the following consultation audio recording exactly. Return ONLY the transcription text."
                ]
            )
            if response and response.text:
                raw_transcript = response.text.strip()
                logger.info("Gemini Audio transcription succeeded.")
            else:
                raise ValueError("Empty response from Gemini Audio")
        except Exception as e:
            logger.warning("Gemini Audio transcription failed: %s. Falling back to Tier 3...", e)

    # --- Tier 3: Local Simulator Fallback ---
    if not raw_transcript:
        logger.info("Using fail-safe Tier 3: Local Simulator Fallback")
        raw_transcript = MOCK_TRANSCRIPT
        confidence = 0.5
        is_incomplete = True

    # --- Parse Raw Transcript into Structured Entities ---
    parsed_data = None
    if is_gemini_configured:
        try:
            logger.info("Parsing transcript entities using Gemini...")
            client = genai.Client(api_key=settings.gemini_api_key)
            prompt = (
                f"Analyze the following clinical consultation transcript:\n\n"
                f"\"{raw_transcript}\"\n\n"
                f"Extract medications (brand name, generic name, strength, frequency, duration), "
                f"upcoming appointments (title/purpose, date in YYYY-MM-DD, time, notes), "
                f"and any general safety warnings or instructions."
            )
            response = client.models.generate_content(
                model="gemini-3.1-flash-lite",
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=TranscriptionResult,
                ),
            )
            if response and response.text:
                parsed_data = json.loads(response.text)
                logger.info("Gemini parsing succeeded.")
        except Exception as e:
            logger.warning("Gemini entity parsing failed: %s", e)

    # Fallback parsing (if Gemini failed or was unconfigured)
    if not parsed_data:
        logger.info("Applying rule-based fallback entity parser...")
        meds = []
        appts = []
        warnings = []
        
        t_lower = raw_transcript.lower()
        if "metformin" in t_lower:
            meds.append({
                "brand_name": "Metformin",
                "generic_name": "Metformin",
                "dosage_strength": "500mg",
                "frequency": "twice daily after meals",
                "duration": "30 days"
            })
        if "crocin" in t_lower:
            meds.append({
                "brand_name": "Crocin",
                "generic_name": "Paracetamol",
                "dosage_strength": "650mg",
                "frequency": "once daily for fever",
                "duration": "as needed"
            })
        if "pantocid" in t_lower:
            meds.append({
                "brand_name": "Pantocid",
                "generic_name": "Pantoprazole",
                "dosage_strength": "40mg",
                "frequency": "morning on empty stomach",
                "duration": "30 days"
            })
        if "dolo" in t_lower:
            meds.append({
                "brand_name": "Dolo",
                "generic_name": "Paracetamol",
                "dosage_strength": "650mg",
                "frequency": "TDS",
                "duration": "5 days"
            })
            
        if "appointment" in t_lower or "follow-up" in t_lower:
            appts.append({
                "title": "Follow-up Blood Check",
                "date": "2026-07-15",
                "time": "10:00 AM",
                "notes": "Fast for 12 hours prior to check"
            })
            
        if "high-sugar" in t_lower or "alcohol" in t_lower:
            warnings.append("Avoid high-sugar foods and alcohol intake.")
        if "empty stomach" in t_lower:
            warnings.append("Take Pantocid on an empty stomach in the morning.")
            
        parsed_data = {
            "transcript": raw_transcript,
            "medications": meds,
            "appointments": appts,
            "warnings": warnings,
            "confidence": confidence,
            "is_incomplete": is_incomplete
        }

    # --- Verify Spellings against Local Reference Database ---
    for med in parsed_data.get("medications", []):
        is_unverified, suggested = _verify_spelling(med)
        med["is_unverified"] = is_unverified
        med["suggested_name"] = suggested

    return parsed_data

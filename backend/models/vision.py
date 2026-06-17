from pydantic import BaseModel, Field

class FramePayload(BaseModel):
    """
    Payload sent by the React frontend containing a single captured frame.

    Attributes:
        image: Base64-encoded JPEG string (from canvas.toDataURL).
               The 'data:image/jpeg;base64,' prefix is optional — we strip
               it server-side if present.
    """
    image: str


class OCRResult(BaseModel):
    """
    Structured response returned after OCR processing.

    Attributes:
        raw_text:        The unprocessed string returned by Tesseract.
        candidates:      Top-5 refined drug name candidates (sorted by confidence).
        word_count:      Number of tokens in the raw OCR output.
        psm_used:        Tesseract Page Segmentation Mode used (6 primary, 11 fallback).
        processing_note: Human-readable note about the processing outcome.
    """
    raw_text: str
    candidates: list[str]
    word_count: int
    psm_used: int
    processing_note: str


class DecipheredDrug(BaseModel):
    brand_name: str = Field(description="The brand name of the drug, e.g., Crocin, Lipitor")
    generic_name: str = Field(description="The generic/chemical name of the drug, e.g., Paracetamol, Atorvastatin")
    dosage_strength: str = Field(description="Dosage strength, e.g., 500mg, 10mg")
    frequency: str = Field(description="How often to take it, e.g., once daily, twice a day, TDS")
    instructions: str = Field(description="Any specific instructions, e.g., after food, at bedtime")


class DecipheredPrescription(BaseModel):
    drugs: list[DecipheredDrug] = Field(description="List of drugs deciphered from the prescription")
    patient_notes: str = Field(description="Any additional instructions or general notes written on the prescription")


class TranscribedMedication(BaseModel):
    brand_name: str = Field(description="The brand name of the drug, e.g., Crocin, Lipitor")
    generic_name: str = Field(description="The generic name of the drug, e.g., Paracetamol, Atorvastatin", default="")
    dosage_strength: str = Field(description="Dosage strength, e.g., 500mg, 10mg", default="")
    frequency: str = Field(description="How often to take it, e.g., once daily, twice a day, TDS", default="")
    duration: str = Field(description="Duration of treatment, e.g., 5 days, 1 week", default="")
    is_unverified: bool = Field(description="True if the drug is not in local databases", default=False)
    suggested_name: str = Field(description="Suggested spelling correction if unverified", default="")


class TranscribedAppointment(BaseModel):
    title: str = Field(description="Title or purpose of appointment, e.g. Follow-up visit, Blood test")
    date: str = Field(description="Date of appointment in YYYY-MM-DD or standard descriptive format")
    time: str = Field(description="Time of appointment, e.g., 10:00 AM, Evening", default="")
    notes: str = Field(description="Additional notes or instructions", default="")


class TranscriptionResult(BaseModel):
    transcript: str = Field(description="The full raw transcription text of the consultation")
    medications: list[TranscribedMedication] = Field(description="Extracted list of medications")
    appointments: list[TranscribedAppointment] = Field(description="Extracted list of upcoming appointments")
    warnings: list[str] = Field(description="Extracted list of special patient warnings or dietary instructions", default_factory=list)
    confidence: float = Field(description="Transcription confidence score from 0.0 to 1.0", default=1.0)
    is_incomplete: bool = Field(description="True if confidence is low (< 0.6)", default=False)


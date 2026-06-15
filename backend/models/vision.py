from pydantic import BaseModel

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

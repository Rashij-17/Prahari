"""
Prahari — Vision Router
========================
FastAPI router handling all camera frame ingestion and OCR processing.

Endpoint:
    POST /scan/process
        Receives a Base64-encoded JPEG frame from the React frontend,
        runs the full OpenCV → Tesseract → text-refiner pipeline,
        and returns the top drug name candidates along with the raw
        OCR text for debugging.

Source: FEATURES_AND_STRUCTURE.md §2.1.3, §2.1.4 and IMPLEMENTATION_PLAN.md Phase 3
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.ocr_service import process_image_frame

# ---------------------------------------------------------------------------
# Router Definition
# ---------------------------------------------------------------------------

router = APIRouter()

# ---------------------------------------------------------------------------
# Request / Response Schemas
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post(
    "/process",
    response_model=OCRResult,
    summary="Process a captured medication label frame",
    description=(
        "Receives a Base64 JPEG frame, runs OpenCV preprocessing and "
        "Tesseract OCR, then returns the extracted text and refined drug "
        "name candidates for downstream RxNorm lookup."
    ),
)
async def process_frame(payload: FramePayload) -> OCRResult:
    """
    Full OCR pipeline endpoint.

    Pipeline steps:
        1. Decode Base64 → NumPy array via cv2.imdecode
        2. Greyscale conversion
        3. 1.5× upscale (INTER_CUBIC)
        4. Gaussian blur (5×5)
        5. Adaptive threshold (GAUSSIAN_C, 11, 2)
        6. Deskew via Hough Transform (±15°)
        7. Morphological opening (noise removal)
        8. Tesseract OCR (OEM 3, PSM 6; fallback PSM 11 if < 20 tokens)
        9. Text refinement: noise stripping, OCR substitution correction,
           candidate phrase extraction → Top 5 candidates

    Args:
        payload: FramePayload containing the Base64 image string.

    Returns:
        OCRResult with raw text, candidates, and metadata.

    Raises:
        HTTPException 400: If the image cannot be decoded.
        HTTPException 422: If no text could be extracted.
        HTTPException 500: If the OCR service fails unexpectedly.
    """
    if not payload.image:
        raise HTTPException(status_code=400, detail="Image payload is empty.")

    try:
        result = process_image_frame(payload.image)
        return result
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=f"OCR processing failed: {exc}") from exc

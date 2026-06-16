"""
Prahari — OCR Service
======================
Core computer vision and text extraction pipeline.

This module implements the full image processing chain described in
FEATURES_AND_STRUCTURE.md §2.1.2 (OpenCV preprocessing) and §2.1.3
(Tesseract OCR extraction).

All processing is done in-memory. No image data is written to disk
at any point — frames are processed within the request lifecycle and
garbage-collected on completion.

Dependencies:
    - opencv-python (cv2)
    - pytesseract
    - Pillow (PIL)
    - numpy
"""

import base64
import logging
from io import BytesIO

import cv2
import numpy as np
import pytesseract
from PIL import Image

from utils.text_refiner import refine_ocr_output

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Tesseract Binary Path (Windows)
# ---------------------------------------------------------------------------
# pytesseract wraps the Tesseract binary. On Windows it may not find it via
# PATH, so we set the path explicitly. Adjust if installed to a custom location.
import os
_TESSERACT_DEFAULT_PATH = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
if os.path.exists(_TESSERACT_DEFAULT_PATH):
    pytesseract.pytesseract.tesseract_cmd = _TESSERACT_DEFAULT_PATH

# ---------------------------------------------------------------------------
# Tesseract Configuration
# ---------------------------------------------------------------------------

# OEM 3 → LSTM neural network engine (highest accuracy on pharma label fonts)
# PSM 6 → Assume a single uniform block of text (standard medication labels)
# PSM 11 → Sparse text: fallback for non-standard layouts
_TESSERACT_PSM6  = r"--oem 3 --psm 6 -l eng"
_TESSERACT_PSM11 = r"--oem 3 --psm 11 -l eng"

# Token count threshold below which PSM 6 result is considered poor
_PSM6_MIN_TOKENS = 20


# ---------------------------------------------------------------------------
# Image Preprocessing Pipeline
# ---------------------------------------------------------------------------

def _decode_base64_image(b64_string: str) -> np.ndarray:
    """
    Decode a Base64-encoded JPEG string into an OpenCV BGR NumPy array.

    Handles both raw Base64 strings and Data URI formatted strings
    (e.g. 'data:image/jpeg;base64,...').

    Args:
        b64_string: Base64 JPEG string from canvas.toDataURL().

    Returns:
        NumPy array in BGR colour format (OpenCV native).

    Raises:
        ValueError: If the string cannot be decoded or the image is invalid.
    """
    # Strip the Data URI prefix if present (sent by canvas.toDataURL)
    if "," in b64_string:
        b64_string = b64_string.split(",", 1)[1]

    try:
        image_bytes = base64.b64decode(b64_string)
    except Exception as exc:
        raise ValueError(f"Invalid Base64 encoding: {exc}") from exc

    # Convert bytes → NumPy array → OpenCV image
    np_array = np.frombuffer(image_bytes, dtype=np.uint8)
    img = cv2.imdecode(np_array, cv2.IMREAD_COLOR)

    if img is None:
        raise ValueError(
            "cv2.imdecode returned None — the image data may be corrupt "
            "or in an unsupported format."
        )

    return img


def _preprocess_for_ocr(img: np.ndarray) -> np.ndarray:
    """
    Apply the full seven-step OpenCV preprocessing pipeline to maximise
    Tesseract accuracy on pharmaceutical label images.

    Steps (source: FEATURES_AND_STRUCTURE.md §2.1.2):
        1. Greyscale conversion  — removes colour noise
        2. 1.5× upscale          — improves small-text OCR accuracy
        3. Gaussian blur (5×5)   — smooths noise before thresholding
        4. Adaptive threshold    — binarises uneven lighting conditions
        5. Deskew (±15°)         — corrects label tilt via Hough lines
        6. Morphological opening — removes speckle artefacts

    Args:
        img: BGR NumPy array from cv2.imdecode.

    Returns:
        Preprocessed binary (thresholded) NumPy array ready for Tesseract.
    """
    # Step 1 — Convert to greyscale
    grey = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    logger.debug("Step 1 complete: greyscale. Shape: %s", grey.shape)

    # Step 2 — Upscale by 1.5× using cubic interpolation
    # Enlarging small text dramatically improves OCR character recognition.
    h, w = grey.shape
    upscaled = cv2.resize(
        grey,
        (int(w * 1.5), int(h * 1.5)),
        interpolation=cv2.INTER_CUBIC,
    )
    logger.debug("Step 2 complete: upscaled to %s", upscaled.shape)

    # Step 3 — Gaussian blur to reduce high-frequency noise
    blurred = cv2.GaussianBlur(upscaled, (5, 5), 0)

    # Step 4 — Adaptive threshold: handles uneven lighting across the label
    # ADAPTIVE_THRESH_GAUSSIAN_C uses a weighted sum of neighbourhood pixels.
    # blockSize=11, C=2 are empirically good values for pharma labels.
    binary = cv2.adaptiveThreshold(
        blurred,
        maxValue=255,
        adaptiveMethod=cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        thresholdType=cv2.THRESH_BINARY,
        blockSize=11,
        C=2,
    )
    logger.debug("Step 4 complete: adaptive threshold applied.")

    # Step 5 — Deskew: detect label tilt and correct by up to ±15°
    binary = _deskew(binary)
    logger.debug("Step 5 complete: deskew applied.")

    # Step 6 — Morphological opening: erode then dilate to remove speckles
    # A 1×1 kernel removes isolated noise pixels without affecting text strokes.
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, 1))
    cleaned = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel)
    logger.debug("Step 6 complete: morphological opening applied.")

    return cleaned


def _deskew(binary_img: np.ndarray, max_angle_deg: float = 15.0) -> np.ndarray:
    """
    Detect and correct image skew (tilt) using the Hough Line Transform.

    If no dominant angle is detected, or if the detected angle exceeds
    the max_angle_deg threshold, the image is returned unchanged to avoid
    over-rotation on non-skewed labels.

    Args:
        binary_img:    Binary (thresholded) single-channel image.
        max_angle_deg: Maximum correctable skew angle in degrees.

    Returns:
        Deskewed image (or original if no correction needed).
    """
    try:
        # Detect line segments via probabilistic Hough Transform
        edges = cv2.Canny(binary_img, 50, 150, apertureSize=3)
        lines = cv2.HoughLinesP(
            edges,
            rho=1,
            theta=np.pi / 180,
            threshold=100,
            minLineLength=100,
            maxLineGap=10,
        )

        if lines is None or len(lines) == 0:
            return binary_img

        # Calculate the median angle of all detected line segments
        angles = []
        for line in lines:
            x1, y1, x2, y2 = line[0]
            if x2 != x1:  # avoid division by zero for vertical lines
                angle = np.degrees(np.arctan2(y2 - y1, x2 - x1))
                angles.append(angle)

        if not angles:
            return binary_img

        median_angle = float(np.median(angles))

        # Only correct if skew is within the acceptable range
        if abs(median_angle) > max_angle_deg:
            logger.debug(
                "Skew angle %.1f° exceeds threshold (%.1f°) — skipping deskew.",
                median_angle,
                max_angle_deg,
            )
            return binary_img

        # Rotate the image to correct the skew
        h, w = binary_img.shape
        centre = (w // 2, h // 2)
        rotation_matrix = cv2.getRotationMatrix2D(centre, median_angle, 1.0)
        deskewed = cv2.warpAffine(
            binary_img,
            rotation_matrix,
            (w, h),
            flags=cv2.INTER_LINEAR,
            borderMode=cv2.BORDER_REPLICATE,
        )

        logger.debug("Deskewed by %.2f°", median_angle)
        return deskewed

    except Exception as exc:
        # Deskew is a best-effort step — log and return original on any error
        logger.warning("Deskew failed (non-fatal): %s", exc)
        return binary_img


# ---------------------------------------------------------------------------
# Tesseract OCR Extraction
# ---------------------------------------------------------------------------

def _run_tesseract(preprocessed_img: np.ndarray) -> tuple[str, int]:
    """
    Run Tesseract OCR on a preprocessed binary image.

    Primary pass: PSM 6 (single uniform block of text).
    Fallback:     PSM 11 (sparse text) if primary yields < 20 tokens.

    Args:
        preprocessed_img: Binary NumPy array from _preprocess_for_ocr().

    Returns:
        Tuple of (raw_text: str, psm_mode_used: int).

    Raises:
        RuntimeError: If Tesseract is not installed or fails unexpectedly.
    """
    # Convert NumPy array to PIL Image (required by pytesseract)
    pil_image = Image.fromarray(preprocessed_img)

    try:
        # Primary pass — PSM 6: single uniform text block
        raw_text = pytesseract.image_to_string(pil_image, config=_TESSERACT_PSM6)
        token_count = len(raw_text.split())

        logger.info("PSM 6 extraction: %d tokens.", token_count)

        # Fallback — PSM 11: sparse text layout (unusual label formats)
        if token_count < _PSM6_MIN_TOKENS:
            logger.info(
                "Token count (%d) below threshold (%d). Retrying with PSM 11.",
                token_count,
                _PSM6_MIN_TOKENS,
            )
            fallback_text = pytesseract.image_to_string(pil_image, config=_TESSERACT_PSM11)
            fallback_tokens = len(fallback_text.split())

            # Use whichever pass produced more tokens
            if fallback_tokens > token_count:
                logger.info("PSM 11 produced more tokens (%d). Using fallback.", fallback_tokens)
                return fallback_text, 11

        return raw_text, 6

    except pytesseract.TesseractNotFoundError as exc:
        raise RuntimeError(
            "Tesseract is not installed or not found in PATH. "
            "Please install Tesseract OCR: https://github.com/UB-Mannheim/tesseract/wiki"
        ) from exc
    except Exception as exc:
        raise RuntimeError(f"Tesseract failed: {exc}") from exc


# ---------------------------------------------------------------------------
# Public API — Main Pipeline Entry Point
# ---------------------------------------------------------------------------

def process_image_frame(b64_image: str) -> dict:
    """
    Execute the complete OCR pipeline for a single captured frame.

    This is the only function called externally (by the vision router).
    All other functions in this module are internal pipeline steps.

    Pipeline summary:
        Base64 decode → OpenCV preprocess → Tesseract OCR → Text refinement

    Args:
        b64_image: Base64-encoded JPEG string from the React scanner.

    Returns:
        Dict matching the OCRResult schema:
        {
            "raw_text":        str,
            "candidates":      list[str],   # top-5 drug name candidates
            "word_count":      int,
            "psm_used":        int,
            "processing_note": str,
        }

    Raises:
        ValueError: If the image cannot be decoded.
        RuntimeError: If OCR fails or Tesseract is not installed.
    """
    logger.info("OCR pipeline started.")

    # Step 1–6: Decode and preprocess the image
    raw_img = _decode_base64_image(b64_image)
    preprocessed = _preprocess_for_ocr(raw_img)

    # Step 7: Run Tesseract OCR
    raw_text, psm_used = _run_tesseract(preprocessed)
    word_count = len(raw_text.split())

    # Step 8: Refine the raw OCR output → extract top drug name candidates
    raw_candidates = refine_ocr_output(raw_text)

    # Apply centralized spelling correction on each candidate
    from services.fuzzy_service import fuzzy_correct_drug_token
    corrected = []
    seen = set()
    for c in raw_candidates:
        corr_c = fuzzy_correct_drug_token(c)
        if corr_c.lower() not in seen:
            seen.add(corr_c.lower())
            corrected.append(corr_c)

    candidates = corrected

    # Build a processing note for transparency
    if word_count == 0:
        note = "No text could be extracted. Try better lighting or a clearer image."
    elif word_count < 5:
        note = f"Very little text detected ({word_count} words). Result may be incomplete."
    else:
        note = f"Successfully extracted {word_count} words using PSM {psm_used}."

    logger.info("OCR pipeline complete. PSM: %d, Tokens: %d, Candidates: %s",
                psm_used, word_count, candidates)

    return {
        "raw_text":        raw_text.strip(),
        "candidates":      candidates,
        "word_count":      word_count,
        "psm_used":        psm_used,
        "processing_note": note,
    }

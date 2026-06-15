"""
Prahari — OCR Text Refiner
===========================
Post-processes raw Tesseract output to extract high-quality
drug name candidates from noisy pharmaceutical label text.

Implements the four-step refinement pipeline described in
FEATURES_AND_STRUCTURE.md §2.1.4:

    1. Noise stripping       — remove non-alphanumeric junk characters
    2. OCR substitution fix  — correct common pharma-context OCR misreads
    3. Candidate extraction  — extract noun phrases and capitalised tokens
    4. Top-N ranking         — return the 5 best drug name candidates

These candidates are passed to the Medication Intelligence pipeline
(Phase 4) for RxNorm lookup.
"""

import re
import logging

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# OCR Substitution Lookup Table
# ---------------------------------------------------------------------------
# Common OCR misreads in pharmaceutical label contexts.
# Source: FEATURES_AND_STRUCTURE.md §2.1.4 "Common OCR Substitution Correction"

_OCR_SUBSTITUTIONS: dict[str, str] = {
    # Dosage numeral corrections
    r"\bl\b": "1",          # lowercase l read as 1 in dosage (e.g., "l0mg" → "10mg")
    r"(?<=[A-Z])0(?=[A-Z])": "O",  # 0 → O in amino acid / drug prefixes
    r"rn": "m",             # 'rn' ligature read as 'm' (e.g., "arnoxicillin" → "amoxicillin")
    r"\bcl(?=ia|ic|ig|il|ol|ul|eslora|exame)": "d", # 'cl' misread for 'd' (e.g., cliazepam -> diazepam)
    r"\|": "I",             # pipe character read as capital I
    r"(?<=\d)O(?=\d)": "0",  # O between digits should be 0 in dose numbers

    # Common pharmaceutical suffix corrections
    r"rnin": "min",         # "rninutes" → "minutes"
    r"hydrochloricle": "hydrochloride",
    r"sulphcite": "sulphate",

    # Brand/generic name patterns
    r"(?<=[A-Z])\s(?=[A-Z]{2,})": "",  # remove erroneous space mid-word in all-caps brand names
}

# ---------------------------------------------------------------------------
# Pharmaceutical Keywords (boost scoring for nearby candidates)
# ---------------------------------------------------------------------------

_PHARMA_KEYWORDS: set[str] = {
    "mg", "mcg", "ug", "ml", "tablet", "tablets", "capsule", "capsules",
    "injection", "solution", "syrup", "cream", "ointment", "gel", "patch",
    "usp", "bp", "ip", "oral", "topical", "intravenous", "iv", "im",
    "dose", "dosage", "strength", "each", "contains", "active", "ingredient",
    "500", "250", "100", "50", "25", "10", "5", "1000",
}

# Common words that appear on labels but are not drug names
_STOP_WORDS: set[str] = {
    "tablet", "tablets", "capsule", "capsules", "film", "coated",
    "injection", "solution", "oral", "topical", "each", "contains",
    "active", "ingredient", "ingredients", "manufactured", "distributed",
    "store", "below", "keep", "reach", "children", "direction",
    "physician", "consult", "before", "after", "food", "read", "label",
    "warning", "caution", "danger", "important", "notice", "batch",
    "expiry", "expires", "date", "mfg", "mfd", "license", "licensed",
    "under", "from", "with", "this", "that", "only", "once", "twice",
    "daily", "times", "take", "dose", "dosage", "adults", "children",
    "uses", "side", "effects", "indicated", "contraindicated",
}

# ---------------------------------------------------------------------------
# Regex Patterns
# ---------------------------------------------------------------------------

# Drug name pattern: capitalised words ≥ 4 chars, possibly followed by dose
_DRUG_CANDIDATE_PATTERN = re.compile(
    r"\b([A-Z][a-z]{3,}(?:[A-Z][a-z]+)*)\b"
)

# Dose marker pattern: numbers followed by mg/mcg/ml etc.
_DOSE_PATTERN = re.compile(
    r"\b\d+(?:\.\d+)?\s*(?:mg|mcg|ml|ug|g|iu)\b",
    re.IGNORECASE,
)

# Characters that are pure noise in drug label context
_NOISE_CHARS_PATTERN = re.compile(
    r"[^a-zA-Z0-9\s\-\./\(\),:%°]"
)

# Repeated punctuation / whitespace
_EXCESS_WHITESPACE = re.compile(r"\s{2,}")


# ---------------------------------------------------------------------------
# Pipeline Steps
# ---------------------------------------------------------------------------

def _strip_noise(text: str) -> str:
    """
    Remove non-alphanumeric characters that are not part of known drug
    name patterns (pipe chars, stray symbols, repeated dashes, etc.).

    Preserves:
        - Letters, digits, spaces
        - Hyphens (drug name separators e.g. "co-amoxiclav")
        - Slashes (e.g. "mg/ml"), dots (decimal doses), brackets, commas

    Args:
        text: Raw Tesseract output string.

    Returns:
        Cleaned string with noise characters removed.
    """
    cleaned = _NOISE_CHARS_PATTERN.sub(" ", text)
    cleaned = _EXCESS_WHITESPACE.sub(" ", cleaned)
    return cleaned.strip()


def _apply_substitutions(text: str) -> str:
    """
    Apply the pharmaceutical OCR substitution lookup table to correct
    common character-level misreads in drug name/dosage contexts.

    Args:
        text: Noise-stripped OCR text.

    Returns:
        Text with common OCR errors corrected.
    """
    for pattern, replacement in _OCR_SUBSTITUTIONS.items():
        try:
            text = re.sub(pattern, replacement, text)
        except re.error as exc:
            # Defensive: skip broken patterns rather than crash
            logger.warning("Substitution pattern error ('%s'): %s", pattern, exc)
    return text


def _extract_candidates(text: str) -> list[str]:
    """
    Extract potential drug name candidates from the refined OCR text.

    Strategy:
        1. Find all Title-Cased words ≥ 4 characters (most drug names are
           capitalised on labels: "Paracetamol", "Amoxicillin", "Metformin").
        2. Include any ALL-CAPS tokens ≥ 3 characters (brand names).
        3. Filter out common English stop-words and pharma label boilerplate.
        4. Boost candidates that appear near dose markers (mg/mcg/ml).

    Args:
        text: OCR text after noise stripping and substitution correction.

    Returns:
        Unordered list of raw candidate strings.
    """
    # --- Extract title-cased drug name candidates ---
    candidates: list[str] = _DRUG_CANDIDATE_PATTERN.findall(text)

    # --- Also catch ALL-CAPS brand names (≥ 3 chars) ---
    all_caps = re.findall(r"\b[A-Z]{3,}\b", text)
    candidates.extend(all_caps)

    # --- Deduplicate while preserving order ---
    seen: set[str] = set()
    unique: list[str] = []
    for c in candidates:
        normalised = c.strip().lower()
        if normalised not in seen and len(c) >= 3:
            seen.add(normalised)
            unique.append(c.strip())

    return unique


def _filter_boilerplate(candidates: list[str]) -> list[str]:
    """
    Remove generic pharmaceutical label boilerplate words from the
    candidate list that are not drug names.

    Args:
        candidates: Raw extracted candidate list.

    Returns:
        Filtered list with boilerplate removed.
    """
    return [
        c for c in candidates
        if c.lower() not in _stop_words_lower(_STOP_WORDS)
        and len(c) >= 3
    ]


def _stop_words_lower(stop_set: set[str]) -> set[str]:
    """Return a lowercase version of the stop words set (cached inline)."""
    return {w.lower() for w in stop_set}


def _rank_candidates(candidates: list[str], original_text: str, top_n: int = 5) -> list[str]:
    """
    Rank drug name candidates by confidence score and return the top N.

    Scoring heuristics:
        +3  — candidate appears adjacent to a dose marker (mg/mcg/ml)
        +2  — candidate length is between 5 and 15 chars (typical drug name)
        +1  — candidate is Title-Cased (standard label capitalisation)
        +1  — candidate appears more than once in the text
        -1  — candidate is all-caps and > 12 chars (likely a heading, not drug)

    Args:
        candidates: Filtered list of candidate strings.
        original_text: The full cleaned OCR text (for context scoring).
        top_n: Number of top candidates to return.

    Returns:
        Top-N candidates sorted by descending confidence score.
    """
    # Find positions of dose markers for proximity scoring
    dose_positions = [m.start() for m in _DOSE_PATTERN.finditer(original_text)]

    def score(candidate: str) -> int:
        s = 0

        # Proximity to dose marker
        try:
            pos = original_text.index(candidate)
            if any(abs(pos - dp) < 50 for dp in dose_positions):
                s += 3
        except ValueError:
            pass

        # Length heuristic
        if 5 <= len(candidate) <= 15:
            s += 2

        # Title-case bonus
        if candidate[0].isupper() and not candidate.isupper():
            s += 1

        # Frequency bonus
        count = original_text.lower().count(candidate.lower())
        if count > 1:
            s += 1

        # Penalise long all-caps (likely header text)
        if candidate.isupper() and len(candidate) > 12:
            s -= 1

        return s

    ranked = sorted(candidates, key=score, reverse=True)
    return ranked[:top_n]


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def refine_ocr_output(raw_text: str) -> list[str]:
    """
    Full text refinement pipeline.

    Processes raw Tesseract output through noise stripping, OCR
    substitution correction, candidate extraction, boilerplate filtering,
    and confidence ranking.

    Args:
        raw_text: Unprocessed string from pytesseract.image_to_string().

    Returns:
        List of up to 5 drug name candidate strings, ranked by confidence.
        Returns an empty list if no viable candidates are found.
    """
    if not raw_text or not raw_text.strip():
        logger.warning("refine_ocr_output received empty text.")
        return []

    # Step 1: Strip noise characters
    cleaned = _strip_noise(raw_text)

    # Step 2: Correct common pharmaceutical OCR misreads
    corrected = _apply_substitutions(cleaned)

    # Step 3: Extract candidate phrases
    raw_candidates = _extract_candidates(corrected)

    # Step 4: Remove boilerplate / non-drug words
    filtered = _filter_boilerplate(raw_candidates)

    # Step 5: Rank and return top 5
    top_candidates = _rank_candidates(filtered, corrected, top_n=5)

    logger.info(
        "Text refinement: %d raw → %d filtered → %d candidates returned.",
        len(raw_candidates),
        len(filtered),
        len(top_candidates),
    )

    return top_candidates

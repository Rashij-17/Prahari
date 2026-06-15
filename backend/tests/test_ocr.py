import pytest
from utils.text_refiner import (
    refine_ocr_output,
    _strip_noise,
    _apply_substitutions,
    _extract_candidates,
    _rank_candidates
)

def test_strip_noise():
    # Basic symbols and punctuation should be stripped, keeping spaces, letters, and digits
    raw = "Metformin @1000mg !!! [Batch #9283]"
    cleaned = _strip_noise(raw)
    assert "@" not in cleaned
    assert "!" not in cleaned
    assert "#" not in cleaned
    assert "[" not in cleaned
    assert "]" not in cleaned
    assert "Metformin 1000mg" in cleaned
    assert "Batch 9283" in cleaned

def test_apply_substitutions():
    # Suffix/ligature replacements
    assert _apply_substitutions("arnoxicillin") == "amoxicillin"  # rn -> m
    assert _apply_substitutions("hydrochloricle") == "hydrochloride"  # suffix correction
    assert _apply_substitutions("sulphcite") == "sulphate"  # suffix correction
    assert _apply_substitutions("l0mg") == "10mg"  # lowercase l to 1 in dosage
    
    # cl -> d lookahead substitutions
    assert _apply_substitutions("cliazepam") == "diazepam"  # matching prefix rule
    assert _apply_substitutions("cloxacillin") == "cloxacillin"  # non-matching prefix, should remain unchanged
    assert _apply_substitutions("clinical") == "clinical"  # non-matching prefix, should remain unchanged

def test_extract_candidates():
    # Capitalized words >= 4 chars or containing digits
    text = "Metformin is a drug while aspirin is not capitalized"
    candidates = _extract_candidates(text)
    assert "Metformin" in candidates
    assert "aspirin" not in candidates  # lowercase

def test_rank_candidates():
    candidates = ["Metformin", "Aspirin", "Paracetamol"]
    # If the original text contains 'Metformin' close to pharmaceutical keywords, it gets boosted
    original = "Metformin Hydrochloride 500mg tablets"
    ranked = _rank_candidates(candidates, original)
    assert ranked[0] == "Metformin"

def test_refine_ocr_output_full_pipeline():
    raw_ocr = "Rx Only\nBatch: 10293\nMetformin Hydrochloride 500mg\nStore below 25C"
    candidates = refine_ocr_output(raw_ocr)
    assert len(candidates) > 0
    assert "Metformin" in candidates

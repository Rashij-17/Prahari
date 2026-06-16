import pytest
from services.fuzzy_service import (
    levenshtein_distance,
    clean_brand_name,
    fuzzy_correct_drug_token,
    load_fuzzy_caches
)

def test_levenshtein_distance():
    # Identical strings
    assert levenshtein_distance("dolo", "dolo") == 0
    # 1 deletion
    assert levenshtein_distance("dolo", "dol") == 1
    # 1 insertion
    assert levenshtein_distance("dolo", "dolos") == 1
    # 1 substitution
    assert levenshtein_distance("dolo", "dola") == 1
    # 2 substitutions
    assert levenshtein_distance("dolo", "dala") == 2
    # Case sensitive comparison by default
    assert levenshtein_distance("Dolo", "dolo") == 1
    # Empty string
    assert levenshtein_distance("", "dolo") == 4
    assert levenshtein_distance("dolo", "") == 4


def test_clean_brand_name():
    assert clean_brand_name("Dolo 650 Tablet") == "dolo"
    assert clean_brand_name("Crocin 120ml Syrup") == "crocin"
    assert clean_brand_name("Montek-LC 10mg/5mg Capsule") == "montek-lc"
    assert clean_brand_name("") == ""
    assert clean_brand_name("Tablet Dolo") == "dolo"


def test_fuzzy_correct_drug_token():
    # Make sure cache is preloaded
    load_fuzzy_caches()
    
    # Test spelling correction on common generic compositions (e.g. Paracetamol, Amoxicillin)
    # Tesseract might output "prmol" or similar
    res1 = fuzzy_correct_drug_token("paracetml")
    assert "paracetamol" in res1.lower()
    
    res2 = fuzzy_correct_drug_token("amoxcilln")
    assert "amoxicillin" in res2.lower() or "amoxycillin" in res2.lower()
    
    # Test case preservation
    res3 = fuzzy_correct_drug_token("PARACETML")
    assert res3.isupper()
    
    res4 = fuzzy_correct_drug_token("Paracetml")
    assert res4[0].isupper() and not res4.isupper()
    
    # Test short tokens are not over-corrected
    assert fuzzy_correct_drug_token("abc") == "abc"
    assert fuzzy_correct_drug_token("xyz") == "xyz"
    
    # Test stop words remain unchanged
    assert fuzzy_correct_drug_token("fever") == "fever"
    assert fuzzy_correct_drug_token("pain") == "pain"
    assert fuzzy_correct_drug_token("tablet") == "tablet"

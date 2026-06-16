"""
Prahari — Centralized Fuzzy Matching spelling Correction Service
==================================================================
Preloads generic ingredients and top brand names from the local SQLite database
into memory, and provides Levenshtein-distance based spelling correction for
both search queries and OCR candidate tokens.
"""

import os
import re
import sqlite3
import logging
from typing import Set

logger = logging.getLogger(__name__)

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "indian_medicines.db")

# In-memory caches for fast lookup
_INGREDIENTS_CACHE: Set[str] = set()
_BRANDS_CACHE: Set[str] = set()
_IS_LOADED = False


def levenshtein_distance(s1: str, s2: str) -> int:
    """Calculate the Levenshtein distance between two strings."""
    if len(s1) < len(s2):
        return levenshtein_distance(s2, s1)
    if len(s2) == 0:
        return len(s1)
    
    previous_row = range(len(s2) + 1)
    for i, c1 in enumerate(s1):
        current_row = [i + 1]
        for j, c2 in enumerate(s2):
            insertions = previous_row[j + 1] + 1
            deletions = current_row[j] + 1
            substitutions = previous_row[j] + (c1 != c2)
            current_row.append(min(insertions, deletions, substitutions))
        previous_row = current_row
        
    return previous_row[-1]


def clean_brand_name(name: str) -> str:
    """
    Clean full brand names to extract the base name (e.g. 'Dolo 650 Tablet' -> 'dolo').
    """
    if not name:
        return ""
    name_clean = name.lower().strip()
    
    # Strip strengths and dosage forms
    name_clean = re.sub(r'\b\d+(?:\.\d+)?\s*(?:mg|ml|%|g|mcg|units|iu|tab|cap|puff|dose)\b', '', name_clean)
    name_clean = re.sub(r'\b\d+(?:\.\d+)?\b', '', name_clean)
    
    dosage_words = [
        "oral", "tablet", "tablets", "capsule", "capsules", "suspension", 
        "injection", "injections", "solution", "solutions", "cream", "creams", 
        "ointment", "ointments", "gel", "gels", "syrup", "syrups", "drops", 
        "drop", "inhaler", "inhalers", "spray", "sprays", "powder", "powders", 
        "sachet", "sachets", "lotion", "lotions"
    ]
    for word in dosage_words:
        name_clean = re.sub(rf'\b{word}\b', '', name_clean)
        
    name_clean = re.sub(r'\s+', ' ', name_clean).strip()
    return name_clean.strip(" /-,.()")


def load_fuzzy_caches(force: bool = False):
    """
    Preload unique generic names and top brand names from SQLite database.
    Does nothing if already loaded, unless force=True.
    """
    global _INGREDIENTS_CACHE, _BRANDS_CACHE, _IS_LOADED
    if _IS_LOADED and not force:
        return
        
    if not os.path.exists(DB_PATH):
        logger.warning("Indian medicine database not found at %s. Fuzzy cache is empty.", DB_PATH)
        return
        
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # 1. Load active generic ingredients
        cursor.execute("SELECT DISTINCT short_composition1, short_composition2 FROM medicines;")
        rows = cursor.fetchall()
        for r in rows:
            for comp in r:
                if comp:
                    # Strip parenthesized strengths, e.g. "Amoxycillin (500mg)" -> "amoxycillin"
                    clean_comp = re.sub(r'\(.*?\)', '', comp).strip().lower()
                    if clean_comp:
                        _INGREDIENTS_CACHE.add(clean_comp)
                        
        # 2. Load top brand names (limit to first 5000 to keep memory footprint reasonable)
        cursor.execute("SELECT name FROM medicines LIMIT 5000;")
        brand_rows = cursor.fetchall()
        for r in brand_rows:
            if r[0]:
                cleaned = clean_brand_name(r[0])
                if cleaned and len(cleaned) >= 3:
                    _BRANDS_CACHE.add(cleaned)
                    
        conn.close()
        _IS_LOADED = True
        logger.info(
            "Fuzzy caches loaded successfully: %d ingredients, %d base brand names.",
            len(_INGREDIENTS_CACHE), len(_BRANDS_CACHE)
        )
    except Exception as e:
        logger.error("Failed to preload fuzzy matching database: %s", e)


def fuzzy_correct_drug_token(token: str) -> str:
    """
    Fuzzy match a single token against the preloaded generic ingredients and brand names.
    If a close match is found within a dynamic Levenshtein threshold, return the corrected name.
    Otherwise, return the token unchanged.
    
    Thresholds:
      - Length <= 4: max distance 1
      - Length > 4: max distance 2
    """
    load_fuzzy_caches()
    t_lower = token.lower().strip()
    if not t_lower or len(t_lower) < 3:
        return token
        
    # Check if exact match exists in ingredients or brand names
    if t_lower in _INGREDIENTS_CACHE or t_lower in _BRANDS_CACHE:
        return token
        
    # Skip common clinical stop words
    stop_words = {
        "pain", "relief", "cough", "cold", "fever", "tablet", "tablets", 
        "capsule", "capsules", "gel", "syrup", "drops", "dose", "mg", "ml"
    }
    if t_lower in stop_words:
        return token
        
    best_match = None
    min_dist = 999
    
    # Check ingredients
    for ing in _INGREDIENTS_CACHE:
        dist = levenshtein_distance(t_lower, ing)
        if dist < min_dist:
            min_dist = dist
            best_match = ing
            
    # Check brand names
    for brand in _BRANDS_CACHE:
        dist = levenshtein_distance(t_lower, brand)
        if dist < min_dist:
            min_dist = dist
            best_match = brand
            
    # Determine dynamic threshold
    if len(t_lower) <= 3:
        max_allowed_dist = 0
    elif len(t_lower) <= 5:
        max_allowed_dist = 1
    else:
        max_allowed_dist = 2
        
    if min_dist <= max_allowed_dist and best_match:
        # Match capitalization of original token
        if token[0].isupper() and not token.isupper():
            return best_match.title()
        elif token.isupper():
            return best_match.upper()
        return best_match
        
    return token

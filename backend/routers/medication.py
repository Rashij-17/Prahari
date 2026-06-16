"""
Prahari — Medication Intelligence Router
=========================================
FastAPI router providing drug information endpoints for Phase 4.

Two-stage lookup pipeline:
    1. Local Indian Medicine SQLite lookup (250,000+ brands with compositions, prices, manufacturers)
    2. Fallback to RxNorm / openFDA API for clinical profiles of resolved active generic salts

Endpoints:
    GET  /medication/profile?name={drug_name}
         Full drug profile (indications, dosage, warnings, interactions, price, pack size)

    GET  /medication/search?q={query}&limit={n}
         Lightweight drug search across local Indian database + RxNorm/openFDA fallback
"""

import re
import os
import sqlite3
import asyncio
import logging
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException, Query, Depends

from middleware.rate_limiter import limit_profile
from models.medication import DrugProfile, DrugSummary, MedicationSearchResponse
from services.rxnorm_service import (
    resolve_name_to_rxcui,
    search_drugs,
    get_drug_details_by_rxcui,
)
from services.openfda_service import (
    get_drug_profile_by_name,
    get_drug_profile_by_rxcui,
    search_drugs_openfda,
)
from routers.indian_drugs_db import INDIAN_DRUGS
from services.scraper_service import scrape_and_cache_brand

logger = logging.getLogger("uvicorn")

router = APIRouter()

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "indian_medicines.db")


def clean_drug_name(name: str) -> list[str]:
    name = name.strip()
    if not name:
        return []

    candidates = []

    # 1. Extract brand name inside square brackets (e.g. "[Lipitor]" -> "Lipitor")
    brand_match = re.search(r'\[(.*?)\]', name)
    if brand_match:
        brand = brand_match.group(1).strip()
        if brand:
            candidates.append(brand)

    # 2. Clean name without brackets
    clean_name = re.sub(r'\[.*?\]', '', name).strip()

    # 3. Clean common strength/dosage units to extract clean base prefix
    num_match = re.search(r'\b\d+(?:\.\d+)?\s*(?:mg|ml|%|g|mcg|units|iu|tab|cap|puff|dose)\b', clean_name, re.IGNORECASE)
    if num_match:
        prefix = clean_name[:num_match.start()].strip()
        if prefix:
            candidates.append(prefix)
    else:
        num_match_simple = re.search(r'\b\d+(?:\.\d+)?\b', clean_name)
        if num_match_simple:
            prefix = clean_name[:num_match_simple.start()].strip()
            if prefix:
                candidates.append(prefix)

    # 4. Strip strengths and dosage forms entirely
    if clean_name:
        temp_clean = clean_name
        temp_clean = re.sub(r'\b\d+(?:\.\d+)?\s*(?:mg|ml|%|g|mcg|units|iu|tab|cap|puff|dose)\b', '', temp_clean, flags=re.IGNORECASE)
        temp_clean = re.sub(r'\b\d+(?:\.\d+)?\b', '', temp_clean)
        dosage_words = ["oral", "tablet", "capsule", "suspension", "injection", "solution", "cream", "ointment", "gel"]
        for word in dosage_words:
            temp_clean = re.sub(rf'\b{word}\b', '', temp_clean, flags=re.IGNORECASE)
        temp_clean = re.sub(r'\s+', ' ', temp_clean).strip()
        if temp_clean:
            candidates.append(temp_clean)
        candidates.append(clean_name)

    candidates.append(name)

    # Deduplicate while preserving order
    seen = set()
    result = []
    for c in candidates:
        c_lower = c.lower()
        if c_lower not in seen and len(c) >= 2:
            seen.add(c_lower)
            result.append(c)

    return result


def clean_composition_name(comp: str) -> str:
    if not comp:
        return ""
    # Remove strength/packaging details inside parentheses, e.g. "Amoxycillin (500mg)" -> "Amoxycillin"
    clean = re.sub(r'\(.*?\)', '', comp).strip()
    return clean


def map_indian_to_us_generic(generic: str) -> str:
    if not generic:
        return ""
    g_lower = generic.lower()
    
    # Common Indian formulation spelling differences vs US-centric databases
    mappings = {
        "paracetamol": "Acetaminophen",
        "amoxycillin": "Amoxicillin",
        "levosalbutamol": "Levalbuterol",
        "salbutamol": "Albuterol",
        "aceclofenac": "Diclofenac",
        "nimesulide": "Ibuprofen",
        "ranitidine": "Ranitidine",
        "omeprazole": "Omeprazole",
        "pantoprazole": "Pantoprazole",
        "cetirizine": "Cetirizine",
        "montelukast": "Montelukast",
        "fexofenadine": "Fexofenadine",
        "atorvastatin": "Atorvastatin",
        "metformin": "Metformin",
        "telmisartan": "Telmisartan",
        "amlodipine": "Amlodipine",
        "spironolactone": "Spironolactone",
        "furosemide": "Furosemide",
    }
    return mappings.get(g_lower, generic)


def normalize_comp(c: str) -> str:
    if not c:
        return ""
    return " ".join(c.lower().strip().split())


def find_jan_aushadhi_alternative(comp1: str, comp2: str) -> Optional[dict]:
    if not os.path.exists(DB_PATH):
        return None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT generic_name, price, pack_size_label, short_composition1, short_composition2 FROM jan_aushadhi_medicines;")
        rows = cursor.fetchall()
        conn.close()
        
        nc1 = normalize_comp(comp1)
        nc2 = normalize_comp(comp2)
        
        for row in rows:
            r_gen_name, r_price, r_pack, r_comp1, r_comp2 = row
            nr1 = normalize_comp(r_comp1)
            nr2 = normalize_comp(r_comp2)
            
            if (nc1 == nr1 and nc2 == nr2) or (nc1 == nr2 and nc2 == nr1):
                return {
                    "generic_name": r_gen_name,
                    "price": r_price,
                    "pack_size_label": r_pack
                }
    except Exception as e:
        logger.error("Error finding Jan Aushadhi alternative: %s", e)
    return None


def parse_pack_size_units(pack_label: str) -> int:
    if not pack_label:
        return 1
    match = re.search(r'\b(\d+)\s*(?:tablet|capsule|ml|vial|injection|gm|bottle|strip|packet|sachet|ampoule)s?\b', pack_label, re.IGNORECASE)
    if match:
        return int(match.group(1))
    match_any = re.search(r'\b(\d+)\b', pack_label)
    if match_any:
        return int(match_any.group(1))
    return 1



INGREDIENTS_CACHE: set[str] = set()

def levenshtein_distance(s1: str, s2: str) -> int:
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


def load_ingredients():
    global INGREDIENTS_CACHE
    if INGREDIENTS_CACHE:
        return
    if not os.path.exists(DB_PATH):
        return
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT short_composition1, short_composition2 FROM medicines;")
        rows = cursor.fetchall()
        conn.close()
        
        for r in rows:
            for comp in r:
                if comp:
                    clean = re.sub(r'\(.*?\)', '', comp).strip().lower()
                    if clean:
                        INGREDIENTS_CACHE.add(clean)
    except Exception as e:
        logger.error("Failed to preload ingredients list for fuzzy matching: %s", e)


def fuzzy_correct_token(token: str) -> str:
    load_ingredients()
    t_lower = token.lower().strip()
    if not t_lower:
        return ""
        
    if t_lower in INGREDIENTS_CACHE:
        return t_lower
        
    # Skip common clinical or search terms
    stop_words = {"pain", "relief", "cough", "cold", "fever", "tablet", "tablets", "capsule", "capsules", "gel", "syrup", "drops"}
    if t_lower in stop_words:
        return t_lower
        
    best_match = None
    min_dist = 999
    
    for ing in INGREDIENTS_CACHE:
        dist = levenshtein_distance(t_lower, ing)
        if dist < min_dist:
            min_dist = dist
            best_match = ing
            
    # Dynamic thresholds based on word length
    if len(t_lower) <= 4:
        max_allowed_dist = 1
    elif len(t_lower) <= 7:
        max_allowed_dist = 1
    else:
        max_allowed_dist = 2
        
    if min_dist <= max_allowed_dist:
        return best_match
    return t_lower


def query_local_indian_db(q: str, limit: int = 8) -> list[DrugSummary]:
    if not os.path.exists(DB_PATH):
        logger.warning("Indian medicine database not found at %s", DB_PATH)
        return []
    
    q = q.strip()
    if not q or len(q) < 2:
        return []
        
    try:
        # Normalize query: replace dashes with spaces to support both formats (e.g. "Montek-LC" -> "Montek LC")
        q_norm = q.replace("-", " ")
        
        # Split by conjunctions/punctuation to support multi-ingredient searches (e.g. "nimesulide and paracetamol")
        tokens = re.split(r'\s+and\s+|\s+or\s+|\s*\+\s*|\s*,\s*|\s*&\s*', q_norm, flags=re.IGNORECASE)
        if len(tokens) == 1:
            # Fall back to whitespace split for multi-word queries like "dolo 650"
            tokens = [t.strip() for t in q_norm.split() if len(t.strip()) >= 2]
            
        corrected_tokens = []
        for t in tokens:
            t = t.strip()
            if t:
                corrected = fuzzy_correct_token(t)
                corrected_tokens.append(corrected)
                
        if not corrected_tokens:
            return []
            
        # Deduplicate
        seen = set()
        final_tokens = []
        for t in corrected_tokens:
            if t.lower() not in seen:
                seen.add(t.lower())
                final_tokens.append(t)
                
        # Build SQL intersection query: each corrected token must match name or composition fields with dash normalization
        clauses = []
        params = []
        for t in final_tokens:
            clauses.append("(REPLACE(name, '-', ' ') LIKE ? OR REPLACE(short_composition1, '-', ' ') LIKE ? OR REPLACE(short_composition2, '-', ' ') LIKE ?)")
            params.extend([f"%{t}%", f"%{t}%", f"%{t}%"])
            
        sql = f"""
            SELECT id, name, price, manufacturer_name, type, pack_size_label, short_composition1, short_composition2
            FROM medicines
            WHERE {" AND ".join(clauses)}
            LIMIT 100;
        """
        
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute(sql, params)
        rows = cursor.fetchall()
        conn.close()
        
        ranked = []
        for row in rows:
            m_id, name, price, mfg, m_type, pack_size, comp1, comp2 = row
            name_lower = name.lower()
            comp1_lower = comp1.lower()
            comp2_lower = comp2.lower()
            
            score = 0
            for t in final_tokens:
                t_lower = t.lower()
                if name_lower == t_lower:
                    score += 50
                elif name_lower.startswith(t_lower):
                    score += 30
                elif f" {t_lower}" in name_lower:
                    score += 20
                elif t_lower in comp1_lower or t_lower in comp2_lower:
                    score += 15
                    
                    # Exact composition match boost
                    ing1 = re.sub(r'\(.*?\)', '', comp1_lower).strip()
                    ing2 = re.sub(r'\(.*?\)', '', comp2_lower).strip()
                    if ing1 == t_lower or ing2 == t_lower:
                        score += 5
                else:
                    score += 5
                    
            # Prioritize combination products for multi-ingredient searches
            is_combo = bool(comp1 and comp2)
            if len(final_tokens) >= 2 and is_combo:
                score += 10
            elif len(final_tokens) == 1 and is_combo:
                score -= 5
                
            generic = comp1
            if comp2:
                generic = f"{comp1} + {comp2}"
            
            summary = DrugSummary(
                rxcui=f"local_{m_id}",
                name=name,
                brand_name=name,
                generic_name=generic,
                manufacturer=mfg,
                route=["ORAL"],
                has_boxed_warning=False,
                urgency_level="safe",
                tty="BN"
            )
            ranked.append((score, summary))
            
        ranked.sort(key=lambda x: (-x[0], len(x[1].name)))
        return [item[1] for item in ranked[:limit]]
    except Exception as e:
        logger.error("Error querying local Indian database: %s", e)
        return []


async def expand_search_query(q: str) -> list[str]:
    q = q.strip()
    if not q:
        return []

    queries = [q]

    # Pre-map common generic query expansions
    q_lower = q.lower()
    mapped_us = map_indian_to_us_generic(q_lower)
    if mapped_us.lower() != q_lower:
        queries.append(mapped_us)

    # Resolve search query to its RxCUI for fallback
    rxcui = await resolve_name_to_rxcui(mapped_us)
    if rxcui:
        details = await get_drug_details_by_rxcui(rxcui)
        canonical_name = details.get("name")
        if canonical_name and canonical_name.lower() != q.lower() and canonical_name.lower() not in [item.lower() for item in queries]:
            queries.append(canonical_name)

        # Fetch related active ingredients
        async with httpx.AsyncClient() as client:
            try:
                url = f"https://rxnav.nlm.nih.gov/REST/rxcui/{rxcui}/related.json"
                response = await client.get(url, params={"tty": "IN"}, timeout=5.0)
                if response.status_code == 200:
                    data = response.json()
                    concept_groups = data.get("relatedGroup", {}).get("conceptGroup", [])
                    for group in concept_groups:
                        for concept in group.get("conceptProperties", []):
                            ing_name = concept.get("name")
                            if ing_name and ing_name.lower() not in [item.lower() for item in queries]:
                                queries.append(ing_name)
            except Exception as e:
                logger.warning("Failed to fetch related ingredients for RxCUI %s: %s", rxcui, e)

    return queries


def rank_search_results(summary: DrugSummary, query: str, expanded_queries: list[str]) -> tuple:
    name = (summary.name or "").lower()
    brand = (summary.brand_name or "").lower()
    generic = (summary.generic_name or "").lower()

    # 1. Check if it is a combination drug (contains "/", "+", "and" or "&")
    is_combination = "/" in name or " / " in name or " + " in name or " and " in name or " & " in name

    # 2. Check for exact match against original query or resolved generics
    exact_match = False
    for q_term in expanded_queries:
        q_term_lower = q_term.lower()
        if name == q_term_lower or brand == q_term_lower or generic == q_term_lower:
            exact_match = True
            break

    # 3. Check for prefix match against original query or resolved generics
    prefix_match = False
    for q_term in expanded_queries:
        q_term_lower = q_term.lower()
        if name.startswith(q_term_lower) or brand.startswith(q_term_lower) or generic.startswith(q_term_lower):
            prefix_match = True
            break

    # Ranking sorting key
    return (
        -1 if exact_match else 0,
        1 if is_combination else 0,
        -1 if prefix_match else 0,
        len(name)
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get(
    "/profile",
    response_model=DrugProfile,
    dependencies=[Depends(limit_profile)],
    summary="Get full drug clinical profile",
    description=(
        "Fetch detailed medication profiles, prioritizing the offline curated database, "
        "then local Indian medicines SQLite metadata. Chemical ingredients are resolved "
        "to standard US generic equivalents for openFDA clinical descriptions."
    ),
)
async def get_medication_profile(
    name: str = Query(..., min_length=2, description="Drug name (generic or brand)"),
) -> DrugProfile:
    logger.info("Drug profile request: '%s'", name)
    
    name_clean = name.strip()
    name_lower = name_clean.lower()
    
    # 1. Curated Offline Top-30 Database Check
    profile_data = None
    if name_lower in INDIAN_DRUGS:
        logger.info("Profile found in curated offline database for '%s'", name_clean)
        profile_data = dict(INDIAN_DRUGS[name_lower])
    else:
        for k, v in INDIAN_DRUGS.items():
            if name_lower.startswith(k) or k.startswith(name_lower):
                logger.info("Profile found in curated offline database (prefix match) for '%s'", name_clean)
                profile_data = dict(v)
                break
                
    if profile_data:
        # Check if we can find it in the local database to get price, pack size, and compositions for Jan Aushadhi matching
        local_drug = None
        if os.path.exists(DB_PATH):
            try:
                conn = sqlite3.connect(DB_PATH)
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT name, price, manufacturer_name, pack_size_label, short_composition1, short_composition2 
                    FROM medicines 
                    WHERE name = ? COLLATE NOCASE
                """, (profile_data["brand_name"],))
                local_drug = cursor.fetchone()
                if not local_drug:
                    cursor.execute("""
                        SELECT name, price, manufacturer_name, pack_size_label, short_composition1, short_composition2 
                        FROM medicines 
                        WHERE name LIKE ?
                        LIMIT 1
                    """, (f"{profile_data['brand_name']}%",))
                    local_drug = cursor.fetchone()
                conn.close()
            except Exception as e:
                logger.error("Error querying SQLite for curated drug: %s", e)
                
        if local_drug:
            db_name, db_price, db_mfg, db_pack, db_comp1, db_comp2 = local_drug
            profile_data["price"] = db_price or 0.0
            profile_data["pack_size_label"] = db_pack
            
            # Match Jan Aushadhi generic alternative
            if (db_price or 0.0) > 0:
                brand_units = parse_pack_size_units(db_pack)
                brand_unit_price = (db_price or 0.0) / brand_units if brand_units > 0 else (db_price or 0.0)
                
                gen_alt = find_jan_aushadhi_alternative(db_comp1, db_comp2)
                if gen_alt:
                    gen_price = gen_alt["price"]
                    gen_pack = gen_alt["pack_size_label"]
                    gen_units = parse_pack_size_units(gen_pack)
                    gen_unit_price = gen_price / gen_units if gen_units > 0 else gen_price
                    
                    if brand_unit_price > gen_unit_price:
                        savings_pct = round(((brand_unit_price - gen_unit_price) / brand_unit_price) * 100, 1)
                        profile_data["generic_alternative"] = {
                            "generic_name": gen_alt["generic_name"],
                            "price": gen_price,
                    "pack_size_label": gen_pack,
                            "brand_unit_price": round(brand_unit_price, 2),
                            "generic_unit_price": round(gen_unit_price, 2),
                            "savings_percentage": savings_pct
                        }
        return DrugProfile(**profile_data)

    # 2. Query Local SQLite Indian Medicines Database
    local_drug = None
    if os.path.exists(DB_PATH):
        try:
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            # Try exact match, then starts-with prefix with dash normalization
            cursor.execute("""
                SELECT name, price, manufacturer_name, pack_size_label, short_composition1, short_composition2 
                FROM medicines 
                WHERE REPLACE(name, '-', ' ') = REPLACE(?, '-', ' ') COLLATE NOCASE
            """, (name_clean,))
            local_drug = cursor.fetchone()
            if not local_drug:
                cursor.execute("""
                    SELECT name, price, manufacturer_name, pack_size_label, short_composition1, short_composition2 
                    FROM medicines 
                    WHERE REPLACE(name, '-', ' ') LIKE REPLACE(?, '-', ' ') || '%'
                    LIMIT 1
                """, (name_clean,))
                local_drug = cursor.fetchone()
            conn.close()
        except Exception as e:
            logger.error("Error querying SQLite during profile load: %s", e)

    # If not found locally, trigger scraper (OCR / database lookup miss)
    if not local_drug:
        logger.info("Local database miss for '%s'. Triggering crawler...", name_clean)
        scraped_and_cached = await scrape_and_cache_brand(name_clean)
        if scraped_and_cached and os.path.exists(DB_PATH):
            logger.info("Successfully scraped and cached brand '%s'. Re-querying database...", name_clean)
            try:
                conn = sqlite3.connect(DB_PATH)
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT name, price, manufacturer_name, pack_size_label, short_composition1, short_composition2 
                    FROM medicines 
                    WHERE REPLACE(name, '-', ' ') = REPLACE(?, '-', ' ') COLLATE NOCASE
                """, (name_clean,))
                local_drug = cursor.fetchone()
                if not local_drug:
                    cursor.execute("""
                        SELECT name, price, manufacturer_name, pack_size_label, short_composition1, short_composition2 
                        FROM medicines 
                        WHERE REPLACE(name, '-', ' ') LIKE REPLACE(?, '-', ' ') || '%'
                        LIMIT 1
                    """, (name_clean,))
                    local_drug = cursor.fetchone()
                conn.close()
            except Exception as e:
                logger.error("Error re-querying SQLite after scrape: %s", e)

    # If found in SQLite, resolve its compositions
    resolved_generic_queries = []
    brand_override = name_clean
    mfg_override = ""
    price_override = 0.0
    pack_size_override = ""
    composition_label = ""

    if local_drug:
        db_name, db_price, db_mfg, db_pack, db_comp1, db_comp2 = local_drug
        brand_override = db_name
        mfg_override = db_mfg
        price_override = db_price or 0.0
        pack_size_override = db_pack
        
        # Build nice composition label
        if db_comp1 and db_comp2:
            composition_label = f"{db_comp1} + {db_comp2}"
        else:
            composition_label = db_comp1 or db_comp2 or ""
            
        # Extract generic ingredients for FDA search
        for comp in [db_comp1, db_comp2]:
            if comp:
                clean_comp = clean_composition_name(comp)
                us_gen = map_indian_to_us_generic(clean_comp)
                if us_gen and us_gen not in resolved_generic_queries:
                    resolved_generic_queries.append(us_gen)
    else:
        # If not found in local DB, fallback to query expansion on the search term itself
        resolved_generic_queries = [map_indian_to_us_generic(name_clean)]
        candidates = clean_drug_name(name_clean)
        for cand in candidates:
            us_gen = map_indian_to_us_generic(cand)
            if us_gen not in resolved_generic_queries:
                resolved_generic_queries.append(us_gen)

    logger.info("Resolving FDA profile using generic search terms: %s", resolved_generic_queries)
    
    # 3. Retrieve FDA Profile using resolved generics
    fda_profile = None
    for query_term in resolved_generic_queries:
        # Stage 1: RxNorm -> openFDA
        rxcui = await resolve_name_to_rxcui(query_term)
        if rxcui:
            fda_profile = await get_drug_profile_by_rxcui(rxcui)
            if fda_profile:
                break
        # Stage 2: Direct name fallback
        fda_profile = await get_drug_profile_by_name(query_term)
        if fda_profile:
            break

    # 4. Return Profile or Fallback
    if fda_profile:
        profile_data = dict(fda_profile)
        if local_drug:
            db_name, db_price, db_mfg, db_pack, db_comp1, db_comp2 = local_drug
            profile_data["brand_name"] = brand_override
            profile_data["generic_name"] = composition_label or profile_data.get("generic_name", "")
            profile_data["manufacturer"] = mfg_override or profile_data.get("manufacturer", "")
            profile_data["price"] = price_override
            profile_data["pack_size_label"] = pack_size_override
            
            # Match Jan Aushadhi generic alternative
            if price_override > 0:
                brand_units = parse_pack_size_units(pack_size_override)
                brand_unit_price = price_override / brand_units if brand_units > 0 else price_override
                
                gen_alt = find_jan_aushadhi_alternative(db_comp1, db_comp2)
                if gen_alt:
                    gen_price = gen_alt["price"]
                    gen_pack = gen_alt["pack_size_label"]
                    gen_units = parse_pack_size_units(gen_pack)
                    gen_unit_price = gen_price / gen_units if gen_units > 0 else gen_price
                    
                    if brand_unit_price > gen_unit_price:
                        savings_pct = round(((brand_unit_price - gen_unit_price) / brand_unit_price) * 100, 1)
                        profile_data["generic_alternative"] = {
                            "generic_name": gen_alt["generic_name"],
                            "price": gen_price,
                            "pack_size_label": gen_pack,
                            "brand_unit_price": round(brand_unit_price, 2),
                            "generic_unit_price": round(gen_unit_price, 2),
                            "savings_percentage": savings_pct
                        }
        else:
            profile_data["price"] = 0.0
            profile_data["pack_size_label"] = ""
        
        # Localize standard generic displays
        if profile_data.get("generic_name", "").lower() == "acetaminophen":
            profile_data["generic_name"] = "Paracetamol"
        if profile_data.get("brand_name", "").lower() == "acetaminophen":
            profile_data["brand_name"] = "Paracetamol"
            
        return DrugProfile(**profile_data)
        
    elif local_drug:
        db_name, db_price, db_mfg, db_pack, db_comp1, db_comp2 = local_drug
        generic_alt_data = None
        
        # Match Jan Aushadhi generic alternative
        if price_override > 0:
            brand_units = parse_pack_size_units(pack_size_override)
            brand_unit_price = price_override / brand_units if brand_units > 0 else price_override
            
            gen_alt = find_jan_aushadhi_alternative(db_comp1, db_comp2)
            if gen_alt:
                gen_price = gen_alt["price"]
                gen_pack = gen_alt["pack_size_label"]
                gen_units = parse_pack_size_units(gen_pack)
                gen_unit_price = gen_price / gen_units if gen_units > 0 else gen_price
                
                if brand_unit_price > gen_unit_price:
                    savings_pct = round(((brand_unit_price - gen_unit_price) / brand_unit_price) * 100, 1)
                    generic_alt_data = {
                        "generic_name": gen_alt["generic_name"],
                        "price": gen_price,
                        "pack_size_label": gen_pack,
                        "brand_unit_price": round(brand_unit_price, 2),
                        "generic_unit_price": round(gen_unit_price, 2),
                        "savings_percentage": savings_pct
                    }
                    
        # Safe fallback clinical description using local database details
        return DrugProfile(
            brand_name=brand_override,
            generic_name=composition_label,
            manufacturer=mfg_override,
            product_type="Allopathy (India)",
            route=["ORAL"],
            price=price_override,
            pack_size_label=pack_size_override,
            indications=f"Indications matching composition: {composition_label}.",
            description=f"{brand_override} is a pharmaceutical product manufactured by {mfg_override}. Composed of {composition_label}.",
            dosage="Refer to package instructions or consult your doctor.",
            warnings="Take as directed by a healthcare professional.",
            precautions="Consult a doctor if symptoms persist or in case of pre-existing health conditions.",
            storage="Store in a cool, dry place. Protect from light.",
            generic_alternative=generic_alt_data
        )
        
    raise HTTPException(
        status_code=404,
        detail=(
            f"No drug information found for '{name_clean}'. "
            "Check the spelling or try the generic name."
        ),
    )


@router.get(
    "/search",
    response_model=MedicationSearchResponse,
    summary="Search for medications by name",
    description=(
        "Returns lightweight drug summaries from local Indian database and openFDA."
    ),
)
async def search_medications(
    q:     str = Query(..., min_length=2, description="Search query (min 2 characters)"),
    limit: int = Query(default=8, ge=1, le=20, description="Max results (1–20)"),
) -> MedicationSearchResponse:
    logger.info("Medication search: '%s' (limit=%d)", q, limit)

    # 1. Query Local Indian Medicines Database
    local_results = query_local_indian_db(q, limit=limit)
    
    # If we get fewer local results (or none), trigger scraper
    if not local_results or len(local_results) < 3:
        logger.info("Fewer local results for search query '%s'. Triggering scraper...", q)
        scraped_and_cached = await scrape_and_cache_brand(q)
        if scraped_and_cached:
            logger.info("Successfully scraped and cached brand for search query '%s'. Re-querying local db...", q)
            local_results = query_local_indian_db(q, limit=limit)

    # If we get enough local results, return them immediately
    if len(local_results) >= limit or len(local_results) >= 3:
        logger.info("Returning %d local Indian search results.", len(local_results))
        return MedicationSearchResponse(
            query=q,
            results=local_results,
            total=len(local_results),
            source="local_indian_db"
        )

    # 2. Fallback / Combine with RxNorm + openFDA if needed
    expanded_queries = await expand_search_query(q)
    query_terms = []
    for term in expanded_queries:
        if term.lower() not in [qt.lower() for qt in query_terms]:
            query_terms.append(term)

    tasks = []
    for term in query_terms[:2]:
        tasks.append(search_drugs(term, max_results=limit))
        tasks.append(search_drugs_openfda(term, limit=limit))

    all_results = await asyncio.gather(*tasks, return_exceptions=True)

    rxnorm_results = []
    fda_results = []

    for i, res in enumerate(all_results):
        if isinstance(res, Exception):
            logger.error("Search task index %d failed", i, exc_info=res)
            continue
        if not res:
            continue

        if i % 2 == 0:
            rxnorm_results.extend(res)
        else:
            fda_results.extend(res)

    summaries: list[DrugSummary] = []
    seen_names: set[str] = {r.name.lower() for r in local_results}

    # Add RxNorm results
    for r in rxnorm_results:
        key = (r.get("name") or "").lower()
        if key and key not in seen_names:
            seen_names.add(key)
            summaries.append(DrugSummary(
                rxcui=r.get("rxcui"),
                name=r.get("name", ""),
                generic_name=r.get("name", ""),
                brand_name=r.get("synonym", ""),
                tty=r.get("tty", ""),
            ))

    # Add openFDA results
    for r in fda_results:
        key = (r.get("generic_name") or r.get("brand_name") or "").lower()
        if key and key not in seen_names:
            seen_names.add(key)
            summaries.append(DrugSummary(
                rxcui=r.get("rxcui", [None])[0] if r.get("rxcui") else None,
                name=r.get("generic_name") or r.get("brand_name", ""),
                brand_name=r.get("brand_name", ""),
                generic_name=r.get("generic_name", ""),
                manufacturer=r.get("manufacturer", ""),
                route=r.get("route", []),
                has_boxed_warning=r.get("has_boxed_warning", False),
                urgency_level=r.get("urgency_level", "safe"),
            ))

    # Sort results using custom ranking
    summaries.sort(key=lambda s: rank_search_results(s, q, query_terms))

    # Localize names in fallback results
    for r in summaries:
        if r.generic_name.lower() == "acetaminophen":
            r.generic_name = "Paracetamol"
        if r.brand_name.lower() == "acetaminophen":
            r.brand_name = "Paracetamol"
        if "acetaminophen" in r.name.lower():
            r.name = re.sub(r'acetaminophen', 'Paracetamol', r.name, flags=re.IGNORECASE)

    # Combine local and external results
    final_results = local_results + summaries
    return MedicationSearchResponse(
        query=q,
        results=final_results[:limit],
        total=len(final_results),
        source="combined"
    )

"""
Prahari — openFDA Drug Service
================================
Fetches full clinical drug profiles from the FDA's open data platform.

openFDA provides structured label data for all FDA-approved drugs, including:
    - Active and inactive ingredients
    - Indications and usage
    - Dosage and administration
    - Warnings and contraindications
    - Adverse reactions
    - Drug interactions
    - Storage and handling

API Documentation: https://open.fda.gov/apis/drug/label/
No API key required. Rate limit: 1000 req/day without key, 40 req/min.
Base URL: https://api.fda.gov/drug/label.json
"""

import logging
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

# In-memory caches for drug profile lookups
_PROFILE_BY_NAME_CACHE: dict[str, Optional[dict]] = {}
_PROFILE_BY_RXCUI_CACHE: dict[str, Optional[dict]] = {}

# ---------------------------------------------------------------------------
# openFDA Configuration
# ---------------------------------------------------------------------------

_OPENFDA_BASE = "https://api.fda.gov/drug/label.json"
_TIMEOUT      = 12.0  # openFDA can be slow on first request




# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _first(lst: list, fallback: str = "") -> str:
    """Return the first element of a list, or fallback if empty."""
    return lst[0].strip() if lst else fallback


def _clean_label_text(raw: list[str]) -> str:
    """
    Join multi-part label text sections and strip HTML-like artefacts
    commonly found in openFDA label fields.
    """
    if not raw:
        return ""
    text = " ".join(raw)
    # openFDA sometimes includes newline-delimited subsections
    text = text.replace("\n", " ").replace("\r", " ")
    # Limit length for display
    return text.strip()[:2000]


async def _query_openfda(params: dict) -> Optional[dict]:
    """
    Execute an async GET against the openFDA drug label API.

    Args:
        params: Query parameters (search, count, limit, etc.)

    Returns:
        Parsed JSON dict, or None if the request fails.
    """
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(_OPENFDA_BASE, params=params, timeout=_TIMEOUT)
            if response.status_code == 404:
                # No results found — not an error
                return None
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as exc:
            logger.warning("openFDA HTTP error: %s", exc)
        except Exception as exc:
            logger.warning("openFDA request failed: %s", exc)
    return None


# ---------------------------------------------------------------------------
# Drug Profile Builder
# ---------------------------------------------------------------------------

def _extract_profile(result: dict) -> dict:
    """
    Extract and normalise the key clinical fields from a single openFDA
    label result object.

    Args:
        result: A single item from openFDA results[].

    Returns:
        Normalised drug profile dict.
    """
    openfda = result.get("openfda", {})

    # Urgency / warning classification
    raw_warnings   = result.get("warnings", [])
    raw_boxed      = result.get("boxed_warning", [])
    has_boxed      = bool(raw_boxed)  # Black-box warning = highest severity

    return {
        # Identity
        "brand_name":        _first(openfda.get("brand_name", [])),
        "generic_name":      _first(openfda.get("generic_name", [])),
        "manufacturer":      _first(openfda.get("manufacturer_name", [])),
        "product_type":      _first(openfda.get("product_type", [])),
        "route":             openfda.get("route", []),
        "rxcui":             openfda.get("rxcui", []),
        "ndc":               openfda.get("ndc", [])[:3],  # up to 3 NDC codes

        # Clinical content
        "indications":       _clean_label_text(result.get("indications_and_usage", [])),
        "dosage":            _clean_label_text(result.get("dosage_and_administration", [])),
        "warnings":          _clean_label_text(raw_warnings),
        "boxed_warning":     _clean_label_text(raw_boxed),
        "contraindications": _clean_label_text(result.get("contraindications", [])),
        "adverse_reactions": _clean_label_text(result.get("adverse_reactions", [])),
        "drug_interactions": _clean_label_text(result.get("drug_interactions", [])),
        "precautions":       _clean_label_text(result.get("precautions", [])),
        "storage":           _clean_label_text(result.get("storage_and_handling", [])),
        "description":       _clean_label_text(result.get("description", [])),

        # Safety metadata
        "has_boxed_warning": has_boxed,
        "urgency_level":     "critical" if has_boxed else ("moderate" if raw_warnings else "safe"),
    }


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def get_drug_profile_by_name(drug_name: str) -> Optional[dict]:
    """
    Fetch a drug profile from openFDA by generic or brand name.

    Tries generic name first (ingredient search), then brand name.
    Returns the first matching result's normalised profile.

    Args:
        drug_name: Drug name string (may be generic or brand).

    Returns:
        Normalised drug profile dict, or None if not found.
    """
    drug_name = drug_name.strip()
    if not drug_name:
        return None

    cache_key = drug_name.lower()
    if cache_key in _PROFILE_BY_NAME_CACHE:
        logger.info("openFDA name cache hit: '%s'", drug_name)
        return _PROFILE_BY_NAME_CACHE[cache_key]

    # Strategy 1: search by generic name (ingredient)
    for field in ["openfda.generic_name", "openfda.brand_name", "openfda.substance_name"]:
        params = {
            "search": f'{field}:"{drug_name}"',
            "limit": 1,
        }
        data = await _query_openfda(params)
        if data and data.get("results"):
            profile = _extract_profile(data["results"][0])
            logger.info("openFDA hit via %s for '%s': %s", field, drug_name, profile["brand_name"] or profile["generic_name"])
            _PROFILE_BY_NAME_CACHE[cache_key] = profile
            return profile

    logger.info("openFDA: no results for '%s'", drug_name)
    _PROFILE_BY_NAME_CACHE[cache_key] = None
    return None


async def get_drug_profile_by_rxcui(rxcui: str) -> Optional[dict]:
    """
    Fetch a drug profile from openFDA using an RxCUI identifier.
    This is the preferred lookup after RxNorm resolution.

    Args:
        rxcui: RxNorm concept identifier.

    Returns:
        Normalised drug profile dict, or None if not found.
    """
    rxcui = rxcui.strip() if rxcui else ""
    if not rxcui:
        return None

    if rxcui in _PROFILE_BY_RXCUI_CACHE:
        logger.info("openFDA RxCUI cache hit: %s", rxcui)
        return _PROFILE_BY_RXCUI_CACHE[rxcui]

    params = {
        "search": f"openfda.rxcui:{rxcui}",
        "limit": 1,
    }
    data = await _query_openfda(params)
    if data and data.get("results"):
        profile = _extract_profile(data["results"][0])
        logger.info("openFDA hit via RxCUI %s: %s", rxcui, profile["generic_name"])
        _PROFILE_BY_RXCUI_CACHE[rxcui] = profile
        return profile

    _PROFILE_BY_RXCUI_CACHE[rxcui] = None
    return None


async def search_drugs_openfda(query: str, limit: int = 8) -> list[dict]:
    """
    Full-text search across openFDA drug labels.
    Returns a list of lightweight drug summary objects.

    Args:
        query: Search term (drug name, ingredient, etc.)
        limit: Max number of results.

    Returns:
        List of lightweight drug summary dicts.
    """
    if not query or len(query) < 2:
        return []

    params = {
        "search": (
            f'openfda.generic_name:"{query}"+OR+openfda.brand_name:"{query}"'
        ),
        "limit": limit,
    }

    data = await _query_openfda(params)
    if not data or not data.get("results"):
        # Fallback: broader search
        params["search"] = query
        data = await _query_openfda(params)

    if not data or not data.get("results"):
        return []

    summaries = []
    for r in data["results"]:
        openfda = r.get("openfda", {})
        summaries.append({
            "brand_name":    _first(openfda.get("brand_name", [])),
            "generic_name":  _first(openfda.get("generic_name", [])),
            "manufacturer":  _first(openfda.get("manufacturer_name", [])),
            "route":         openfda.get("route", []),
            "rxcui":         openfda.get("rxcui", [])[:1],
            "has_boxed_warning": bool(r.get("boxed_warning")),
            "urgency_level": "critical" if r.get("boxed_warning") else (
                             "moderate" if r.get("warnings") else "safe"),
        })

    return summaries

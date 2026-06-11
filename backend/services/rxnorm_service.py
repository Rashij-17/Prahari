"""
Prahari — RxNorm Service
========================
Resolves drug names and brand names to RxNorm concept identifiers (RxCUIs)
using the NLM RxNorm REST API.

RxNorm is the US National Library of Medicine's normalised naming system for
clinical drugs. Every approved medication has a unique RxCUI which acts as the
canonical key for cross-referencing openFDA, DailyMed, and NLM drug databases.

API Documentation:
    https://lhncbc.nlm.nih.gov/RxNav/APIs/RxNormAPIs.html

No API key required. Rate limit: ~20 req/sec (well above our needs).
Base URL: https://rxnav.nlm.nih.gov/REST
"""

import logging
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# RxNorm API Configuration
# ---------------------------------------------------------------------------

_RXNORM_BASE = "https://rxnav.nlm.nih.gov/REST"
_TIMEOUT     = 10.0  # seconds

# Concept types we care about (tty = term type)
# IN  = Ingredient (generic name)
# BN  = Brand Name
# SBD = Branded Drug
# SCD = Clinical Drug
_VALID_TTYS = {"IN", "BN", "SBD", "SCD", "MIN"}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _get(client: httpx.AsyncClient, path: str, params: dict = None) -> dict:
    """
    Perform an async GET against the RxNorm API.

    Args:
        client: Shared httpx.AsyncClient
        path:   API path (e.g. '/drugs.json')
        params: Optional query parameters

    Returns:
        Parsed JSON response dict.

    Raises:
        httpx.HTTPError: On network or HTTP-level failure.
    """
    url = f"{_RXNORM_BASE}{path}"
    response = await client.get(url, params=params or {}, timeout=_TIMEOUT)
    response.raise_for_status()
    return response.json()


# ---------------------------------------------------------------------------
# Core Resolution Functions
# ---------------------------------------------------------------------------

async def resolve_name_to_rxcui(drug_name: str) -> Optional[str]:
    """
    Resolve a free-text drug name or brand name to its canonical RxCUI.

    Uses the /approximateTerm endpoint which performs fuzzy matching —
    ideal for OCR output which may have minor spelling variations.

    Args:
        drug_name: Free-text drug name (e.g. 'Paracetamol', 'Amoxicillin').

    Returns:
        The best-match RxCUI string, or None if no match found.

    Example:
        >>> await resolve_name_to_rxcui("paracetamol")
        "161"
    """
    drug_name = drug_name.strip()
    if not drug_name:
        return None

    async with httpx.AsyncClient() as client:
        try:
            # First try exact match via /rxcui
            data = await _get(client, "/rxcui.json", {"name": drug_name, "search": 1})
            rxcui = (
                data.get("idGroup", {})
                    .get("rxnormId", [None])[0]
            )
            if rxcui:
                logger.info("RxNorm exact match: '%s' → RxCUI %s", drug_name, rxcui)
                return rxcui

            # Fallback: approximate term search
            data = await _get(
                client,
                "/approximateTerm.json",
                {"term": drug_name, "maxEntries": 5, "option": 1},
            )
            candidates = (
                data.get("approximateGroup", {})
                    .get("candidate", [])
            )
            if candidates:
                rxcui = candidates[0].get("rxcui")
                logger.info("RxNorm approx match: '%s' → RxCUI %s", drug_name, rxcui)
                return rxcui

        except Exception as exc:
            logger.warning("RxNorm resolve failed for '%s': %s", drug_name, exc)

    return None


async def get_drug_details_by_rxcui(rxcui: str) -> dict:
    """
    Fetch ingredient name, synonyms, drug classes, and related concepts
    for a given RxCUI.

    Args:
        rxcui: Canonical RxNorm concept identifier.

    Returns:
        Dict with keys: name, synonyms, tty, drug_classes, related_rxcuis
    """
    result = {
        "rxcui":         rxcui,
        "name":          None,
        "synonyms":      [],
        "tty":           None,
        "drug_classes":  [],
        "related_rxcuis": [],
    }

    async with httpx.AsyncClient() as client:
        try:
            # Fetch base properties
            data = await _get(client, f"/rxcui/{rxcui}/properties.json")
            props = data.get("properties", {})
            result["name"] = props.get("name")
            result["tty"]  = props.get("tty")

            # Fetch all synonyms / related concept names
            syn_data = await _get(client, f"/rxcui/{rxcui}/allProperties.json",
                                  {"prop": "names"})
            prop_list = (
                syn_data.get("propConceptGroup", {})
                        .get("propConcept", [])
            )
            result["synonyms"] = list({
                p.get("propValue") for p in prop_list
                if p.get("propValue") and p.get("propValue") != result["name"]
            })[:8]

        except Exception as exc:
            logger.warning("RxNorm details failed for RxCUI %s: %s", rxcui, exc)

    return result


async def search_drugs(query: str, max_results: int = 10) -> list[dict]:
    """
    Search RxNorm for drugs matching a query string.
    Returns a list of {rxcui, name, tty} dicts.

    Args:
        query:       Search term (partial name is fine).
        max_results: Maximum number of results to return.

    Returns:
        List of matching drug concept dicts.
    """
    if not query or len(query) < 2:
        return []

    async with httpx.AsyncClient() as client:
        try:
            data = await _get(
                client,
                "/drugs.json",
                {"name": query},
            )
            concept_groups = (
                data.get("drugGroup", {})
                    .get("conceptGroup", [])
            )

            results = []
            for group in concept_groups:
                tty = group.get("tty", "")
                if tty not in _VALID_TTYS:
                    continue
                for concept in group.get("conceptProperties", []):
                    results.append({
                        "rxcui": concept.get("rxcui"),
                        "name":  concept.get("name"),
                        "tty":   tty,
                        "synonym": concept.get("synonym", ""),
                    })

            logger.info("RxNorm search '%s': %d results", query, len(results))
            return results[:max_results]

        except Exception as exc:
            logger.warning("RxNorm search failed for '%s': %s", query, exc)
            return []

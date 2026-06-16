"""
Prahari — Drug-Drug Interaction Service
=======================================
Queries RxNav API for drug interactions, parses results, and handles caching.
"""

import logging
from typing import List, Dict, Any, Tuple
import httpx
from services.cache_service import cache_service

logger = logging.getLogger("uvicorn")

RXNAV_INTERACTION_URL = "https://rxnav.nlm.nih.gov/REST/interaction/list.json"


async def get_pairwise_combinations(rxcuis: List[str]) -> List[Tuple[str, str]]:
    """
    Generate all unique pairwise combinations of RxCUIs.
    Pairs are returned in sorted order (lexicographically) to ensure consistent cache keys.
    """
    unique_rxcuis = sorted(list(set(rxcuis)))
    pairs = []
    for i in range(len(unique_rxcuis)):
        for j in range(i + 1, len(unique_rxcuis)):
            pairs.append((unique_rxcuis[i], unique_rxcuis[j]))
    return pairs


def map_rxnav_severity(severity_str: str) -> str:
    """
    Map RxNav severity categories to MedLens urgency tiers.
    RxNav values can be "high", "moderate", "low", etc.
    """
    s = severity_str.lower().strip()
    if s == "high":
        return "critical"
    elif s == "moderate":
        return "moderate"
    else:
        return "safe"


async def fetch_interactions_from_rxnav(rxcuis: List[str]) -> Dict[str, Dict[str, Any]]:
    """
    Query RxNav list endpoint for interactions among a group of RxCUIs.
    Returns a dictionary mapping sorted 'rxcui1-rxcui2' keys to interaction details.
    """
    if len(rxcuis) < 2:
        return {}

    # Join rxcuis with '+' (e.g. 1191+3498+207106)
    rxcuis_query = "+".join(rxcuis)
    params = {"rxcuis": rxcuis_query}

    logger.info("Querying RxNav API for interactions: %s", rxcuis_query)
    
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            response = await client.get(RXNAV_INTERACTION_URL, params=params)
            response.raise_for_status()
            data = response.json()
        except Exception as exc:
            logger.error("Failed to query RxNav interaction API: %s", exc)
            return {}

    resolved_interactions = {}

    # Parse RxNav response structure
    # The structure contains: fullInteractionTypeGroup -> fullInteractionType -> interactionPair
    groups = data.get("fullInteractionTypeGroup") or []
    for group in groups:
        types = group.get("fullInteractionType") or []
        for type_item in types:
            # Verify the minConcepts involved
            concepts = type_item.get("minConcept") or []
            if len(concepts) < 2:
                continue
            
            # Sort the concept RxCUIs to form a consistent key
            concept_ids = sorted([c.get("rxcui") for c in concepts if c.get("rxcui")])
            if len(concept_ids) < 2:
                continue
            
            rxcui_pair = f"{concept_ids[0]}-{concept_ids[1]}"
            
            # Extract description and severity
            pairs = type_item.get("interactionPair") or []
            if pairs:
                first_pair = pairs[0]
                severity_raw = first_pair.get("severity") or "low"
                description = first_pair.get("description") or "Known interaction found."
                
                resolved_interactions[rxcui_pair] = {
                    "severity": map_rxnav_severity(severity_raw),
                    "description": description
                }

    return resolved_interactions


async def check_drug_interactions(rxcuis: List[str]) -> List[Dict[str, Any]]:
    """
    Evaluate pairwise interactions for a list of RxCUIs.
    Utilizes Redis (with fallback) to cache results, requesting only misses from RxNav.

    Args:
        rxcuis: List of RxCUI strings to analyze.

    Returns:
        List of dictionaries detailing interactions between pairs.
    """
    if len(rxcuis) < 2:
        return []

    # 1. Generate all unique pairs
    pairs = await get_pairwise_combinations(rxcuis)
    results = []
    cache_miss_pairs = []

    # 2. Check cache for each pair
    for pair in pairs:
        rxcui_pair = f"{pair[0]}-{pair[1]}"
        cached_result = await cache_service.get_cached_interaction(rxcui_pair)
        
        if cached_result is not None:
            results.append({
                "rxcui_1": pair[0],
                "rxcui_2": pair[1],
                "severity": cached_result.get("severity", "safe"),
                "description": cached_result.get("description", "No known interactions.")
            })
        else:
            cache_miss_pairs.append(pair)

    # 3. If there are cache misses, resolve them
    if cache_miss_pairs:
        # To avoid making many API calls, we query all rxcuis involved in the misses together
        miss_rxcuis = set()
        for p in cache_miss_pairs:
            miss_rxcuis.add(p[0])
            miss_rxcuis.add(p[1])
            
        # Call RxNav API for all concepts involved in misses
        rxnav_results = await fetch_interactions_from_rxnav(list(miss_rxcuis))
        
        # Process and cache each cache-miss pair
        for pair in cache_miss_pairs:
            rxcui_pair = f"{pair[0]}-{pair[1]}"
            
            # Check if an interaction was returned by RxNav
            interaction = rxnav_results.get(rxcui_pair)
            
            if interaction:
                severity = interaction["severity"]
                description = interaction["description"]
            else:
                # No interaction returned -> Safe
                severity = "safe"
                description = "No known interactions."

            pair_outcome = {
                "severity": severity,
                "description": description
            }
            
            # Cache the outcome (24 hours TTL)
            await cache_service.set_cached_interaction(rxcui_pair, pair_outcome)
            
            results.append({
                "rxcui_1": pair[0],
                "rxcui_2": pair[1],
                "severity": severity,
                "description": description
            })

    return results

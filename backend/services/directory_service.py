"""
Prahari — Provider Directory Service (Google Places Integration)
================================================================
Searches for nearby healthcare providers using the Google Places API.

API Docs: https://developers.google.com/maps/documentation/places/web-service
Free quota: ~$200/month credit — sufficient for development and personal use.
Requires: GOOGLE_PLACES_API_KEY in .env

If the API key is not configured, the service returns a mock list of
placeholder results so the UI remains demonstrable without a key.
"""

import logging
from typing import Optional

import httpx

from core.config import settings

logger = logging.getLogger(__name__)

_PLACES_BASE = "https://maps.googleapis.com/maps/api/place"
_TIMEOUT = 10.0

# Provider types we query for
_PROVIDER_TYPES = ["doctor", "hospital", "pharmacy", "health"]


def _has_credentials() -> bool:
    """Check if Google Places API key is configured."""
    return bool(
        settings.google_places_api_key and
        settings.google_places_api_key != "your_google_places_api_key_here"
    )


# ---------------------------------------------------------------------------
# Mock Provider Data (used when no API key is configured)
# ---------------------------------------------------------------------------

_MOCK_PROVIDERS = [
    {
        "name":         "Fortis Super Speciality Hospital",
        "address":      "AA-299, Shalimar Bagh, New Delhi, Delhi 110088",
        "rating":        4.5,
        "total_ratings": 1845,
        "types":         ["hospital", "health"],
        "open_now":      True,
        "place_id":      "mock_001",
        "phone":         "+91 11 4277 6222",
        "maps_url":      "https://maps.google.com",
        "distance_km":   1.2,
        "is_mock":       True,
    },
    {
        "name":         "Apollo Family Clinic",
        "address":      "H-1, Outer Ring Road, Sector 62, Noida, UP 201301",
        "rating":        4.8,
        "total_ratings": 912,
        "types":         ["doctor", "health"],
        "open_now":      True,
        "place_id":      "mock_002",
        "phone":         "+91 120 488 2200",
        "maps_url":      "https://maps.google.com",
        "distance_km":   2.5,
        "is_mock":       True,
    },
    {
        "name":         "Jan Aushadhi Kendra & Generic Pharmacy",
        "address":      "Shop 14, Community Centre, Saket, New Delhi 110017",
        "rating":        4.6,
        "total_ratings": 312,
        "types":         ["pharmacy", "health"],
        "open_now":      True,
        "place_id":      "mock_003",
        "phone":         "+91 1800 180 8080",
        "maps_url":      "https://maps.google.com",
        "distance_km":   0.8,
        "is_mock":       True,
    },
]


# ---------------------------------------------------------------------------
# Places API
# ---------------------------------------------------------------------------

async def _nearby_search(
    lat: float,
    lng: float,
    radius_m: int,
    keyword: str,
) -> list[dict]:
    """
    Query Google Places Nearby Search for healthcare providers.

    Args:
        lat, lng:   Coordinates of the user's location.
        radius_m:   Search radius in metres (max 50000).
        keyword:    Optional keyword to filter results (e.g. 'cardiologist').

    Returns:
        List of raw Place result dicts.
    """
    params = {
        "location": f"{lat},{lng}",
        "radius":   radius_m,
        "type":     "doctor",
        "keyword":  keyword or "clinic doctor hospital",
        "key":      settings.google_places_api_key,
    }

    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{_PLACES_BASE}/nearbysearch/json",
            params=params,
            timeout=_TIMEOUT,
        )
        response.raise_for_status()
        data = response.json()

    status = data.get("status")
    if status not in ("OK", "ZERO_RESULTS"):
        logger.warning("Places API returned status: %s", status)

    return data.get("results", [])


def _normalise_place(place: dict, user_lat: float, user_lng: float) -> dict:
    """
    Normalise a raw Google Places result into Prahari's provider format.

    Args:
        place:    Raw Places API result object.
        user_lat, user_lng: User's coordinates (for distance label).

    Returns:
        Normalised provider dict.
    """
    import math

    loc    = place.get("geometry", {}).get("location", {})
    plat   = loc.get("lat", user_lat)
    plng   = loc.get("lng", user_lng)

    # Haversine distance calculation
    R = 6371  # Earth radius km
    dlat = math.radians(plat - user_lat)
    dlng = math.radians(plng - user_lng)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(user_lat)) *
         math.cos(math.radians(plat)) *
         math.sin(dlng / 2) ** 2)
    distance_km = round(R * 2 * math.asin(math.sqrt(a)), 2)

    opening_hours = place.get("opening_hours", {})
    place_id      = place.get("place_id", "")

    return {
        "name":          place.get("name", "Unknown Provider"),
        "address":       place.get("vicinity", ""),
        "rating":        place.get("rating", 0.0),
        "total_ratings": place.get("user_ratings_total", 0),
        "types":         place.get("types", [])[:3],
        "open_now":      opening_hours.get("open_now"),
        "place_id":      place_id,
        "phone":         "",  # requires a Details call (Phase 6 enhancement)
        "maps_url":      f"https://www.google.com/maps/place/?q=place_id:{place_id}",
        "distance_km":   distance_km,
        "is_mock":       False,
    }


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def search_providers(
    lat: float,
    lng: float,
    specialty: str = "",
    radius_km: int = 5,
    limit: int = 10,
) -> dict:
    """
    Find nearby healthcare providers for a given location.

    If Google Places API key is configured, performs a live search.
    Otherwise returns mock data so the UI remains demonstrable.

    Args:
        lat, lng:    User's GPS coordinates.
        specialty:   Optional specialty filter (e.g. 'cardiologist', 'paediatrician').
        radius_km:   Search radius in kilometres (default 5).
        limit:       Maximum results to return.

    Returns:
        Dict with keys: providers, total, radius_km, is_mock
    """
    if not _has_credentials():
        logger.info("Google Places API key not configured — returning mock providers.")
        return {
            "providers": _MOCK_PROVIDERS[:limit],
            "total":     len(_MOCK_PROVIDERS),
            "radius_km": radius_km,
            "is_mock":   True,
            "mock_notice": (
                "⚠️ Demo results shown. Add GOOGLE_PLACES_API_KEY to your .env "
                "to enable live provider search."
            ),
        }

    try:
        keyword    = specialty or "clinic doctor"
        radius_m   = min(radius_km * 1000, 50000)
        raw_places = await _nearby_search(lat, lng, radius_m, keyword)

        providers = [_normalise_place(p, lat, lng) for p in raw_places]
        # Sort by distance
        providers.sort(key=lambda p: p["distance_km"])

        logger.info("Found %d providers within %d km of (%.4f, %.4f)", len(providers), radius_km, lat, lng)

        return {
            "providers": providers[:limit],
            "total":     len(providers),
            "radius_km": radius_km,
            "is_mock":   False,
            "mock_notice": "",
        }

    except Exception as exc:
        logger.error("Provider search failed: %s", exc)
        raise RuntimeError(f"Provider search failed: {exc}") from exc

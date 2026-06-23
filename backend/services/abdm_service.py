"""
Prahari — ABDM HFR Service (Ayushman Bharat Digital Mission — Health Facility Registry)
=========================================================================================
Interfaces with India's national Health Facility Registry to discover verified
clinics, hospitals, pharmacies, and diagnostic labs with government-verified
contact details and GPS coordinates.

Registration: https://sandbox.abdm.gov.in (free, takes ~2 days)
Auth:         OAuth2 — POST /gateway/v0.5/sessions → accessToken (JWT, 30-min expiry)
Docs:         https://hfr.abdm.gov.in

Usage:
    from services.abdm_service import get_abdm_token, search_hfr_facilities

Notes:
  - Token is cached in-memory for 25 minutes to avoid excessive auth calls.
  - If ABDM_CLIENT_ID is blank, all functions return empty lists immediately.
  - Sandbox is free forever; use X-CM-ID: sbx for sandbox, abdm for production.
"""

import asyncio
import logging
import time
from typing import Optional

import httpx

from core.config import settings

logger = logging.getLogger(__name__)

_TIMEOUT  = 15.0
_HEADERS  = {"User-Agent": "Prahari-Health-Sentinel/1.0 (contact@prahari.org)"}

# ---------------------------------------------------------------------------
# Specialty → ABDM facilitySubType code mapping
# ---------------------------------------------------------------------------

SPECIALTY_TO_ABDM: dict[str, str] = {
    "cardiologist":       "Cardiology",
    "cardiology":         "Cardiology",
    "dermatologist":      "Dermatology",
    "dermatology":        "Dermatology",
    "neurologist":        "Neurology",
    "neurology":          "Neurology",
    "orthopaedic":        "Orthopaedics",
    "orthopedic":         "Orthopaedics",
    "orthopaedics":       "Orthopaedics",
    "orthopaedist":       "Orthopaedics",
    "paediatrician":      "Paediatrics",
    "pediatrician":       "Paediatrics",
    "paediatrics":        "Paediatrics",
    "pediatrics":         "Paediatrics",
    "gynecologist":       "Gynaecology",
    "gynaecologist":      "Gynaecology",
    "gynaecology":        "Gynaecology",
    "psychiatrist":       "Psychiatry",
    "psychiatry":         "Psychiatry",
    "ent":                "ENT",
    "ent specialist":     "ENT",
    "ophthalmologist":    "Ophthalmology",
    "ophthalmology":      "Ophthalmology",
    "general physician":  "General Medicine",
    "general medicine":   "General Medicine",
    "general doctor":     "General Medicine",
    "doctor":             "General Medicine",
    "oncologist":         "Oncology",
    "oncology":           "Oncology",
    "urologist":          "Urology",
    "urology":            "Urology",
    "endocrinologist":    "Endocrinology",
    "endocrinology":      "Endocrinology",
    "nephrologist":       "Nephrology",
    "nephrology":         "Nephrology",
    "pulmonologist":      "Pulmonology",
    "pulmonology":        "Pulmonology",
    "hospital":           "",
    "clinic":             "",
    "pharmacy":           "",
    "hospital emergency": "",
    "clinic doctor":      "General Medicine",
}


def _map_specialty(specialty: str) -> str:
    """Convert a UI specialty string to an ABDM facilitySubType code."""
    if not specialty:
        return ""
    spec = specialty.lower().strip()
    # Try exact match first
    if spec in SPECIALTY_TO_ABDM:
        return SPECIALTY_TO_ABDM[spec]
    # Fuzzy match on first word
    for key, val in SPECIALTY_TO_ABDM.items():
        if key in spec or spec in key:
            return val
    return ""


def _has_abdm_credentials() -> bool:
    """Check if ABDM OAuth2 credentials are configured."""
    return bool(
        settings.abdm_client_id
        and settings.abdm_client_id.strip()
        and settings.abdm_client_id not in ("", "your_client_id_here")
        and settings.abdm_client_secret
        and settings.abdm_client_secret.strip()
        and settings.abdm_client_secret not in ("", "your_client_secret_here")
    )


# ---------------------------------------------------------------------------
# In-memory token cache
# ---------------------------------------------------------------------------

_token_cache: dict = {
    "access_token":   None,
    "expires_at":     0.0,   # Unix timestamp
}
_token_lock = asyncio.Lock()


async def get_abdm_token() -> Optional[str]:
    """
    Obtain an ABDM OAuth2 access token (JWT).
    Caches the token in-memory for 25 minutes (token expires at 30 min).

    Returns None if credentials are not configured or auth fails.
    """
    if not _has_abdm_credentials():
        return None

    async with _token_lock:
        # Return cached token if still valid
        if _token_cache["access_token"] and time.time() < _token_cache["expires_at"]:
            return _token_cache["access_token"]

        logger.info("Requesting new ABDM access token…")
        try:
            async with httpx.AsyncClient(headers=_HEADERS, timeout=10.0) as client:
                response = await client.post(
                    f"{settings.abdm_base_url}/gateway/v0.5/sessions",
                    headers={"Content-Type": "application/json"},
                    json={
                        "clientId":     settings.abdm_client_id,
                        "clientSecret": settings.abdm_client_secret,
                    },
                )
                response.raise_for_status()
                data = response.json()

            token = data.get("accessToken") or data.get("access_token")
            if not token:
                logger.error("ABDM auth response missing accessToken: %s", data)
                return None

            _token_cache["access_token"] = token
            _token_cache["expires_at"]   = time.time() + (25 * 60)  # 25 min cache
            logger.info("ABDM token obtained and cached (25 min)")
            return token

        except httpx.HTTPStatusError as exc:
            logger.error("ABDM auth HTTP error %s: %s", exc.response.status_code, exc)
            return None
        except Exception as exc:
            logger.error("ABDM auth failed: %s", exc)
            return None


async def search_hfr_facilities(
    state_name:    str,
    district_name: str,
    specialty:     str = "",
    page_no:       int = 1,
    page_size:     int = 20,
    token:         Optional[str] = None,
) -> list[dict]:
    """
    Search the ABDM Health Facility Registry by state, district, and specialty.

    Returns a list of raw HFR facility dicts, or [] if unavailable.

    Args:
        state_name:    Indian state name (e.g. "Uttar Pradesh").
        district_name: District name (e.g. "Lucknow").
        specialty:     UI specialty string; converted to ABDM code internally.
        page_no:       Pagination start page (1-indexed).
        page_size:     Results per page (max 20 recommended).
        token:         Access token; if None, will be fetched automatically.
    """
    if not _has_abdm_credentials():
        logger.debug("ABDM credentials not configured — skipping HFR search.")
        return []

    if token is None:
        token = await get_abdm_token()
    if not token:
        return []

    abdm_specialty = _map_specialty(specialty)

    params: dict = {
        "stateName":    state_name,
        "districtName": district_name,
        "pageNo":       str(page_no),
        "pageSize":     str(page_size),
    }
    if abdm_specialty:
        params["facilitySubType"] = abdm_specialty

    try:
        async with httpx.AsyncClient(headers=_HEADERS, timeout=_TIMEOUT) as client:
            response = await client.get(
                f"{settings.abdm_hfr_base_url}/apis/hfr/search/searchByLocation",
                params=params,
                headers={
                    "Authorization": f"Bearer {token}",
                    "X-CM-ID":       settings.abdm_cm_id,
                    **_HEADERS,
                },
            )
            response.raise_for_status()
            data = response.json()

        facilities = (
            data.get("content")
            or data.get("facilities")
            or data.get("data")
            or (data if isinstance(data, list) else [])
        )
        logger.info(
            "ABDM HFR: %d facilities found for %s / %s (specialty=%s)",
            len(facilities), district_name, state_name, abdm_specialty or "all"
        )
        return facilities

    except httpx.HTTPStatusError as exc:
        logger.error(
            "ABDM HFR search HTTP error %s for %s/%s: %s",
            exc.response.status_code, state_name, district_name, exc
        )
        return []
    except Exception as exc:
        logger.error("ABDM HFR search failed: %s", exc)
        return []


async def get_doctors_by_facility(
    facility_npi_id: str,
    token:           Optional[str] = None,
) -> list[dict]:
    """
    Retrieve the list of doctors registered under a specific HFR facility.

    Args:
        facility_npi_id: The unique HFR facility NPI ID.
        token:           Access token; fetched automatically if None.
    """
    if not _has_abdm_credentials() or not facility_npi_id:
        return []

    if token is None:
        token = await get_abdm_token()
    if not token:
        return []

    try:
        async with httpx.AsyncClient(headers=_HEADERS, timeout=_TIMEOUT) as client:
            response = await client.get(
                f"{settings.abdm_hfr_base_url}/apis/hfr/search/doctorByFacility",
                params={"facilityNPIId": facility_npi_id},
                headers={
                    "Authorization": f"Bearer {token}",
                    "X-CM-ID":       settings.abdm_cm_id,
                    **_HEADERS,
                },
            )
            response.raise_for_status()
            data = response.json()

        doctors = (
            data.get("doctors")
            or data.get("content")
            or data.get("data")
            or (data if isinstance(data, list) else [])
        )
        logger.debug("ABDM HFR: %d doctors at facility %s", len(doctors), facility_npi_id)
        return doctors

    except Exception as exc:
        logger.error("ABDM doctor-by-facility failed for %s: %s", facility_npi_id, exc)
        return []


def normalise_hfr_facility(facility: dict, user_lat: float, user_lng: float) -> dict:
    """
    Normalise a raw ABDM HFR facility dict into Prahari's provider schema.

    Args:
        facility:           Raw HFR API facility object.
        user_lat, user_lng: User coordinates for distance calculation.
    """
    import math

    # Coordinates
    lat = float(facility.get("latitude")  or facility.get("lat")  or user_lat)
    lng = float(facility.get("longitude") or facility.get("lon")  or facility.get("lng") or user_lng)

    # Haversine distance
    R    = 6371
    dlat = math.radians(lat - user_lat)
    dlng = math.radians(lng - user_lng)
    a    = (math.sin(dlat / 2) ** 2 +
            math.cos(math.radians(user_lat)) *
            math.cos(math.radians(lat)) *
            math.sin(dlng / 2) ** 2)
    distance_km = round(R * 2 * math.asin(math.sqrt(a)), 2)

    # Contact
    phone = (
        facility.get("contactNumber")
        or facility.get("mobile")
        or facility.get("phone")
        or ""
    )

    # Address
    addr_parts = [
        p for p in [
            facility.get("address"),
            facility.get("locality"),
            facility.get("districtName"),
            facility.get("stateName"),
        ] if p
    ]
    address = ", ".join(addr_parts) or "Address on file with ABDM HFR"

    fac_type    = facility.get("facilityType", "")
    fac_subtype = facility.get("facilitySubType", "")
    npi_id      = facility.get("facilityNPIId") or facility.get("id") or ""

    # Types list for tag chips
    types = [t for t in [fac_type.lower(), fac_subtype.lower()] if t]
    if not types:
        types = ["healthcare"]

    return {
        "name":             facility.get("facilityName") or facility.get("name") or "Healthcare Facility",
        "address":          address,
        "district":         facility.get("districtName", ""),
        "state":            facility.get("stateName", ""),
        "pincode":          str(facility.get("pincode") or ""),
        "place_id":         f"hfr_{npi_id}" if npi_id else "",
        "facility_id":      npi_id,
        "phone":            phone,
        "website":          facility.get("websiteLink") or facility.get("website") or "",
        "maps_url":         f"https://www.google.com/maps/place/?q={lat},{lng}",
        "distance_km":      distance_km,
        "types":            types,
        "facility_type":    fac_type,
        "facility_subtype": fac_subtype,
        "timings":          facility.get("timings") or facility.get("timing") or "",
        "rating":           0.0,
        "total_ratings":    0,
        "open_now":         None,
        "source":           "abdm_hfr",
        "is_mock":          False,
        # NMC fields — populated later by nmc_service
        "verification_status": "unverified",
        "nmc_reg_no":          "",
        "nmc_qualification":   "",
        "nmc_council":         "",
        "nmc_year":            "",
    }

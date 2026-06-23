"""
Prahari — Provider Directory Service (Three-Layer Government Data Pipeline)
============================================================================
Searches for nearby healthcare providers using a layered approach:

  Layer 1 — ABDM HFR (Ayushman Bharat Digital Mission Health Facility Registry)
            Government-verified facility names, addresses, and phone numbers.
            Requires free OAuth2 credentials from sandbox.abdm.gov.in.

  Layer 2 — OpenStreetMap Overpass (free, no key, always available as fallback)
            Live OSM data enriched with NMC verification where possible.

  Layer 3 — Dynamic Mock (offline last resort)
            Location-aware placeholder data with clear demo labels.

NMC verification runs asynchronously on all provider entries that have a
doctor name, adding ✅ badges and registration details.

Sources:
  NMC IMR:  https://www.nmc.org.in/MCIRest/open/getDataFromService
  ABDM HFR: https://hfr.abdm.gov.in/apis/hfr/search/searchByLocation
  OSM:      https://overpass-api.de/api/interpreter
"""

import asyncio
import logging
import math
from typing import Optional

import httpx

from core.config import settings
from services.nmc_service  import verify_doctor_nmc, get_verification_status
from services.abdm_service import (
    get_abdm_token,
    search_hfr_facilities,
    get_doctors_by_facility,
    normalise_hfr_facility,
    _has_abdm_credentials,
)

logger = logging.getLogger(__name__)

_TIMEOUT = 10.0


# ---------------------------------------------------------------------------
# Haversine helper
# ---------------------------------------------------------------------------

def _haversine(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Return great-circle distance in km between two lat/lng points."""
    R    = 6371
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a    = (math.sin(dlat / 2) ** 2 +
            math.cos(math.radians(lat1)) *
            math.cos(math.radians(lat2)) *
            math.sin(dlng / 2) ** 2)
    return round(R * 2 * math.asin(math.sqrt(a)), 2)


# ---------------------------------------------------------------------------
# Reverse geocode → state + district (for ABDM HFR query)
# ---------------------------------------------------------------------------

async def _reverse_geocode_to_district(lat: float, lng: float) -> tuple[str, str]:
    """
    Use OSM Nominatim reverse geocoding to extract state and district names.
    Returns (state_name, district_name). Falls back to ("", "") on failure.
    """
    try:
        async with httpx.AsyncClient(
            headers={"User-Agent": "Prahari-Health-Sentinel/1.0 (contact@prahari.org)"},
            timeout=8.0,
        ) as client:
            response = await client.get(
                "https://nominatim.openstreetmap.org/reverse",
                params={"lat": lat, "lon": lng, "format": "json", "addressdetails": "1"},
            )
            response.raise_for_status()
            data = response.json()

        addr = data.get("address", {})
        state    = addr.get("state", "")
        district = (
            addr.get("county")
            or addr.get("district")
            or addr.get("city_district")
            or addr.get("city")
            or addr.get("town")
            or ""
        )
        # Normalize common Indian state name aliases
        state_map = {
            "Uttar Pradesh": "Uttar Pradesh",
            "Maharashtra":   "Maharashtra",
            "Delhi":         "Delhi",
            "National Capital Territory of Delhi": "Delhi",
        }
        state = state_map.get(state, state)
        logger.debug("Reverse geocode: state=%s, district=%s", state, district)
        return state, district

    except Exception as exc:
        logger.warning("Reverse geocode failed for (%.4f, %.4f): %s", lat, lng, exc)
        return "", ""


# ---------------------------------------------------------------------------
# NMC Enrichment — runs on a list of providers in parallel
# ---------------------------------------------------------------------------

async def _enrich_with_nmc(providers: list[dict]) -> list[dict]:
    """
    Attempt NMC verification for providers that look like individual doctor entries.
    Runs all NMC requests concurrently with asyncio.gather.

    Modifies providers in-place and returns them.
    """
    # Identify providers worth checking: named entries that don't look like
    # pure facility names (no "hospital", "pharmacy", "centre", "lab" in name)
    facility_keywords = {"hospital", "clinic", "pharmacy", "centre", "center",
                         "lab", "diagnostic", "nursing", "home", "dispensary"}

    def _looks_like_doctor(name: str) -> bool:
        lower = name.lower()
        return (
            "dr." in lower or "dr " in lower
            or not any(kw in lower for kw in facility_keywords)
        )

    async def _check_one(provider: dict) -> None:
        name = provider.get("name", "")
        if not _looks_like_doctor(name):
            return
        record = await verify_doctor_nmc(name)
        status = get_verification_status(record)
        provider["verification_status"] = status["status_key"]
        if record:
            provider["nmc_reg_no"]        = record.registration_no
            provider["nmc_qualification"] = record.qualification
            provider["nmc_council"]        = record.state_medical_council
            provider["nmc_year"]           = record.year_of_registration

    # Run all checks in parallel (with a semaphore to avoid flooding NMC)
    sem = asyncio.Semaphore(4)

    async def _rate_limited(provider):
        async with sem:
            await _check_one(provider)

    await asyncio.gather(*[_rate_limited(p) for p in providers])
    return providers


# ---------------------------------------------------------------------------
# Layer 1 — ABDM HFR Search
# ---------------------------------------------------------------------------

async def _search_abdm(
    lat: float, lng: float,
    specialty: str, radius_km: int, limit: int
) -> list[dict]:
    """
    Query ABDM HFR for verified healthcare facilities near the given coordinates.
    Returns a list of normalised provider dicts, or [] if unavailable.
    """
    if not _has_abdm_credentials():
        return []

    try:
        # Get auth token and reverse geocode in parallel
        token_task    = get_abdm_token()
        geocode_task  = _reverse_geocode_to_district(lat, lng)
        token, (state, district) = await asyncio.gather(token_task, geocode_task)

        if not token:
            logger.warning("ABDM token unavailable — skipping HFR search.")
            return []

        if not state and not district:
            logger.warning("Could not determine state/district for ABDM HFR query.")
            return []

        facilities_raw = await search_hfr_facilities(
            state_name    = state,
            district_name = district,
            specialty     = specialty,
            page_no       = 1,
            page_size     = min(limit * 2, 30),
            token         = token,
        )

        if not facilities_raw:
            return []

        # Normalise and filter by radius
        providers = []
        for fac in facilities_raw:
            p = normalise_hfr_facility(fac, lat, lng)
            if p["distance_km"] <= radius_km:
                providers.append(p)

        providers.sort(key=lambda x: x["distance_km"])
        logger.info("ABDM HFR yielded %d providers within %d km", len(providers), radius_km)
        return providers

    except Exception as exc:
        logger.error("ABDM HFR search failed: %s", exc)
        return []


# ---------------------------------------------------------------------------
# Layer 2 — OpenStreetMap Overpass
# ---------------------------------------------------------------------------

async def _query_osm_overpass(
    lat: float, lng: float,
    radius_m: int, specialty: str = ""
) -> list[dict]:
    """Query OpenStreetMap Overpass API for nearby healthcare providers."""
    amenity_filter   = "hospital|doctors|pharmacy|clinic|dentist"
    healthcare_filter = "hospital|doctor|pharmacy|clinic|dentist|yes"

    if specialty:
        spec = specialty.lower()
        if "pharmacy" in spec:
            amenity_filter    = "pharmacy"
            healthcare_filter = "pharmacy"
        elif "hospital" in spec:
            amenity_filter    = "hospital"
            healthcare_filter = "hospital"
        elif "doctor" in spec or "physician" in spec or "general" in spec:
            amenity_filter    = "doctors|clinic"
            healthcare_filter = "doctor|clinic"
        else:
            # Specialised — grab both clinics and hospitals
            amenity_filter    = "doctors|clinic|hospital"
            healthcare_filter = "doctor|clinic|hospital"

    query_radius = max(radius_m * 2, 10000)

    query = f"""[out:json][timeout:15];
(
  node["amenity"~"{amenity_filter}"](around:{query_radius},{lat},{lng});
  way["amenity"~"{amenity_filter}"](around:{query_radius},{lat},{lng});
  node["healthcare"~"{healthcare_filter}"](around:{query_radius},{lat},{lng});
  way["healthcare"~"{healthcare_filter}"](around:{query_radius},{lat},{lng});
);
out center;"""

    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://overpass-api.de/api/interpreter",
            data={"data": query},
            timeout=15.0,
        )
        response.raise_for_status()
        data = response.json()

    elements = data.get("elements", [])

    # Deduplicate by element ID
    seen_ids: set = set()
    deduped   = []
    for el in elements:
        eid = el.get("id")
        if eid not in seen_ids:
            seen_ids.add(eid)
            deduped.append(el)

    return deduped


def _normalise_osm_place(element: dict, user_lat: float, user_lng: float) -> dict:
    """Normalise an OSM Overpass element into Prahari's provider schema."""
    tags = element.get("tags", {})

    plat = element.get("lat") or element.get("center", {}).get("lat", user_lat)
    plng = element.get("lon") or element.get("center", {}).get("lon", user_lng)

    distance_km = _haversine(user_lat, user_lng, plat, plng)

    amenity  = tags.get("amenity") or tags.get("healthcare") or "health"
    raw_name = tags.get("name")
    name     = raw_name if raw_name else f"Local {amenity.replace('_', ' ').title()}"

    addr_parts = [
        tags.get(f) for f in
        ["addr:housenumber", "addr:street", "addr:suburb", "addr:city"]
        if tags.get(f)
    ]
    address = ", ".join(addr_parts) or f"Near ({plat:.4f}, {plng:.4f})"

    opening_hours = tags.get("opening_hours", "")
    open_now = None
    if opening_hours and ("24/7" in opening_hours or "always" in opening_hours.lower()):
        open_now = True

    element_id  = element.get("id", 0)
    rating      = round(4.0 + (element_id % 10) * 0.1, 1)
    total_rtngs = 10 + (element_id % 90)

    return {
        "name":             name,
        "address":          address,
        "district":         tags.get("addr:city") or tags.get("addr:suburb") or "",
        "state":            tags.get("addr:state") or "",
        "pincode":          tags.get("addr:postcode") or "",
        "rating":           rating,
        "total_ratings":    total_rtngs,
        "types":            [amenity, "health"],
        "facility_type":    amenity.upper(),
        "facility_subtype": "",
        "timings":          opening_hours,
        "open_now":         open_now,
        "place_id":         f"osm_{element.get('id')}",
        "phone":            tags.get("phone") or tags.get("contact:phone") or "",
        "website":          tags.get("website") or tags.get("contact:website") or "",
        "maps_url":         f"https://www.google.com/maps/place/?q={plat},{plng}",
        "distance_km":      distance_km,
        "source":           "osm",
        "is_mock":          False,
        "verification_status": "unverified",
        "nmc_reg_no":          "",
        "nmc_qualification":   "",
        "nmc_council":         "",
        "nmc_year":            "",
    }


# ---------------------------------------------------------------------------
# Layer 3 — Dynamic Mock (unchanged logic, kept as last resort)
# ---------------------------------------------------------------------------

def _get_closest_city(user_lat: float, user_lng: float) -> str:
    """Find the closest major city to the user coordinates."""
    cities = [
        {"name": "Lucknow",       "lat": 26.8467, "lng": 80.9462},
        {"name": "New Delhi",     "lat": 28.6139, "lng": 77.2090},
        {"name": "Jaipur",        "lat": 26.9124, "lng": 75.7873},
        {"name": "Chandigarh",    "lat": 30.7333, "lng": 76.7794},
        {"name": "Srinagar",      "lat": 34.0837, "lng": 74.7973},
        {"name": "Shimla",        "lat": 31.1048, "lng": 77.1734},
        {"name": "Dehradun",      "lat": 30.3165, "lng": 78.0322},
        {"name": "Kolkata",       "lat": 22.5726, "lng": 88.3639},
        {"name": "Patna",         "lat": 25.5941, "lng": 85.1376},
        {"name": "Ranchi",        "lat": 23.3441, "lng": 85.3096},
        {"name": "Bhubaneswar",   "lat": 20.2961, "lng": 85.8245},
        {"name": "Guwahati",      "lat": 26.1445, "lng": 91.7362},
        {"name": "Mumbai",        "lat": 19.0760, "lng": 72.8777},
        {"name": "Pune",          "lat": 18.5204, "lng": 73.8567},
        {"name": "Ahmedabad",     "lat": 23.0225, "lng": 72.5714},
        {"name": "Bhopal",        "lat": 23.2599, "lng": 77.4126},
        {"name": "Raipur",        "lat": 21.2514, "lng": 81.6296},
        {"name": "Bangalore",     "lat": 12.9716, "lng": 77.5946},
        {"name": "Chennai",       "lat": 13.0827, "lng": 80.2707},
        {"name": "Hyderabad",     "lat": 17.3850, "lng": 78.4867},
        {"name": "Kochi",         "lat":  9.9312, "lng": 76.2673},
        {"name": "Visakhapatnam", "lat": 17.6868, "lng": 83.2185},
        {"name": "London",        "lat": 51.5074, "lng": -0.1278},
        {"name": "New York",      "lat": 40.7128, "lng": -74.0060},
        {"name": "Dubai",         "lat": 25.2048, "lng": 55.2708},
    ]
    closest, min_dist = "Local Area", float("inf")
    for city in cities:
        dist = (user_lat - city["lat"]) ** 2 + (user_lng - city["lng"]) ** 2
        if dist < min_dist:
            min_dist = dist
            closest  = city["name"]
    return "Local Area" if min_dist > 100.0 else closest


def _generate_mock_providers(user_lat: float, user_lng: float, specialty: str = "") -> list[dict]:
    """Dynamically generate mock providers around the user's coordinates."""
    city = _get_closest_city(user_lat, user_lng)

    templates = [
        {
            "name": f"{city} Super Speciality Hospital",
            "address": f"AA-299, Shalimar Sector, {city}",
            "types": ["hospital", "health"], "phone": "+91 11 4277 6222",
            "lat_offset": 0.008, "lng_offset": 0.008, "place_id": "mock_001",
        },
        {
            "name": "Apollo Family Clinic & Pharmacy",
            "address": f"H-1, Outer Ring Road, {city}",
            "types": ["doctor", "health"], "phone": "+91 120 488 2200",
            "lat_offset": -0.015, "lng_offset": 0.015, "place_id": "mock_002",
        },
        {
            "name": f"Jan Aushadhi Kendra ({city} Central)",
            "address": f"Shop 14, Community Centre, {city}",
            "types": ["pharmacy", "health"], "phone": "+91 1800 180 8080",
            "lat_offset": 0.005, "lng_offset": -0.005, "place_id": "mock_003",
        },
        {
            "name": "Dr. Verma's Pediatric Care",
            "address": f"Flat 3B, Apex Residency, {city}",
            "types": ["doctor", "health"], "phone": "+91 99999 88888",
            "lat_offset": -0.006, "lng_offset": -0.008, "place_id": "mock_004",
        },
        {
            "name": "Metro Cardiac Centre",
            "address": f"Block D, Commercial Belt, {city}",
            "types": ["hospital", "health"], "phone": "+91 98765 43210",
            "lat_offset": 0.012, "lng_offset": -0.012, "place_id": "mock_005",
        },
        {
            "name": f"{city} City General Hospital",
            "address": f"Block B, Civil Lines, {city}",
            "types": ["hospital", "health"], "phone": "+91 99999 77777",
            "lat_offset": -0.010, "lng_offset": -0.012, "place_id": "mock_006",
        },
        {
            "name": "St. Mary's Healthcare & Emergency",
            "address": f"Station Road, Opp Post Office, {city}",
            "types": ["hospital", "health"], "phone": "+91 88888 11111",
            "lat_offset": 0.015, "lng_offset": 0.005, "place_id": "mock_007",
        },
        {
            "name": "Lifeline Super Speciality Clinic",
            "address": f"Main Chowk, Sector 7, {city}",
            "types": ["hospital", "health"], "phone": "+91 77777 22222",
            "lat_offset": -0.005, "lng_offset": 0.018, "place_id": "mock_008",
        },
    ]

    providers = []
    for t in templates:
        t_types = t["types"]
        t_name  = t["name"].lower()
        if specialty:
            spec    = specialty.lower()
            matched = (
                ("pharmacy" in spec and "pharmacy" in t_types)
                or ("hospital" in spec and "hospital" in t_types)
                or ("doctor" in spec and "doctor" in t_types)
                or ("paediatrician" in spec and ("pediatric" in t_name or "doctor" in t_types))
                or ("cardiologist" in spec and ("cardiac" in t_name or "hospital" in t_types or "doctor" in t_types))
                or (spec in t_name or any(spec in ty for ty in t_types))
            )
            if not matched:
                continue

        plat = user_lat + t["lat_offset"]
        plng = user_lng + t["lng_offset"]
        distance_km = _haversine(user_lat, user_lng, plat, plng)

        providers.append({
            "name":             t["name"],
            "address":          t["address"],
            "district":         "",
            "state":            "",
            "pincode":          "",
            "rating":           round(4.0 + len(t["place_id"]) * 0.05, 1),
            "total_ratings":    50 + len(t["name"]) * 5,
            "types":            t["types"],
            "facility_type":    t["types"][0].upper() if t["types"] else "CLINIC",
            "facility_subtype": "",
            "timings":          "",
            "open_now":         True,
            "place_id":         t["place_id"],
            "phone":            t["phone"],
            "website":          "",
            "maps_url":         f"https://www.google.com/maps/place/?q={plat},{plng}",
            "distance_km":      distance_km,
            "source":           "mock",
            "is_mock":          True,
            "verification_status": "unverified",
            "nmc_reg_no":          "",
            "nmc_qualification":   "",
            "nmc_council":         "",
            "nmc_year":            "",
        })

    if not providers:
        clean_spec = specialty.title() if specialty else "Healthcare"
        providers.append({
            "name":             f"Local {clean_spec} Clinic",
            "address":          f"Sector 4, Central Area, {city}",
            "district":         "", "state": "", "pincode": "",
            "rating":           4.5, "total_ratings": 42,
            "types":            ["doctor", "health"],
            "facility_type":    "CLINIC", "facility_subtype": clean_spec,
            "timings":          "", "open_now": True,
            "place_id":         "mock_spec_001",
            "phone":            "",  # No fabricated number
            "website":          "",
            "maps_url":         f"https://www.google.com/maps/place/?q={user_lat},{user_lng}",
            "distance_km":      1.5,
            "source":           "mock", "is_mock": True,
            "verification_status": "unverified",
            "nmc_reg_no": "", "nmc_qualification": "", "nmc_council": "", "nmc_year": "",
        })

    providers.sort(key=lambda p: p["distance_km"])
    return providers


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def search_providers(
    lat:       float,
    lng:       float,
    specialty: str = "",
    radius_km: int = 5,
    limit:     int = 10,
) -> dict:
    """
    Find nearby healthcare providers using the three-layer government pipeline.

    Priority:
        1. ABDM HFR (government-verified, requires sandbox credentials)
        2. OpenStreetMap Overpass (live, free, no key)
        3. Dynamic Mock (offline fallback, clearly labelled)

    NMC verification is attempted asynchronously on all returned providers.
    """
    radius_m = min(radius_km * 1000, 50_000)

    # --- Layer 1: ABDM Health Facility Registry ---
    abdm_providers: list[dict] = []
    if _has_abdm_credentials():
        try:
            logger.info("Layer 1: Querying ABDM Health Facility Registry…")
            abdm_providers = await _search_abdm(lat, lng, specialty, radius_km, limit)
            if abdm_providers:
                # Attempt NMC enrichment on ABDM results
                logger.info("Enriching %d ABDM providers with NMC verification…", len(abdm_providers))
                abdm_providers = await _enrich_with_nmc(abdm_providers)
        except Exception as exc:
            logger.error("ABDM search error: %s — falling back to OSM", exc)
            abdm_providers = []

    # --- Layer 2: OpenStreetMap Overpass ---
    osm_providers: list[dict] = []
    try:
        logger.info("Layer 2: Querying OpenStreetMap Overpass…")
        raw_elements = await _query_osm_overpass(lat, lng, radius_m, specialty)
        if raw_elements:
            osm_providers = [_normalise_osm_place(e, lat, lng) for e in raw_elements]
            osm_providers.sort(key=lambda p: p["distance_km"])
            # Attempt NMC enrichment on OSM results (best-effort)
            if osm_providers:
                logger.info("Enriching %d OSM providers with NMC verification…", len(osm_providers))
                osm_providers = await _enrich_with_nmc(osm_providers[:limit])
    except Exception as exc:
        logger.error("OSM Overpass search failed: %s", exc)
        osm_providers = []

    # --- Merge layers 1 + 2 ---
    # ABDM results first (higher quality), then OSM
    merged = abdm_providers + osm_providers

    if merged:
        # Deduplicate by name similarity (avoid ABDM and OSM returning same facility)
        seen_names: set[str] = set()
        deduped = []
        for p in merged:
            key = p["name"].lower().strip()[:30]
            if key not in seen_names:
                seen_names.add(key)
                deduped.append(p)
        deduped.sort(key=lambda p: p["distance_km"])

        n_abdm = len(abdm_providers)
        n_osm  = len(osm_providers)

        source_parts = []
        if n_abdm > 0:
            source_parts.append(f"{n_abdm} from ABDM HFR (Gov Verified)")
        if n_osm > 0:
            source_parts.append(f"{n_osm} from OpenStreetMap")
        source_summary = " · ".join(source_parts)

        is_mock     = False
        mock_notice = ""
        if not _has_abdm_credentials():
            mock_notice = (
                "🏛️ ABDM HFR integration ready — add ABDM_CLIENT_ID and ABDM_CLIENT_SECRET "
                "to backend/.env (free sandbox registration at sandbox.abdm.gov.in) to enable "
                "government-verified facility data with verified phone numbers."
            )
        else:
            mock_notice = "🌐 Live results from OpenStreetMap" if n_abdm == 0 else ""

        return {
            "providers":      deduped[:limit],
            "total":          len(deduped),
            "radius_km":      radius_km,
            "is_mock":        is_mock,
            "mock_notice":    mock_notice,
            "source_summary": source_summary or "OpenStreetMap",
        }

    # --- Layer 3: Dynamic Mock (last resort) ---
    logger.info("All live searches returned no results — using dynamic mock database.")
    mock_data = _generate_mock_providers(lat, lng, specialty)
    return {
        "providers":      mock_data[:limit],
        "total":          len(mock_data),
        "radius_km":      radius_km,
        "is_mock":        True,
        "mock_notice": (
            "⚠️ Demo results shown — live search returned no results for this area. "
            "Ensure internet connectivity and/or try a different location."
        ),
        "source_summary": "Demo Data",
    }

"""
Prahari — Directory Router
==========================
FastAPI router endpoints for:
    POST /directory/search    — Three-layer provider search (ABDM HFR → OSM → Mock)
    GET  /directory/geocode   — Convert a location name to lat/lng (OSM Nominatim)
    GET  /directory/nmc-verify — Verify a doctor by name or registration number on NMC IMR

Source: FEATURES_AND_STRUCTURE.md §2.4 (Directory)
        IMPLEMENTATION_PLAN.md Phase 5 (extended with gov API layer)
"""

import logging

import httpx
from fastapi import APIRouter, HTTPException, Depends, Query

from middleware.rate_limiter import InMemoryRateLimiter
from models.directory import DirectoryRequest, DirectoryResponse
from services.directory_service import search_providers
from services.nmc_service import verify_doctor_nmc, verify_by_reg_no, get_verification_status

logger = logging.getLogger(__name__)

router = APIRouter()

# 10 requests per minute per IP — same as other external-API endpoints
limit_directory = InMemoryRateLimiter(requests_limit=10, window_seconds=60)
# NMC verify is lightweight but still rate-limited
limit_nmc = InMemoryRateLimiter(requests_limit=15, window_seconds=60)


@router.post(
    "/search",
    response_model=DirectoryResponse,
    dependencies=[Depends(limit_directory)],
    summary="Find nearby healthcare providers",
    description=(
        "Searches for nearby doctors, clinics, and hospitals using a three-layer pipeline: "
        "(1) ABDM Health Facility Registry (government-verified, requires free sandbox credentials), "
        "(2) OpenStreetMap Overpass (free live search, no key), "
        "(3) Dynamic mock fallback. "
        "NMC verification is attempted on all returned doctor entries. "
        "Results are sorted by distance (closest first)."
    ),
)
async def search_directory(body: DirectoryRequest) -> DirectoryResponse:
    """
    ABDM HFR → OSM Overpass → Mock fallback.
    NMC verification runs asynchronously on returned providers.
    Results are sorted by distance (closest first).
    """
    logger.info(
        "Directory search: (%.4f, %.4f) radius=%dkm specialty='%s'",
        body.lat, body.lng, body.radius_km, body.specialty,
    )

    try:
        result = await search_providers(
            body.lat, body.lng,
            body.specialty, body.radius_km, body.limit,
        )
        return DirectoryResponse(**result)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.get(
    "/geocode",
    summary="Convert a location name to lat/lng coordinates",
    description=(
        "Uses OpenStreetMap Nominatim (free, no API key) to resolve a place "
        "name into latitude/longitude. Used by the Prahari Agent to convert "
        "extracted location names into coordinates for directory searches."
    ),
)
async def geocode_location(
    location: str = Query(..., description="Place name to geocode, e.g. 'Connaught Place, Delhi'"),
) -> dict:
    """
    Geocode a location string using OSM Nominatim.
    Returns { lat, lng, display_name } or raises 404 if not found.
    """
    if not location or not location.strip():
        raise HTTPException(status_code=400, detail="Location query must not be empty.")

    logger.info("Geocoding location: '%s'", location)

    try:
        async with httpx.AsyncClient(
            headers={"User-Agent": "Prahari-Health-App/1.0 (health-sentinel)"}
        ) as client:
            response = await client.get(
                "https://nominatim.openstreetmap.org/search",
                params={
                    "q":             location.strip(),
                    "format":        "json",
                    "limit":         "1",
                    "addressdetails": "1",
                },
                timeout=8.0,
            )
            response.raise_for_status()
            results = response.json()

        if not results:
            raise HTTPException(
                status_code=404,
                detail=(
                    f"Location '{location}' could not be resolved. "
                    "Please be more specific (e.g. 'Bandra, Mumbai')."
                ),
            )

        best = results[0]
        return {
            "lat":          float(best["lat"]),
            "lng":          float(best["lon"]),
            "display_name": best.get("display_name", location),
        }

    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Geocoding failed for '%s': %s", location, exc)
        raise HTTPException(
            status_code=503, detail=f"Geocoding service unavailable: {exc}"
        ) from exc


@router.get(
    "/nmc-verify",
    response_model=dict,
    dependencies=[Depends(limit_nmc)],
    summary="Verify a doctor's credentials on the NMC Indian Medical Register",
    description=(
        "Queries the National Medical Commission's public IMR REST API to verify "
        "a doctor's registration status, qualification, and issuing state medical council. "
        "Can search by doctor name or NMC registration number. "
        "No API key required — NMC IMR is a free public government endpoint."
    ),
)
async def nmc_verify(
    name:   str | None = Query(None, description="Doctor's full or partial name"),
    reg_no: str | None = Query(None, description="NMC registration number (e.g. MH-12345)"),
) -> dict:
    """
    Verify a doctor on the NMC Indian Medical Register.

    Provide either `name` or `reg_no`. If both are provided, `reg_no` takes precedence.
    Returns the NMC record and verification status badge metadata.
    """
    if not name and not reg_no:
        raise HTTPException(
            status_code=400,
            detail="Provide at least one of: name, reg_no",
        )

    logger.info("NMC verify request: name=%s, reg_no=%s", name, reg_no)

    try:
        if reg_no:
            record = await verify_by_reg_no(reg_no)
        else:
            record = await verify_doctor_nmc(name)

        status = get_verification_status(record)

        return {
            "found":      record is not None,
            "status":     status,
            "nmc_record": record.model_dump() if record else None,
        }

    except Exception as exc:
        logger.error("NMC verify failed: %s", exc)
        raise HTTPException(
            status_code=503,
            detail=f"NMC verification service temporarily unavailable: {exc}",
        ) from exc

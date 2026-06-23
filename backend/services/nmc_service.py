"""
Prahari — NMC IMR Service (National Medical Commission — Indian Medical Register)
==================================================================================
Proxies calls to the NMC's public REST API to verify doctor credentials.

Base URL: https://www.nmc.org.in/MCIRest/open/getDataFromService
Auth:     None required — this is an open government endpoint.
Docs:     https://imr.nmc.org.in

Usage:
    from services.nmc_service import verify_doctor_nmc, verify_by_reg_no

Notes:
  - All requests are made from the backend to avoid CORS issues in the browser.
  - The NMC server can be slow (~3–10 s); we enforce a 12-second timeout.
  - We always set a descriptive User-Agent per NMC's ToS expectations.
  - If the endpoint is down, returns None gracefully — the caller shows ⚠️.
"""

import logging
from typing import Optional

import httpx

from models.directory import NMCRecord

logger = logging.getLogger(__name__)

_NMC_BASE = "https://www.nmc.org.in/MCIRest/open/getDataFromService"
_TIMEOUT  = 12.0
_HEADERS  = {
    "User-Agent": "Prahari-Health-Sentinel/1.0 (contact@prahari.org)",
    "Accept":     "application/json",
}


def _parse_nmc_record(raw: dict) -> NMCRecord:
    """Map raw NMC API fields to our NMCRecord model."""
    return NMCRecord(
        doctor_name           = raw.get("doctorName", ""),
        registration_no       = raw.get("registrationNo", ""),
        state_medical_council = raw.get("stateMedicalCouncil", ""),
        qualification         = raw.get("qualification", ""),
        university_name       = raw.get("universityName", ""),
        year_of_registration  = str(raw.get("yearOfRegistration", "")),
        permanent_address     = raw.get("permanentAddress", ""),
    )


async def verify_doctor_nmc(doctor_name: str) -> Optional[NMCRecord]:
    """
    Search the NMC Indian Medical Register by doctor name.

    Returns the first matching NMCRecord, or None if not found / API unavailable.

    Args:
        doctor_name: Full or partial doctor name (e.g. "Dr. R. K. Sharma").
    """
    if not doctor_name or not doctor_name.strip():
        return None

    # NMC works better with last name only — strip "Dr." prefix
    clean_name = (
        doctor_name.strip()
        .removeprefix("Dr.")
        .removeprefix("Dr ")
        .strip()
        .split()[0]  # use first significant token for broader matching
        if len(doctor_name.strip().split()) > 1
        else doctor_name.strip()
    )

    params = {
        "service": "getDoctorOrHospitalByName",
        "value":   clean_name,
        "start":   "0",
        "length":  "5",
    }

    try:
        async with httpx.AsyncClient(headers=_HEADERS, timeout=_TIMEOUT) as client:
            response = await client.get(_NMC_BASE, params=params)
            response.raise_for_status()
            data = response.json()

        records = data.get("data") or data.get("result") or []
        if not records:
            # Some NMC responses wrap data differently
            if isinstance(data, list) and len(data) > 0:
                records = data
            else:
                logger.debug("NMC returned no records for '%s'", clean_name)
                return None

        # Return the first record that has a registration number
        for rec in records:
            if rec.get("registrationNo"):
                parsed = _parse_nmc_record(rec)
                logger.info(
                    "NMC verified: %s (Reg: %s, Council: %s)",
                    parsed.doctor_name, parsed.registration_no, parsed.state_medical_council
                )
                return parsed

        # If none have reg no, return first record as partial
        if records:
            parsed = _parse_nmc_record(records[0])
            logger.debug("NMC partial match for '%s'", clean_name)
            return parsed

        return None

    except httpx.TimeoutException:
        logger.warning("NMC API timed out for '%s'", clean_name)
        return None
    except httpx.HTTPStatusError as exc:
        logger.warning("NMC API HTTP error for '%s': %s", clean_name, exc)
        return None
    except Exception as exc:
        logger.error("NMC API unexpected error for '%s': %s", clean_name, exc)
        return None


async def verify_by_reg_no(reg_no: str) -> Optional[NMCRecord]:
    """
    Search the NMC Indian Medical Register by registration number.

    Args:
        reg_no: NMC registration number (e.g. "MH-12345").
    """
    if not reg_no or not reg_no.strip():
        return None

    params = {
        "service": "getDoctorByRegNo",
        "value":   reg_no.strip(),
    }

    try:
        async with httpx.AsyncClient(headers=_HEADERS, timeout=_TIMEOUT) as client:
            response = await client.get(_NMC_BASE, params=params)
            response.raise_for_status()
            data = response.json()

        records = data.get("data") or data.get("result") or []
        if isinstance(data, list):
            records = data

        if records:
            return _parse_nmc_record(records[0])
        return None

    except Exception as exc:
        logger.error("NMC RegNo lookup failed for '%s': %s", reg_no, exc)
        return None


def get_verification_status(record: Optional[NMCRecord]) -> dict:
    """
    Returns the UI verification badge metadata for a given NMC record.

    Returns dict with keys: label, color, icon, status_key
    """
    if not record:
        return {
            "label":      "Verification Pending",
            "color":      "yellow",
            "icon":       "⚠️",
            "status_key": "unverified",
        }
    if record.registration_no and record.state_medical_council:
        return {
            "label":      "NMC Verified",
            "color":      "green",
            "icon":       "✅",
            "status_key": "nmc_verified",
        }
    return {
        "label":      "Partial Record",
        "color":      "orange",
        "icon":       "🔶",
        "status_key": "partial",
    }

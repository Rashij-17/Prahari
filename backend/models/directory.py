"""
Prahari — Directory Models
==========================
Pydantic models for the Provider Directory feature.

Extended in v3.0 to include:
  - NMCRecord: verified doctor data from National Medical Commission IMR
  - ProviderResult: enriched with NMC verification status, HFR fields, source tag
  - DirectoryResponse: includes source_summary for UI banners
"""

from typing import Literal, Optional
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Request
# ---------------------------------------------------------------------------

class DirectoryRequest(BaseModel):
    """Provider search input."""
    lat:        float = Field(...,        description="User latitude")
    lng:        float = Field(...,        description="User longitude")
    specialty:  str   = Field(default="", description="Specialty filter (optional)")
    radius_km:  int   = Field(default=5,  ge=1, le=50)
    limit:      int   = Field(default=10, ge=1, le=20)


# ---------------------------------------------------------------------------
# NMC Verification Record
# ---------------------------------------------------------------------------

class NMCRecord(BaseModel):
    """Data returned from the National Medical Commission Indian Medical Register."""
    doctor_name:          str = ""
    registration_no:      str = ""
    state_medical_council: str = ""
    qualification:        str = ""
    university_name:      str = ""
    year_of_registration: str = ""
    permanent_address:    str = ""


# ---------------------------------------------------------------------------
# Provider Result
# ---------------------------------------------------------------------------

class ProviderResult(BaseModel):
    # Core identity
    name:          str
    address:       str  = ""
    place_id:      str  = ""

    # Location details
    district:      str  = ""
    state:         str  = ""
    pincode:       str  = ""
    maps_url:      str  = ""
    distance_km:   float = 0.0

    # Contact
    phone:         str  = ""
    website:       str  = ""

    # Facility meta
    types:         list[str] = []
    facility_type: str  = ""          # e.g. HOSPITAL, CLINIC
    facility_subtype: str = ""        # e.g. Cardiology
    timings:       str  = ""          # Opening hours from HFR

    # OSM-legacy fields (kept for backward compat)
    rating:        float = 0.0
    total_ratings: int   = 0
    open_now:      bool | None = None

    # NMC Verification
    verification_status: Literal["nmc_verified", "unverified", "partial"] = "unverified"
    nmc_reg_no:      str = ""
    nmc_qualification: str = ""
    nmc_council:     str = ""
    nmc_year:        str = ""

    # Data provenance
    source:          Literal["abdm_hfr", "osm", "mock"] = "osm"
    is_mock:         bool = False


# ---------------------------------------------------------------------------
# Response
# ---------------------------------------------------------------------------

class DirectoryResponse(BaseModel):
    providers:     list[ProviderResult]
    total:         int
    radius_km:     int
    is_mock:       bool = False
    mock_notice:   str  = ""
    source_summary: str = ""   # e.g. "3 from ABDM HFR · 7 from OpenStreetMap"

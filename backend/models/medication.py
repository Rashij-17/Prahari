from typing import Optional
from pydantic import BaseModel

class DrugProfile(BaseModel):
    """
    Full clinical drug profile returned by GET /medication/profile.
    Fields may be empty strings if the openFDA label does not contain them.
    """
    # Identity
    brand_name:    str = ""
    generic_name:  str = ""
    manufacturer:  str = ""
    product_type:  str = ""
    route:         list[str] = []
    rxcui:         list[str] = []
    ndc:           list[str] = []

    # Clinical
    indications:       str = ""
    dosage:            str = ""
    warnings:          str = ""
    boxed_warning:     str = ""
    contraindications: str = ""
    adverse_reactions: str = ""
    drug_interactions: str = ""
    precautions:       str = ""
    storage:           str = ""
    description:       str = ""

    # Safety classification
    has_boxed_warning: bool = False
    urgency_level:     str = "safe"   # "safe" | "moderate" | "critical"


class DrugSummary(BaseModel):
    """Lightweight drug result returned by search endpoints."""
    rxcui:           Optional[str] = None
    name:            str = ""
    brand_name:      str = ""
    generic_name:    str = ""
    manufacturer:    str = ""
    route:           list[str] = []
    has_boxed_warning: bool = False
    urgency_level:   str = "safe"
    tty:             str = ""   # RxNorm term type (IN, BN, SCD, etc.)


class MedicationSearchResponse(BaseModel):
    """Combined search response from both RxNorm and openFDA."""
    query:   str
    results: list[DrugSummary]
    total:   int
    source:  str   # "rxnorm" | "openfda" | "combined"

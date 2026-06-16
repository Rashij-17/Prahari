"""
Prahari — Drug-Drug Interaction Router
======================================
Exposes API endpoints to evaluate drug-drug interactions for a group of RxCUIs.
"""

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from typing import List
from services.interaction_service import check_drug_interactions

router = APIRouter()


class InteractionQuery(BaseModel):
    """
    Schema for drug interaction lookup queries.
    """
    rxcuis: List[str] = Field(
        ..., 
        min_items=2, 
        description="List of RxCUI identifiers to analyze for pairwise interactions."
    )


class PairwiseInteraction(BaseModel):
    """
    Schema representing a single pairwise interaction outcome.
    """
    rxcui_1: str
    rxcui_2: str
    severity: str  # "critical" | "moderate" | "safe"
    description: str


class InteractionMatrixResponse(BaseModel):
    """
    Schema representing the complete drug interaction matrix results.
    """
    interactions: List[PairwiseInteraction]


@router.post(
    "/interactions",
    response_model=InteractionMatrixResponse,
    status_code=status.HTTP_200_OK,
    summary="Evaluate drug-drug interactions",
    description="Analyzes a list of RxCUIs and checks for pairwise drug interactions."
)
async def check_interactions(query: InteractionQuery):
    """
    Endpoint to evaluate drug-drug interactions.
    """
    rxcuis = query.rxcuis
    
    # Strip any empty strings or whitespace
    clean_rxcuis = [r.strip() for r in rxcuis if r and r.strip()]
    
    if len(clean_rxcuis) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least 2 valid RxCUI values are required to run interaction checks."
        )

    try:
        interactions = await check_drug_interactions(clean_rxcuis)
        return {"interactions": interactions}
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred while evaluating interactions: {exc}"
        )

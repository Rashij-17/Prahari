from pydantic import BaseModel, Field

class TriageRequest(BaseModel):
    """Symptom triage input from the user."""
    symptoms:   str  = Field(..., min_length=5, description="Free-text symptom description")
    sex:        str  = Field(default="male",   description='"male" or "female"')
    age:        int  = Field(default=30,       ge=1, le=120, description="Patient age in years")


class ConditionResult(BaseModel):
    name:        str
    probability: float
    urgency:     str = ""


class TriageResponse(BaseModel):
    urgency_level:  str               # "safe" | "moderate" | "critical"
    urgency_label:  str               # Human-readable label
    urgency_color:  str               # Maps to CSS ribbon class
    recommendation: str               # What to do next
    conditions:     list[ConditionResult]
    risk_factors:   list[str] = []
    is_mock:        bool = False
    mock_notice:    str  = ""

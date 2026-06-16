from pydantic import BaseModel, Field
from typing import Literal, Optional

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


class EvidenceItem(BaseModel):
    id: str
    choice_id: str  # "present" | "absent" | "unknown"
    source: str = "initial"


class TriageChatRequest(BaseModel):
    evidence: list[EvidenceItem]
    sex: str = "male"
    age: int = 30
    text: str | None = None


class ChatChoice(BaseModel):
    id: str
    label: str


class ChatQuestionItem(BaseModel):
    id: str
    name: str
    choices: list[ChatChoice] = Field(default_factory=list)


class ChatQuestion(BaseModel):
    type: Literal["single", "group_single", "group_multiple"]
    text: str
    items: list[ChatQuestionItem]


class TriageChatResponse(BaseModel):
    should_stop: bool
    evidence: list[EvidenceItem]
    question: Optional[ChatQuestion] = None
    triage_result: Optional[TriageResponse] = None


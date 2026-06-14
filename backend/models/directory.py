from pydantic import BaseModel, Field

class DirectoryRequest(BaseModel):
    """Provider search input."""
    lat:        float = Field(...,        description="User latitude")
    lng:        float = Field(...,        description="User longitude")
    specialty:  str   = Field(default="", description="Specialty filter (optional)")
    radius_km:  int   = Field(default=5,  ge=1, le=50)
    limit:      int   = Field(default=10, ge=1, le=20)


class ProviderResult(BaseModel):
    name:          str
    address:       str  = ""
    rating:        float = 0.0
    total_ratings: int   = 0
    types:         list[str] = []
    open_now:      bool | None = None
    place_id:      str  = ""
    phone:         str  = ""
    maps_url:      str  = ""
    distance_km:   float = 0.0
    is_mock:       bool  = False


class DirectoryResponse(BaseModel):
    providers:   list[ProviderResult]
    total:       int
    radius_km:   int
    is_mock:     bool = False
    mock_notice: str  = ""

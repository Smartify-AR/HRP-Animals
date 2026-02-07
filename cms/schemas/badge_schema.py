from typing import Optional
from pydantic import BaseModel, Field

class GameBadgeSchema(BaseModel):
    id: str = Field(..., description="Badge ID")
    name: str = Field(..., description="Badge name")
    description: str = Field(..., description="Badge description")
    icon: Optional[str] = Field(None, description="Badge icon path")
    gamePath: Optional[str] = Field(None, description="Game path")
    
    class Config:
        json_schema_extra = {
            "example": {
                "id": "sunflower",
                "name": "Garden Grower",
                "description": "A true green finger! You planted a beautiful garden for the bees.",
                "icon": "../../assets/badges/icons/feeding-badge.svg",
                "gamePath": "../../games/sunflower-planter/index.html"
            }
        }


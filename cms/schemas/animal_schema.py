from typing import Optional, Dict, Any
from pydantic import BaseModel, Field, validator

class LocationSchema(BaseModel):
    lat: float = Field(..., ge=-90, le=90, description="Latitude")
    lng: float = Field(..., ge=-180, le=180, description="Longitude")

class IconSchema(BaseModel):
    shadow: str = Field(..., description="Shadow icon path")
    found: str = Field(..., description="Found icon path")

class ModelSchema(BaseModel):
    url: str = Field(..., description="GLB model URL")
    usdz: Optional[str] = Field(None, description="USDZ model URL")
    scale: str = Field(default="1 1 1", description="Model scale")
    rotation: str = Field(default="0 0 0", description="Model rotation")
    
    @validator('scale', 'rotation')
    def validate_transform(cls, v):
        parts = v.split()
        if len(parts) != 3:
            raise ValueError("Must have 3 space-separated values")
        try:
            [float(p) for p in parts]
        except ValueError:
            raise ValueError("All values must be numbers")
        return v

class PingSchema(BaseModel):
    cooldownMinutes: int = Field(default=3, ge=0, description="Cooldown in minutes")

class BadgeSchema(BaseModel):
    id: str = Field(..., description="Badge ID")
    name: str = Field(..., description="Badge name")
    icon: Optional[str] = Field(None, description="Badge icon path")
    description: Optional[str] = Field(None, description="Badge description")
    gamePath: Optional[str] = Field(None, description="Game path")

class AnimalSchema(BaseModel):
    id: str = Field(..., description="Animal ID")
    name: str = Field(..., description="Animal name")
    scientificName: str = Field(..., description="Scientific name")
    description: str = Field(..., description="Animal description")
    badgeDescription: str = Field(..., description="Badge description")
    location: LocationSchema = Field(..., description="Location coordinates")
    radiusMeters: int = Field(default=10, ge=1, description="Radius in meters")
    icon: IconSchema = Field(..., description="Icon paths")
    model: ModelSchema = Field(..., description="3D model information")
    ping: PingSchema = Field(default_factory=lambda: PingSchema(), description="Ping settings")
    badge: BadgeSchema = Field(..., description="Associated badge")
    
    class Config:
        json_schema_extra = {
            "example": {
                "id": "peacock-home",
                "name": "Peacock",
                "scientificName": "Indian Peafowl",
                "description": "Peacocks aren't great at flying...",
                "badgeDescription": "Nice job, you found the peacock!",
                "location": {"lat": 51.441293, "lng": -0.062549},
                "radiusMeters": 10,
                "icon": {
                    "shadow": "../../assets/icons/shadows/placeholder.svg",
                    "found": "../../assets/icons/found/placeholder.svg"
                },
                "model": {
                    "url": "../../assets/wayfinding/model/peacock.glb",
                    "usdz": "../../assets/wayfinding/model/peacock.usdz",
                    "scale": "0.7 0.7 0.7",
                    "rotation": "0 0 0"
                },
                "ping": {"cooldownMinutes": 3},
                "badge": {
                    "id": "peacock",
                    "name": "Peacock Spotter",
                    "icon": "../../assets/badges/icons/peacock-badge.svg",
                    "description": "You found the magnificent peacock!",
                    "gamePath": "../../games/proud-photographer/index.html"
                }
            }
        }


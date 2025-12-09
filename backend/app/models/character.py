"""
Character profile data models
"""
from typing import Optional
from pydantic import BaseModel, Field


class CharacterProfile(BaseModel):
    """Character profile model"""
    name: str = Field(..., description="Character name")
    personality: str = Field(..., description="Personality description")
    background: Optional[str] = Field(None, description="Background story")
    speaking_style: Optional[str] = Field(None, description="Speaking style")
    appearance: Optional[str] = Field(None, description="Appearance description")
    relationships: Optional[str] = Field(None, description="Relationship with user")


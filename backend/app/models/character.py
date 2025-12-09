"""
Character data models
"""
from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field


class Character(BaseModel):
    """Character model"""
    id: str = Field(..., description="Character unique identifier")
    name: str = Field(..., description="Character name")
    system_prompt: str = Field(..., description="System prompt for the character")
    is_default: bool = Field(default=False, description="Whether this is the default character")
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class CharacterCreateRequest(BaseModel):
    """Request model for creating a character"""
    name: str = Field(..., min_length=1, max_length=100, description="Character name")
    system_prompt: str = Field(..., min_length=1, max_length=10000, description="System prompt content")


class CharacterUpdateRequest(BaseModel):
    """Request model for updating a character"""
    name: Optional[str] = Field(None, min_length=1, max_length=100, description="Character name")
    system_prompt: Optional[str] = Field(None, min_length=1, max_length=10000, description="System prompt content")


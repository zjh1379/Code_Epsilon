"""
Character profile API endpoints
Handles character profile management
"""
import logging
from fastapi import APIRouter, HTTPException
from app.models.character import CharacterProfile
from app.utils.prompt_builder import get_default_character

logger = logging.getLogger(__name__)

router = APIRouter()

# In-memory character profile storage (for MVP)
# In production, this should be stored in database
_character_cache: CharacterProfile = get_default_character()


@router.get("/character", response_model=CharacterProfile)
async def get_character():
    """
    Get current character profile
    
    Returns:
        Current character profile
    """
    return _character_cache


@router.post("/character", response_model=CharacterProfile)
async def update_character(character: CharacterProfile):
    """
    Update character profile
    
    Args:
        character: Character profile to update
        
    Returns:
        Updated character profile
    """
    # Validate required fields
    if not character.name or not character.name.strip():
        raise HTTPException(status_code=400, detail="角色名称不能为空")
    
    if not character.personality or not character.personality.strip():
        raise HTTPException(status_code=400, detail="性格描述不能为空")
    
    # Update cache
    global _character_cache
    _character_cache = character
    
    logger.info(f"Character profile updated: {character.name}")
    
    return _character_cache


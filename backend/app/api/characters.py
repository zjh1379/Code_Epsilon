"""
Character management API endpoints
Handles character CRUD operations and activation
"""
import logging
from fastapi import APIRouter, HTTPException, Path
from app.models.character import Character, CharacterCreateRequest, CharacterUpdateRequest
from app.services.character_service import character_service

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/characters", response_model=list[Character])
async def get_all_characters():
    """
    Get all characters
    
    Returns:
        List of all characters
    """
    return character_service.get_all_characters()


@router.get("/characters/current", response_model=Character)
async def get_current_character():
    """
    Get current active character
    
    Returns:
        Current active character
    """
    return character_service.get_current_character()


@router.get("/characters/{character_id}", response_model=Character)
async def get_character(character_id: str = Path(..., description="Character ID")):
    """
    Get character by ID
    
    Args:
        character_id: Character ID
        
    Returns:
        Character object
    """
    character = character_service.get_character(character_id)
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")
    return character


@router.post("/characters", response_model=Character, status_code=201)
async def create_character(request: CharacterCreateRequest):
    """
    Create a new custom character
    
    Args:
        request: Character creation request
        
    Returns:
        Created character
    """
    try:
        character = character_service.create_character(
            name=request.name,
            system_prompt=request.system_prompt
        )
        return character
    except Exception as e:
        logger.error(f"Error creating character: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create character: {str(e)}")


@router.put("/characters/{character_id}", response_model=Character)
async def update_character(
    character_id: str = Path(..., description="Character ID"),
    request: CharacterUpdateRequest = None
):
    """
    Update a character (Epsilon cannot be updated)
    
    Args:
        character_id: Character ID
        request: Character update request
        
    Returns:
        Updated character
    """
    try:
        character = character_service.update_character(
            character_id=character_id,
            name=request.name if request else None,
            system_prompt=request.system_prompt if request else None
        )
        if not character:
            raise HTTPException(status_code=404, detail="Character not found")
        return character
    except ValueError as e:
        # Epsilon protection
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating character: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update character: {str(e)}")


@router.delete("/characters/{character_id}")
async def delete_character(character_id: str = Path(..., description="Character ID")):
    """
    Delete a character (Epsilon cannot be deleted)
    
    Args:
        character_id: Character ID
        
    Returns:
        Success message
    """
    try:
        success = character_service.delete_character(character_id)
        if not success:
            raise HTTPException(status_code=404, detail="Character not found")
        return {"success": True, "message": "角色已删除"}
    except ValueError as e:
        # Epsilon protection
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        logger.error(f"Error deleting character: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete character: {str(e)}")


@router.post("/characters/{character_id}/activate", response_model=Character)
async def activate_character(character_id: str = Path(..., description="Character ID")):
    """
    Activate a character
    
    Args:
        character_id: Character ID to activate
        
    Returns:
        Activated character
    """
    character = character_service.activate_character(character_id)
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")
    return character


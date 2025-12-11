from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.services.history_service import history_service
from app.models.history import ConversationResponse, MessageResponse, ConversationDetailResponse

router = APIRouter(prefix="/history", tags=["history"])

@router.get("/conversations", response_model=List[ConversationResponse])
def get_conversations(
    user_id: str = Query(..., description="User ID"),
    limit: int = 20,
    db: Session = Depends(get_db)
):
    """Get list of conversations for a user"""
    return history_service.get_user_conversations(db, user_id, limit)

@router.get("/conversations/{conversation_id}", response_model=ConversationDetailResponse)
def get_conversation_detail(
    conversation_id: str,
    db: Session = Depends(get_db)
):
    """Get conversation details including messages"""
    conversation = history_service.get_conversation(db, conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # Manually populate messages if not eager loaded (though SQLAlchemy relationship should handle it if accessed)
    # We return the ORM object, Pydantic from_attributes handles it
    return conversation

@router.get("/conversations/{conversation_id}/messages", response_model=List[MessageResponse])
def get_messages(
    conversation_id: str,
    db: Session = Depends(get_db)
):
    """Get messages for a conversation"""
    return history_service.get_messages(db, conversation_id)

@router.delete("/conversations/{conversation_id}")
def delete_conversation(
    conversation_id: str,
    db: Session = Depends(get_db)
):
    """Delete a conversation"""
    success = history_service.delete_conversation(db, conversation_id)
    if not success:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"status": "success"}


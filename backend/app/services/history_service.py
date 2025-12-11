from sqlalchemy.orm import Session
from app.models.db import Conversation, Message
from datetime import datetime
import uuid
from typing import List, Optional

class HistoryService:
    def create_conversation(self, db: Session, user_id: str, conversation_id: str = None, title: str = None):
        if not conversation_id:
            conversation_id = str(uuid.uuid4())
        
        # Check if exists
        existing = self.get_conversation(db, conversation_id)
        if existing:
            return existing
            
        db_conversation = Conversation(id=conversation_id, user_id=user_id, title=title)
        db.add(db_conversation)
        db.commit()
        db.refresh(db_conversation)
        return db_conversation

    def get_conversation(self, db: Session, conversation_id: str):
        return db.query(Conversation).filter(Conversation.id == conversation_id).first()

    def get_user_conversations(self, db: Session, user_id: str, limit: int = 20):
        return db.query(Conversation).filter(Conversation.user_id == user_id).order_by(Conversation.updated_at.desc()).limit(limit).all()

    def add_message(self, db: Session, conversation_id: str, role: str, content: str):
        db_message = Message(conversation_id=conversation_id, role=role, content=content)
        db.add(db_message)
        
        # Update conversation updated_at
        conversation = self.get_conversation(db, conversation_id)
        if conversation:
            conversation.updated_at = datetime.utcnow()
            db.add(conversation) # Ensure it's in session
            
        db.commit()
        db.refresh(db_message)
        return db_message

    def get_messages(self, db: Session, conversation_id: str):
        return db.query(Message).filter(Message.conversation_id == conversation_id).order_by(Message.created_at).all()

    def delete_conversation(self, db: Session, conversation_id: str):
        conversation = self.get_conversation(db, conversation_id)
        if conversation:
            db.delete(conversation)
            db.commit()
            return True
        return False

# Global instance not needed if we dependency inject, but useful for quick access
history_service = HistoryService()


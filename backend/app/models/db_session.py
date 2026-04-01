"""
SQLAlchemy ORM models for conversation summaries.
"""
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Text
from app.database import Base


class ConversationSummaryDB(Base):
    __tablename__ = "conversation_summaries"

    id = Column(String, primary_key=True)
    conversation_id = Column(String, nullable=False, index=True)
    user_id = Column(String, nullable=False, index=True)
    character_id = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    topics_discussed = Column(Text, default="[]")
    key_facts_learned = Column(Text, default="[]")
    emotional_tone = Column(String, default="neutral")
    unresolved_threads = Column(Text, default="[]")
    relationship_observation = Column(Text, default="")
    one_line_summary = Column(Text, default="")

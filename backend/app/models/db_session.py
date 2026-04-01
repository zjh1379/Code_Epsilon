"""
SQLAlchemy ORM models for conversation summaries and character states.
"""
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Text, Integer
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


class CharacterStateDB(Base):
    __tablename__ = "character_states"

    id = Column(String, primary_key=True)
    user_id = Column(String, nullable=False, index=True)
    character_id = Column(String, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)

    total_conversations = Column(Integer, default=0)
    total_messages = Column(Integer, default=0)
    first_interaction_at = Column(DateTime, nullable=True)
    last_interaction_at = Column(DateTime, nullable=True)
    last_summary_id = Column(String, nullable=True)

    familiarity_phase = Column(String, default="new")
    preferences = Column(Text, default="{}")
    observations = Column(Text, default="[]")

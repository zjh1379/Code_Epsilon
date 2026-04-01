"""
Data models for context building, session management, and conversation summaries.
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class ContextMetadata(BaseModel):
    """Metadata about how context was assembled."""
    total_tokens: int = 0
    character_prompt_tokens: int = 0
    memory_tokens: int = 0
    history_tokens: int = 0
    summary_tokens: int = 0
    messages_included: int = 0
    messages_excluded: int = 0


class BuiltContext(BaseModel):
    """Output of ContextBuilder: ready-to-send messages + metadata."""
    messages: list[dict] = Field(default_factory=list)
    metadata: ContextMetadata = Field(default_factory=ContextMetadata)


class ConversationSummaryData(BaseModel):
    """Structured summary of a conversation or conversation segment."""
    id: str
    conversation_id: str
    user_id: str
    character_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

    topics_discussed: list[str] = Field(default_factory=list)
    key_facts_learned: list[str] = Field(default_factory=list)
    emotional_tone: str = "neutral"
    unresolved_threads: list[str] = Field(default_factory=list)
    relationship_observation: str = ""
    one_line_summary: str = ""


class ActiveSession(BaseModel):
    """Runtime state for an active conversation (in-memory, not persisted)."""
    conversation_id: str
    user_id: str
    character_id: str
    started_at: datetime = Field(default_factory=datetime.utcnow)
    last_activity_at: datetime = Field(default_factory=datetime.utcnow)

    message_count: int = 0
    topics_this_session: list[str] = Field(default_factory=list)
    current_tone: str = "neutral"
    rolling_summary: Optional[str] = None


class ProcessedResponse(BaseModel):
    """Output of ResponseProcessor (Phase B). Defined here for forward compatibility."""
    text: str = ""
    emotion: str = "neutral"
    topics: list[str] = Field(default_factory=list)
    memory_signals: Optional[dict] = None
    actions: Optional[list[dict]] = None


class CharacterStateRecord(BaseModel):
    """Persistent character state for one (user, character) pair."""
    user_id: str
    character_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    total_conversations: int = 0
    total_messages: int = 0
    first_interaction_at: Optional[datetime] = None
    last_interaction_at: Optional[datetime] = None
    last_summary_id: Optional[str] = None

    familiarity_phase: str = "new"
    preferences: dict = Field(default_factory=dict)
    observations: list[str] = Field(default_factory=list)

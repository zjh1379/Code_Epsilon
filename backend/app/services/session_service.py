"""
In-memory session state management for active conversations.
Tracks message counts, topics, tone, and rolling summaries per conversation.
"""
import logging
from datetime import datetime
from typing import Optional
from app.models.session import ActiveSession

logger = logging.getLogger(__name__)


class SessionService:
    """Manages runtime state for active conversations."""

    def __init__(self):
        self._sessions: dict[str, ActiveSession] = {}

    def get_session(self, conversation_id: str) -> Optional[ActiveSession]:
        """Get an active session by conversation_id, or None."""
        return self._sessions.get(conversation_id)

    def get_or_create(
        self,
        conversation_id: str,
        user_id: str,
        character_id: str,
    ) -> ActiveSession:
        """Get existing session or create a new one."""
        if conversation_id in self._sessions:
            return self._sessions[conversation_id]

        session = ActiveSession(
            conversation_id=conversation_id,
            user_id=user_id,
            character_id=character_id,
        )
        self._sessions[conversation_id] = session
        logger.info(f"Created new session: {conversation_id}")
        return session

    def record_message(self, conversation_id: str) -> None:
        """Increment message count and update last activity timestamp."""
        session = self._sessions.get(conversation_id)
        if session is None:
            return
        session.message_count += 1
        session.last_activity_at = datetime.utcnow()

    def update_topics(self, conversation_id: str, topics: list[str]) -> None:
        """Add topics to the session (deduplicated)."""
        session = self._sessions.get(conversation_id)
        if session is None:
            return
        existing = set(session.topics_this_session)
        for topic in topics:
            if topic not in existing:
                session.topics_this_session.append(topic)
                existing.add(topic)

    def update_tone(self, conversation_id: str, tone: str) -> None:
        """Update the detected emotional tone of the current session."""
        session = self._sessions.get(conversation_id)
        if session is None:
            return
        session.current_tone = tone

    def set_rolling_summary(self, conversation_id: str, summary: str) -> None:
        """Set or replace the rolling in-session summary."""
        session = self._sessions.get(conversation_id)
        if session is None:
            return
        session.rolling_summary = summary

    def remove_session(self, conversation_id: str) -> Optional[ActiveSession]:
        """Remove and return a session (for cleanup or end-of-session processing)."""
        return self._sessions.pop(conversation_id, None)

    def get_stale_sessions(self, max_idle_seconds: int = 1800) -> list[str]:
        """Return conversation_ids of sessions idle longer than max_idle_seconds."""
        now = datetime.utcnow()
        stale = []
        for cid, session in self._sessions.items():
            idle = (now - session.last_activity_at).total_seconds()
            if idle > max_idle_seconds:
                stale.append(cid)
        return stale

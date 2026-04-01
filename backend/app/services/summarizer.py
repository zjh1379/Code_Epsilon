"""
Conversation summarization service.
Generates structured summaries via LLM for use by ContextBuilder.
Supports two modes: rolling in-session and end-of-session.
"""
import json
import logging
import re
import uuid
from typing import Optional

from sqlalchemy.orm import Session as DBSession

from app.models.session import ConversationSummaryData
from app.models.db_session import ConversationSummaryDB
from app.services.llm_service import llm_service

logger = logging.getLogger(__name__)

ROLLING_SUMMARY_PROMPT = """You are summarizing a conversation segment between a character and a user.
Produce a concise summary in 2-3 sentences that captures: the main topics discussed, any important facts about the user, and the emotional tone.
Write from the character's perspective (use "the user" not "I").
Output plain text only, no JSON, no markdown."""

END_OF_SESSION_PROMPT = """You had a conversation with a user. Summarize it as structured JSON.

Required fields:
{
  "topics_discussed": ["topic1", "topic2"],
  "key_facts_learned": ["fact1", "fact2"],
  "emotional_tone": "one word or short phrase",
  "unresolved_threads": ["thread1"],
  "relationship_observation": "one sentence about how the interaction felt from your perspective",
  "one_line_summary": "single sentence overview"
}

Only return valid JSON. No extra text."""


class Summarizer:
    """Generates conversation summaries for context compression and cross-session continuity."""

    def __init__(self, rolling_threshold: int = 16):
        self.rolling_threshold = rolling_threshold

    async def maybe_rolling_summarize(
        self,
        messages: list[dict],
        existing_summary: Optional[str],
    ) -> tuple[Optional[str], list[dict]]:
        """Generate rolling summary if message count exceeds threshold."""
        if len(messages) <= self.rolling_threshold:
            return existing_summary, messages

        split_point = len(messages) // 2
        old_messages = messages[:split_point]
        recent_messages = messages[split_point:]

        old_text = self._messages_to_text(old_messages)
        context = ""
        if existing_summary:
            context = f"Previous summary: {existing_summary}\n\n"

        try:
            summary = await llm_service.chat(
                message=f"{context}Conversation segment to summarize:\n{old_text}",
                history=[],
                system_prompt=ROLLING_SUMMARY_PROMPT,
            )
            summary = summary.strip()
            logger.info(
                f"Rolling summary generated: {len(summary)} chars, kept {len(recent_messages)} messages"
            )
            return summary, recent_messages
        except Exception as e:
            logger.error(f"Rolling summarization failed: {e}")
            return existing_summary, messages

    async def generate_end_of_session_summary(
        self,
        conversation_id: str,
        user_id: str,
        character_id: str,
        messages: list[dict],
        db: Optional[DBSession] = None,
    ) -> Optional[ConversationSummaryData]:
        """Generate end-of-session summary and optionally persist it."""
        if not messages:
            return None

        conversation_text = self._messages_to_text(messages)

        try:
            raw = await llm_service.chat(
                message=f"Conversation to summarize:\n{conversation_text}",
                history=[],
                system_prompt=END_OF_SESSION_PROMPT,
            )

            data = self._parse_summary_json(raw)
            if data is None:
                return None

            summary = ConversationSummaryData(
                id=f"sum_{uuid.uuid4().hex[:12]}",
                conversation_id=conversation_id,
                user_id=user_id,
                character_id=character_id,
                topics_discussed=data.get("topics_discussed", []),
                key_facts_learned=data.get("key_facts_learned", []),
                emotional_tone=data.get("emotional_tone", "neutral"),
                unresolved_threads=data.get("unresolved_threads", []),
                relationship_observation=data.get("relationship_observation", ""),
                one_line_summary=data.get("one_line_summary", ""),
            )

            if db is not None:
                self._persist_summary(db, summary)

            logger.info(f"End-of-session summary generated for {conversation_id}")
            return summary
        except Exception as e:
            logger.error(f"End-of-session summarization failed: {e}")
            return None

    def get_latest_summary(
        self,
        db: DBSession,
        user_id: str,
        character_id: str,
    ) -> Optional[ConversationSummaryData]:
        """Retrieve the most recent conversation summary for a user-character pair."""
        row = (
            db.query(ConversationSummaryDB)
            .filter(
                ConversationSummaryDB.user_id == user_id,
                ConversationSummaryDB.character_id == character_id,
            )
            .order_by(ConversationSummaryDB.created_at.desc())
            .first()
        )
        if row is None:
            return None
        return self._row_to_data(row)

    @staticmethod
    def _messages_to_text(messages: list[dict]) -> str:
        lines = []
        for msg in messages:
            role = msg.get("role", "unknown")
            content = msg.get("content", "")
            lines.append(f"{role}: {content}")
        return "\n".join(lines)

    @staticmethod
    def _parse_summary_json(raw: str) -> Optional[dict]:
        raw = raw.strip()
        json_match = re.search(r"\{.*\}", raw, re.DOTALL)
        if json_match:
            try:
                return json.loads(json_match.group(0))
            except json.JSONDecodeError:
                pass
        logger.warning(f"Failed to parse summary JSON from LLM output: {raw[:200]}")
        return None

    @staticmethod
    def _persist_summary(db: DBSession, summary: ConversationSummaryData) -> None:
        row = ConversationSummaryDB(
            id=summary.id,
            conversation_id=summary.conversation_id,
            user_id=summary.user_id,
            character_id=summary.character_id,
            created_at=summary.created_at,
            topics_discussed=json.dumps(summary.topics_discussed, ensure_ascii=False),
            key_facts_learned=json.dumps(summary.key_facts_learned, ensure_ascii=False),
            emotional_tone=summary.emotional_tone,
            unresolved_threads=json.dumps(summary.unresolved_threads, ensure_ascii=False),
            relationship_observation=summary.relationship_observation,
            one_line_summary=summary.one_line_summary,
        )
        db.add(row)
        db.commit()

    @staticmethod
    def _row_to_data(row: ConversationSummaryDB) -> ConversationSummaryData:
        def safe_json_loads(text, default):
            if not text:
                return default
            try:
                return json.loads(text)
            except (json.JSONDecodeError, TypeError):
                return default

        return ConversationSummaryData(
            id=row.id,
            conversation_id=row.conversation_id,
            user_id=row.user_id,
            character_id=row.character_id,
            created_at=row.created_at,
            topics_discussed=safe_json_loads(row.topics_discussed, []),
            key_facts_learned=safe_json_loads(row.key_facts_learned, []),
            emotional_tone=row.emotional_tone or "neutral",
            unresolved_threads=safe_json_loads(row.unresolved_threads, []),
            relationship_observation=row.relationship_observation or "",
            one_line_summary=row.one_line_summary or "",
        )


summarizer = Summarizer()

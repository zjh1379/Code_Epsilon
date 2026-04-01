"""
Post-response signal extraction and state update pipeline.
"""
import json
import re
from typing import Optional

from sqlalchemy.orm import Session as DBSession

from app.models.session import ProcessedResponse
from app.services.character_state import CharacterStateService
from app.services.session_service import SessionService
from app.services.llm_service import llm_service
from app.services.memory_service import get_memory_service


class ResponseProcessor:
    """Extracts per-turn signals and updates session/character state."""

    def __init__(
        self,
        session_service: SessionService,
        character_state_service: CharacterStateService,
        deep_analysis_interval: int = 6,
    ):
        self.session_service = session_service
        self.character_state_service = character_state_service
        self.deep_analysis_interval = deep_analysis_interval

    async def process_turn(
        self,
        db: DBSession,
        conversation_id: str,
        user_id: str,
        character_id: str,
        user_message: str,
        assistant_text: str,
        history_messages: list[dict],
    ) -> ProcessedResponse:
        topics = self._extract_topics(user_message + "\n" + assistant_text)
        emotion = self._estimate_tone(assistant_text)

        self.session_service.update_topics(conversation_id, topics)
        self.session_service.update_tone(conversation_id, emotion)

        state = self.character_state_service.record_message(db, user_id, character_id)

        memory_signals = None
        if state.total_messages % self.deep_analysis_interval == 0:
            memory_signals = await self._deep_extract_signals(
                history_messages=history_messages,
                user_message=user_message,
                assistant_text=assistant_text,
            )
            if memory_signals:
                self.character_state_service.apply_deep_signals(
                    db,
                    state,
                    preferences=memory_signals.get("preferences"),
                    observation=memory_signals.get("observation"),
                )

        await self._write_memory(user_id, conversation_id, character_id, user_message, assistant_text, memory_signals)
        return ProcessedResponse(
            text=assistant_text,
            emotion=emotion,
            topics=topics,
            memory_signals=memory_signals,
            actions=None,
        )

    @staticmethod
    def _extract_topics(text: str) -> list[str]:
        terms = re.findall(r"[A-Za-z][A-Za-z0-9_+-]{2,}", text.lower())
        stop = {"the", "and", "with", "this", "that", "from", "have", "your", "you"}
        topics = []
        for t in terms:
            if t in stop:
                continue
            if t not in topics:
                topics.append(t)
            if len(topics) >= 6:
                break
        return topics

    @staticmethod
    def _estimate_tone(text: str) -> str:
        lowered = text.lower()
        if "!" in text or "great" in lowered or "awesome" in lowered:
            return "energetic"
        if "sorry" in lowered or "concern" in lowered:
            return "empathetic"
        if "let's" in lowered or "step" in lowered:
            return "focused"
        return "neutral"

    async def _deep_extract_signals(
        self,
        history_messages: list[dict],
        user_message: str,
        assistant_text: str,
    ) -> Optional[dict]:
        segment = history_messages[-8:] if history_messages else []
        segment_text = "\n".join(
            [f"{m.get('role', 'unknown')}: {m.get('content', '')}" for m in segment]
        )
        segment_text += f"\nuser: {user_message}\nassistant: {assistant_text}"

        prompt = (
            "Extract user preference and one character observation as JSON.\n"
            "Return format:\n"
            "{\"preferences\": {\"key\": \"value\"}, \"observation\": \"...\"}\n"
            "Only include confident signals.\n\n"
            f"Conversation:\n{segment_text}"
        )
        try:
            raw = await llm_service.chat(
                message=prompt,
                history=[],
                system_prompt="You are an information extraction assistant.",
            )
            match = re.search(r"\{.*\}", raw, re.DOTALL)
            if not match:
                return None
            data = json.loads(match.group(0))
            if not isinstance(data, dict):
                return None
            return {
                "preferences": data.get("preferences", {}),
                "observation": data.get("observation", ""),
            }
        except Exception:
            return None

    async def _write_memory(
        self,
        user_id: str,
        conversation_id: str,
        character_id: str,
        user_message: str,
        assistant_text: str,
        memory_signals: Optional[dict],
    ) -> None:
        memory_service = get_memory_service()
        if not memory_service:
            return
        try:
            await memory_service.write_conversation(
                user_id=user_id,
                conversation_id=conversation_id,
                messages=[
                    {"role": "user", "content": user_message},
                    {"role": "assistant", "content": assistant_text},
                ],
                character_id=character_id,
            )
            if memory_signals:
                await memory_service.write_relational_signals(
                    user_id=user_id,
                    character_id=character_id,
                    conversation_id=conversation_id,
                    preferences=memory_signals.get("preferences", {}),
                    observation=memory_signals.get("observation", ""),
                )
        except Exception:
            return

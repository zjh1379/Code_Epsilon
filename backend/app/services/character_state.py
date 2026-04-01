"""
Persistent character state service.
"""
import json
from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session as DBSession

from app.models.db_session import CharacterStateDB
from app.models.session import CharacterStateRecord


class CharacterStateService:
    """Manages persistent per-user character state."""

    def __init__(
        self,
        phase_acquainted: int = 3,
        phase_familiar: int = 10,
        phase_close: int = 25,
    ):
        self.phase_acquainted = phase_acquainted
        self.phase_familiar = phase_familiar
        self.phase_close = phase_close

    def get_or_create(
        self,
        db: DBSession,
        user_id: str,
        character_id: str,
    ) -> CharacterStateRecord:
        state_id = f"{user_id}_{character_id}"
        row = db.query(CharacterStateDB).filter(CharacterStateDB.id == state_id).first()
        if row is not None:
            return self._row_to_record(row)

        now = datetime.utcnow()
        row = CharacterStateDB(
            id=state_id,
            user_id=user_id,
            character_id=character_id,
            created_at=now,
            updated_at=now,
            total_conversations=0,
            total_messages=0,
            first_interaction_at=now,
            last_interaction_at=now,
            familiarity_phase="new",
            preferences="{}",
            observations="[]",
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        return self._row_to_record(row)

    def record_message(
        self,
        db: DBSession,
        user_id: str,
        character_id: str,
    ) -> CharacterStateRecord:
        state = self.get_or_create(db, user_id, character_id)
        state.total_messages += 1
        state.last_interaction_at = datetime.utcnow()
        state.familiarity_phase = self._phase_for_conversations(state.total_conversations)
        self.save(db, state)
        return state

    def mark_conversation_start(
        self,
        db: DBSession,
        user_id: str,
        character_id: str,
    ) -> CharacterStateRecord:
        """Increment conversation count when a new session starts."""
        state = self.get_or_create(db, user_id, character_id)
        state.total_conversations += 1
        state.last_interaction_at = datetime.utcnow()
        state.familiarity_phase = self._phase_for_conversations(state.total_conversations)
        self.save(db, state)
        return state

    def apply_deep_signals(
        self,
        db: DBSession,
        state: CharacterStateRecord,
        preferences: Optional[dict] = None,
        observation: Optional[str] = None,
    ) -> CharacterStateRecord:
        if preferences:
            merged = dict(state.preferences)
            merged.update(preferences)
            state.preferences = merged
        if observation:
            obs = list(state.observations)
            if observation not in obs:
                obs.append(observation)
            state.observations = obs[-8:]
        state.updated_at = datetime.utcnow()
        self.save(db, state)
        return state

    def build_prompt_context(self, state: CharacterStateRecord) -> str:
        parts = [
            f"You have spoken with this user {state.total_conversations} times before.",
            f"Relationship phase: {state.familiarity_phase}.",
        ]
        if state.preferences:
            parts.append("Known preferences:")
            for key, value in state.preferences.items():
                parts.append(f"- {key}: {value}")
        if state.observations:
            parts.append("Recent observations:")
            for item in state.observations[-3:]:
                parts.append(f"- {item}")
        parts.append(
            "Use this context naturally. Do not explicitly say 'I remember that...'."
        )
        return "\n".join(parts)

    def set_last_summary(
        self,
        db: DBSession,
        user_id: str,
        character_id: str,
        summary_id: str,
    ) -> CharacterStateRecord:
        """Attach latest summary reference to state."""
        state = self.get_or_create(db, user_id, character_id)
        state.last_summary_id = summary_id
        state.updated_at = datetime.utcnow()
        self.save(db, state)
        return state

    def save(self, db: DBSession, state: CharacterStateRecord) -> None:
        state_id = f"{state.user_id}_{state.character_id}"
        row = db.query(CharacterStateDB).filter(CharacterStateDB.id == state_id).first()
        if row is None:
            return
        row.updated_at = datetime.utcnow()
        row.total_conversations = state.total_conversations
        row.total_messages = state.total_messages
        row.first_interaction_at = state.first_interaction_at
        row.last_interaction_at = state.last_interaction_at
        row.last_summary_id = state.last_summary_id
        row.familiarity_phase = state.familiarity_phase
        row.preferences = json.dumps(state.preferences, ensure_ascii=False)
        row.observations = json.dumps(state.observations, ensure_ascii=False)
        db.commit()

    def _phase_for_conversations(self, count: int) -> str:
        if count >= self.phase_close:
            return "close"
        if count >= self.phase_familiar:
            return "familiar"
        if count >= self.phase_acquainted:
            return "acquainted"
        return "new"

    @staticmethod
    def _row_to_record(row: CharacterStateDB) -> CharacterStateRecord:
        def _safe_json_load(text: str, default):
            if not text:
                return default
            try:
                return json.loads(text)
            except Exception:
                return default

        return CharacterStateRecord(
            user_id=row.user_id,
            character_id=row.character_id,
            created_at=row.created_at,
            updated_at=row.updated_at,
            total_conversations=int(row.total_conversations or 0),
            total_messages=int(row.total_messages or 0),
            first_interaction_at=row.first_interaction_at,
            last_interaction_at=row.last_interaction_at,
            last_summary_id=row.last_summary_id,
            familiarity_phase=row.familiarity_phase or "new",
            preferences=_safe_json_load(row.preferences, {}),
            observations=_safe_json_load(row.observations, []),
        )


character_state_service = CharacterStateService()

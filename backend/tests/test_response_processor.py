"""Tests for ResponseProcessor."""
import pytest

from app.database import SessionLocal, Base, engine
import app.models.db
import app.models.db_session
from app.services.response_processor import ResponseProcessor
from app.services.session_service import SessionService
from app.services.character_state import CharacterStateService


def _db():
    Base.metadata.create_all(bind=engine)
    return SessionLocal()


@pytest.mark.asyncio
async def test_process_turn_basic_updates(monkeypatch):
    db = _db()

    async def _fake_chat(*args, **kwargs):
        return '{"preferences":{"tone":"casual_ok"},"observation":"user likes architecture"}'

    monkeypatch.setattr("app.services.response_processor.llm_service.chat", _fake_chat)

    processor = ResponseProcessor(
        session_service=SessionService(),
        character_state_service=CharacterStateService(),
        deep_analysis_interval=1,
    )

    result = await processor.process_turn(
        db=db,
        conversation_id="conv_rp_1",
        user_id="user_rp_1",
        character_id="epsilon",
        user_message="Let's discuss architecture choices",
        assistant_text="Great! Let's break this into clear steps.",
        history_messages=[],
    )

    assert result.emotion in {"energetic", "focused", "neutral", "empathetic"}
    assert len(result.topics) >= 1
    db.close()

"""Tests for CharacterStateService."""
import uuid
from app.services.character_state import CharacterStateService
from app.database import SessionLocal, Base, engine
import app.models.db
import app.models.db_session


def _db():
    Base.metadata.create_all(bind=engine)
    return SessionLocal()


def test_get_or_create_and_record_message():
    db = _db()
    svc = CharacterStateService()
    uid = f"user_cs_{uuid.uuid4().hex[:8]}"
    state = svc.get_or_create(db, uid, "epsilon")
    assert state.user_id == uid
    assert state.total_conversations >= 0
    assert state.familiarity_phase == "new"

    state = svc.mark_conversation_start(db, uid, "epsilon")
    assert state.total_conversations >= 1

    updated = svc.record_message(db, uid, "epsilon")
    assert updated.total_messages >= 1
    db.close()


def test_apply_deep_signals_merges_preferences():
    db = _db()
    svc = CharacterStateService()
    uid = f"user_cs_{uuid.uuid4().hex[:8]}"
    state = svc.get_or_create(db, uid, "epsilon")
    state = svc.apply_deep_signals(
        db,
        state,
        preferences={"explanation_style": "detailed"},
        observation="user prefers concrete examples",
    )
    assert state.preferences.get("explanation_style") == "detailed"
    assert "user prefers concrete examples" in state.observations
    db.close()


def test_set_last_summary():
    db = _db()
    svc = CharacterStateService()
    uid = f"user_cs_{uuid.uuid4().hex[:8]}"
    svc.get_or_create(db, uid, "epsilon")
    state = svc.set_last_summary(db, uid, "epsilon", "sum_abc")
    assert state.last_summary_id == "sum_abc"
    db.close()

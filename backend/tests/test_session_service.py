"""Tests for SessionService."""
import pytest
from app.services.session_service import SessionService


@pytest.fixture
def svc():
    return SessionService()


def test_get_or_create_creates_new_session(svc):
    session = svc.get_or_create("conv1", "user1", "epsilon")
    assert session.conversation_id == "conv1"
    assert session.user_id == "user1"
    assert session.character_id == "epsilon"
    assert session.message_count == 0


def test_get_or_create_returns_existing(svc):
    s1 = svc.get_or_create("conv1", "user1", "epsilon")
    s2 = svc.get_or_create("conv1", "user1", "epsilon")
    assert s1.started_at == s2.started_at


def test_record_message_increments_count(svc):
    svc.get_or_create("conv1", "user1", "epsilon")
    svc.record_message("conv1")
    svc.record_message("conv1")
    session = svc.get_session("conv1")
    assert session.message_count == 2


def test_record_message_unknown_session_is_safe(svc):
    svc.record_message("nonexistent")


def test_update_topics(svc):
    svc.get_or_create("conv1", "user1", "epsilon")
    svc.update_topics("conv1", ["python", "architecture"])
    session = svc.get_session("conv1")
    assert "python" in session.topics_this_session
    assert "architecture" in session.topics_this_session


def test_update_topics_deduplicates(svc):
    svc.get_or_create("conv1", "user1", "epsilon")
    svc.update_topics("conv1", ["python"])
    svc.update_topics("conv1", ["python", "rust"])
    session = svc.get_session("conv1")
    assert session.topics_this_session.count("python") == 1


def test_set_rolling_summary(svc):
    svc.get_or_create("conv1", "user1", "epsilon")
    svc.set_rolling_summary("conv1", "Discussed architecture design.")
    session = svc.get_session("conv1")
    assert session.rolling_summary == "Discussed architecture design."


def test_remove_session(svc):
    svc.get_or_create("conv1", "user1", "epsilon")
    removed = svc.remove_session("conv1")
    assert removed is not None
    assert svc.get_session("conv1") is None


def test_get_stale_sessions(svc):
    svc.get_or_create("conv1", "user1", "epsilon")
    stale = svc.get_stale_sessions(max_idle_seconds=-1)
    assert len(stale) == 1
    assert stale[0] == "conv1"

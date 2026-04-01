"""Tests for ContextBuilder."""
import pytest

from app.models.chat import Message
from app.services.context_builder import ContextBuilder
from app.services.session_service import SessionService
from app.services.token_counter import TokenCounter


@pytest.fixture
def counter():
    return TokenCounter(provider="openai", model="gpt-4o")


@pytest.fixture
def session_svc():
    return SessionService()


@pytest.fixture
def builder(counter, session_svc):
    return ContextBuilder(
        token_counter=counter,
        session_service=session_svc,
        max_tokens=1000,
        output_reserved=200,
        character_prompt_ceiling=150,
        memory_ceiling=100,
        summary_ceiling=80,
    )


def _make_history(n: int) -> list[Message]:
    msgs = []
    for i in range(n):
        role = "user" if i % 2 == 0 else "assistant"
        msgs.append(Message(role=role, content=f"Message number {i}"))
    return msgs


@pytest.mark.asyncio
async def test_build_includes_system_prompt(builder):
    result = await builder.build(
        user_message="Hello",
        conversation_id="conv1",
        user_id="user1",
        character_id="epsilon",
        raw_history=[],
        system_prompt="You are Epsilon.",
    )
    assert result.messages[0]["role"] == "system"
    assert "Epsilon" in result.messages[0]["content"]
    assert result.messages[-1]["role"] == "user"
    assert result.messages[-1]["content"] == "Hello"


@pytest.mark.asyncio
async def test_build_includes_history(builder):
    history = _make_history(4)
    result = await builder.build(
        user_message="New message",
        conversation_id="conv1",
        user_id="user1",
        character_id="epsilon",
        raw_history=history,
        system_prompt="System prompt.",
    )
    assert result.metadata.messages_included >= 1
    assert result.messages[-1]["content"] == "New message"


@pytest.mark.asyncio
async def test_build_truncates_long_history(builder):
    history = _make_history(100)
    result = await builder.build(
        user_message="Latest",
        conversation_id="conv1",
        user_id="user1",
        character_id="epsilon",
        raw_history=history,
        system_prompt="Short prompt.",
    )
    assert result.metadata.messages_excluded > 0
    assert result.metadata.messages_included < 100


@pytest.mark.asyncio
async def test_build_includes_memory_context(builder):
    result = await builder.build(
        user_message="Tell me about my project",
        conversation_id="conv1",
        user_id="user1",
        character_id="epsilon",
        raw_history=[],
        system_prompt="Base prompt.",
        memory_context="User is working on Epsilon project.",
    )
    system_content = result.messages[0]["content"]
    assert "Epsilon project" in system_content


@pytest.mark.asyncio
async def test_build_metadata_has_token_counts(builder):
    result = await builder.build(
        user_message="Hello",
        conversation_id="conv1",
        user_id="user1",
        character_id="epsilon",
        raw_history=_make_history(4),
        system_prompt="You are Epsilon.",
    )
    assert result.metadata.total_tokens > 0
    assert result.metadata.character_prompt_tokens > 0

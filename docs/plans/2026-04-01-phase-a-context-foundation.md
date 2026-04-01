# Phase A: Context Foundation - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Long conversations stay coherent and character maintains consistency across 50+ turns through token-budgeted context assembly and rolling summarization.

**Architecture:** Insert a ContextBuilder between chat.py and llm_service that assembles an optimized messages list within a token budget. Add a Summarizer that compresses old messages into structured summaries. Add a SessionService that tracks runtime conversation state in memory.

**Tech Stack:** Python 3.8+, FastAPI, SQLAlchemy, tiktoken (new dependency), existing LangChain + OpenAI/Gemini integration.

**Spec Reference:** `docs/specs/2026-04-01-character-centric-architecture-design.md` sections 4.1, 4.2, 4.4, 5.1, 5.3

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `backend/app/models/session.py` | Pydantic models: BuiltContext, ContextMetadata, ConversationSummary, ActiveSession, ProcessedResponse |
| `backend/app/models/db_session.py` | SQLAlchemy ORM models: ConversationSummaryDB table |
| `backend/app/services/token_counter.py` | Token counting abstraction (tiktoken for OpenAI, char-based for Gemini) |
| `backend/app/services/session_service.py` | In-memory active session state management |
| `backend/app/services/summarizer.py` | LLM-based conversation summarization (rolling + end-of-session) |
| `backend/app/services/context_builder.py` | Token-budgeted context assembly for LLM calls |
| `backend/tests/test_token_counter.py` | Tests for token counting |
| `backend/tests/test_session_service.py` | Tests for session management |
| `backend/tests/test_context_builder.py` | Tests for context assembly |

### Modified Files
| File | Change |
|------|--------|
| `backend/requirements.txt` | Add tiktoken, pytest, pytest-asyncio dependencies |
| `backend/app/main.py` | Import new ORM model before table creation |
| `backend/app/api/chat.py` | Replace raw history pass-through with ContextBuilder |
| `backend/app/services/llm_service.py` | Add `astream_from_messages()` method |
| `backend/app/config.py` | Add context budget configuration fields |

### Unchanged Files
All other files remain untouched: `memory_service.py`, `tts_service.py`, `character_service.py`, `history_service.py`, `database.py`, all frontend code, all other API routes.

---

## Task 1: Add tiktoken Dependency

**Files:**
- Modify: `backend/requirements.txt`

- [ ] **Step 1: Add tiktoken to requirements**

Add to end of `backend/requirements.txt`:
```
tiktoken>=0.5.0
pytest>=7.0.0
pytest-asyncio>=0.23.0
```

- [ ] **Step 2: Install the dependencies**

Run:
```powershell
cd backend
pip install "tiktoken>=0.5.0" "pytest>=7.0.0" "pytest-asyncio>=0.23.0"
```
Expected: Successful installation, no errors.

- [ ] **Step 3: Create pytest configuration**

Create `backend/pyproject.toml` (or append if exists):
```toml
[tool.pytest.ini_options]
asyncio_mode = "auto"
```

- [ ] **Step 4: Commit**

```powershell
git add requirements.txt pyproject.toml
git commit -m "feat: add tiktoken, pytest, pytest-asyncio dependencies"
```

---

## Task 2: Create Pydantic Data Models

**Files:**
- Create: `backend/app/models/session.py`

- [ ] **Step 1: Create the models file**

Create `backend/app/models/session.py`:

```python
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
```

- [ ] **Step 2: Verify the module imports correctly**

Run:
```powershell
cd backend
python -c "from app.models.session import BuiltContext, ContextMetadata, ConversationSummaryData, ActiveSession, ProcessedResponse; print('OK')"
```
Expected: `OK`

- [ ] **Step 3: Commit**

```powershell
git add app/models/session.py
git commit -m "feat: add Pydantic models for context building and session management"
```

---

## Task 3: Create SQLAlchemy ORM Model and Table

**Files:**
- Create: `backend/app/models/db_session.py`
- Modify: `backend/app/database.py`

- [ ] **Step 1: Create the ORM model**

Create `backend/app/models/db_session.py`:

```python
"""
SQLAlchemy ORM models for conversation summaries.
"""
from sqlalchemy import Column, String, DateTime, Text
from datetime import datetime
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
```

- [ ] **Step 2: Import in main.py so the table is auto-created at startup**

In `backend/app/main.py`, add the import inside the `lifespan` function, before `Base.metadata.create_all()`:

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    # Startup: Create DB tables
    logger.info("Initializing database tables...")
    import app.models.db_session  # noqa: F401 - ensure summary table is registered
    Base.metadata.create_all(bind=engine)
```

Note: Do NOT modify `database.py` — adding model imports there would create a circular dependency (database.py -> db_session.py -> database.py).

- [ ] **Step 3: Verify table creation**

Run:
```powershell
cd backend
python -c "
from app.database import engine, Base
import app.models.db
import app.models.db_session
Base.metadata.create_all(bind=engine)
from sqlalchemy import inspect
inspector = inspect(engine)
tables = inspector.get_table_names()
assert 'conversation_summaries' in tables, f'Table not found. Tables: {tables}'
print(f'OK - tables: {tables}')
"
```
Expected: `OK - tables: ['conversations', 'conversation_summaries', 'messages']`

- [ ] **Step 4: Commit**

```powershell
git add app/models/db_session.py app/main.py
git commit -m "feat: add conversation_summaries SQLite table"
```

---

## Task 4: Create Token Counter

**Files:**
- Create: `backend/app/services/token_counter.py`
- Create: `backend/tests/test_token_counter.py`

- [ ] **Step 1: Write the test file**

Create `backend/tests/test_token_counter.py`:

```python
"""Tests for token counting abstraction."""
import pytest
from app.services.token_counter import TokenCounter


def test_openai_counter_counts_english():
    counter = TokenCounter(provider="openai", model="gpt-4o")
    text = "Hello, how are you today?"
    count = counter.count_text(text)
    assert 4 <= count <= 8, f"Expected 4-8 tokens for English sentence, got {count}"


def test_openai_counter_counts_chinese():
    counter = TokenCounter(provider="openai", model="gpt-4o")
    text = "你好，今天过得怎么样？"
    count = counter.count_text(text)
    assert count > 0, "Chinese text should have positive token count"


def test_openai_counter_counts_messages():
    counter = TokenCounter(provider="openai", model="gpt-4o")
    messages = [
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Hello!"},
    ]
    count = counter.count_messages(messages)
    assert count > 10, f"Expected >10 tokens for 2-message conversation, got {count}"


def test_gemini_counter_approximates():
    counter = TokenCounter(provider="gemini", model="gemini-2.5-flash")
    text = "Hello world"
    count = counter.count_text(text)
    assert count > 0, "Gemini counter should return positive count"


def test_gemini_counter_chinese():
    counter = TokenCounter(provider="gemini", model="gemini-2.5-flash")
    text = "你好世界"
    count = counter.count_text(text)
    assert count >= 2, "4 CJK chars should be at least 2 tokens"


def test_empty_text_returns_zero():
    counter = TokenCounter(provider="openai", model="gpt-4o")
    assert counter.count_text("") == 0


def test_unknown_provider_falls_back():
    counter = TokenCounter(provider="unknown", model="some-model")
    count = counter.count_text("Hello world test")
    assert count > 0, "Unknown provider should fall back to char-based counting"
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```powershell
cd backend
python -m pytest tests/test_token_counter.py -v
```
Expected: FAIL - `ModuleNotFoundError: No module named 'app.services.token_counter'`

- [ ] **Step 3: Write the implementation**

Create `backend/app/services/token_counter.py`:

```python
"""
Token counting abstraction.
Uses tiktoken for OpenAI models, character-based approximation for others.
"""
import logging
from typing import Optional

logger = logging.getLogger(__name__)

_tiktoken_cache: dict = {}


def _get_tiktoken_encoding(model: str):
    """Get or create a cached tiktoken encoding for the given model."""
    if model not in _tiktoken_cache:
        try:
            import tiktoken
            try:
                _tiktoken_cache[model] = tiktoken.encoding_for_model(model)
            except KeyError:
                _tiktoken_cache[model] = tiktoken.get_encoding("cl100k_base")
        except ImportError:
            logger.warning("tiktoken not installed, falling back to char-based counting")
            return None
    return _tiktoken_cache[model]


class TokenCounter:
    """
    Counts tokens for different LLM providers.
    - OpenAI: uses tiktoken (accurate)
    - Gemini/others: character-based approximation (~2 CJK chars or ~4 Latin chars per token)
    """

    OVERHEAD_PER_MESSAGE = 4
    OVERHEAD_BASE = 3

    def __init__(self, provider: str = "openai", model: str = "gpt-4o"):
        self.provider = provider.lower()
        self.model = model
        self._encoding = None
        if self.provider == "openai":
            self._encoding = _get_tiktoken_encoding(model)

    def count_text(self, text: str) -> int:
        """Count tokens in a plain text string."""
        if not text:
            return 0

        if self._encoding is not None:
            return len(self._encoding.encode(text))

        return self._char_based_count(text)

    def count_messages(self, messages: list[dict]) -> int:
        """
        Count tokens in a list of chat messages.
        Accounts for per-message overhead (role tokens, separators).
        """
        total = self.OVERHEAD_BASE
        for msg in messages:
            total += self.OVERHEAD_PER_MESSAGE
            total += self.count_text(msg.get("role", ""))
            total += self.count_text(msg.get("content", ""))
        return total

    @staticmethod
    def _char_based_count(text: str) -> int:
        """
        Approximate token count using character heuristics.
        CJK characters: ~1 token per 2 chars.
        Latin characters: ~1 token per 4 chars.
        """
        cjk_count = 0
        latin_count = 0
        for ch in text:
            cp = ord(ch)
            if (0x4E00 <= cp <= 0x9FFF or 0x3400 <= cp <= 0x4DBF
                    or 0xF900 <= cp <= 0xFAFF or 0x3000 <= cp <= 0x303F
                    or 0x3040 <= cp <= 0x309F or 0x30A0 <= cp <= 0x30FF
                    or 0xAC00 <= cp <= 0xD7AF):
                cjk_count += 1
            else:
                latin_count += 1

        return max(1, (cjk_count + 1) // 2 + (latin_count + 3) // 4) if text else 0
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```powershell
cd backend
python -m pytest tests/test_token_counter.py -v
```
Expected: All 7 tests PASS.

- [ ] **Step 5: Commit**

```powershell
git add app/services/token_counter.py tests/test_token_counter.py
git commit -m "feat: add token counting abstraction with tiktoken and char-based fallback"
```

---

## Task 5: Create SessionService

**Files:**
- Create: `backend/app/services/session_service.py`
- Create: `backend/tests/test_session_service.py`

- [ ] **Step 1: Write the test file**

Create `backend/tests/test_session_service.py`:

```python
"""Tests for SessionService."""
import pytest
import time
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
    stale = svc.get_stale_sessions(max_idle_seconds=0)
    assert len(stale) == 1
    assert stale[0] == "conv1"
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```powershell
cd backend
python -m pytest tests/test_session_service.py -v
```
Expected: FAIL - `ModuleNotFoundError`

- [ ] **Step 3: Write the implementation**

Create `backend/app/services/session_service.py`:

```python
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```powershell
cd backend
python -m pytest tests/test_session_service.py -v
```
Expected: All 10 tests PASS.

- [ ] **Step 5: Commit**

```powershell
git add app/services/session_service.py tests/test_session_service.py
git commit -m "feat: add in-memory SessionService for active conversation state"
```

---

## Task 6: Create Summarizer

**Files:**
- Create: `backend/app/services/summarizer.py`

- [ ] **Step 1: Create the summarizer**

Create `backend/app/services/summarizer.py`:

```python
"""
Conversation summarization service.
Generates structured summaries via LLM for use by ContextBuilder.
Supports two modes: rolling in-session and end-of-session.
"""
import json
import logging
import re
import uuid
from datetime import datetime
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
        """
        Check if rolling summarization is needed and perform it.

        Args:
            messages: current conversation messages (user/assistant dicts)
            existing_summary: previously generated rolling summary, if any

        Returns:
            (new_rolling_summary_or_None, remaining_messages_to_keep)
            If no summarization needed, returns (existing_summary, messages).
        """
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
            logger.info(f"Rolling summary generated: {len(summary)} chars, kept {len(recent_messages)} messages")
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
        """
        Generate a structured end-of-session summary and optionally persist it.

        Args:
            conversation_id: the conversation being summarized
            user_id: user identifier
            character_id: character identifier
            messages: full conversation messages
            db: SQLAlchemy session for persistence (optional)

        Returns:
            ConversationSummaryData or None if summarization fails.
        """
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
```

- [ ] **Step 2: Verify the module imports**

Run:
```powershell
cd backend
python -c "from app.services.summarizer import Summarizer, summarizer; print('OK')"
```
Expected: `OK`

- [ ] **Step 3: Commit**

```powershell
git add app/services/summarizer.py
git commit -m "feat: add Summarizer service for rolling and end-of-session conversation compression"
```

---

## Task 7: Add Config Fields for Context Budget

**Files:**
- Modify: `backend/app/config.py`

- [ ] **Step 1: Add configuration fields**

Add the following fields to the `Settings` class in `backend/app/config.py`, after the memory config section:

```python
    # Context Builder Configuration (Phase A)
    context_max_tokens: int = 16000           # Model context window size (conservative default for gpt-3.5-turbo; set higher for gpt-4o/gemini)
    context_output_reserved: int = 4000       # Tokens reserved for LLM output
    context_character_prompt_ceiling: int = 2000  # Max tokens for character prompt + state
    context_memory_ceiling: int = 1000        # Max tokens for memory context
    context_summary_ceiling: int = 500        # Max tokens for session summary
    context_rolling_threshold: int = 16       # Message count before rolling summarization
```

- [ ] **Step 2: Verify config loads**

Run:
```powershell
cd backend
python -c "from app.config import settings; print(f'max_tokens={settings.context_max_tokens}, threshold={settings.context_rolling_threshold}')"
```
Expected: `max_tokens=128000, threshold=16`

- [ ] **Step 3: Commit**

```powershell
git add app/config.py
git commit -m "feat: add context builder configuration fields"
```

---

## Task 8: Create ContextBuilder

**Files:**
- Create: `backend/app/services/context_builder.py`
- Create: `backend/tests/test_context_builder.py`

- [ ] **Step 1: Write the test file**

Create `backend/tests/test_context_builder.py`:

```python
"""Tests for ContextBuilder."""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from app.services.context_builder import ContextBuilder
from app.services.token_counter import TokenCounter
from app.services.session_service import SessionService
from app.models.chat import Message


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
async def test_build_includes_system_prompt(builder, session_svc):
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
async def test_build_includes_history(builder, session_svc):
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
async def test_build_truncates_long_history(builder, session_svc):
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
async def test_build_includes_memory_context(builder, session_svc):
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
async def test_build_metadata_has_token_counts(builder, session_svc):
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```powershell
cd backend
python -m pytest tests/test_context_builder.py -v
```
Expected: FAIL - `ModuleNotFoundError`

- [ ] **Step 3: Write the implementation**

Create `backend/app/services/context_builder.py`:

```python
"""
Token-budgeted context assembly for LLM calls.
Assembles system prompt + memory + history within a configurable token budget.
"""
import logging
from typing import Optional

from app.models.session import BuiltContext, ContextMetadata
from app.models.chat import Message
from app.services.token_counter import TokenCounter
from app.services.session_service import SessionService

logger = logging.getLogger(__name__)


class ContextBuilder:
    """
    Assembles an optimized messages list for the LLM, respecting token budgets.

    Priority order (highest first):
      1. Character prompt (+ optional state injection, memory context)
      2. Current user message
      3. Recent history messages (newest first, fill remaining budget)
    """

    def __init__(
        self,
        token_counter: TokenCounter,
        session_service: SessionService,
        max_tokens: int = 128000,
        output_reserved: int = 4000,
        character_prompt_ceiling: int = 2000,
        memory_ceiling: int = 1000,
        summary_ceiling: int = 500,
    ):
        self.counter = token_counter
        self.session_service = session_service
        self.max_tokens = max_tokens
        self.output_reserved = output_reserved
        self.character_prompt_ceiling = character_prompt_ceiling
        self.memory_ceiling = memory_ceiling
        self.summary_ceiling = summary_ceiling

    async def build(
        self,
        user_message: str,
        conversation_id: str,
        user_id: str,
        character_id: str,
        raw_history: list[Message],
        system_prompt: str = "",
        memory_context: Optional[str] = None,
    ) -> BuiltContext:
        """
        Build an optimized messages list within the token budget.

        Args:
            user_message: the current user input
            conversation_id: active conversation id
            user_id: user identifier
            character_id: character identifier
            raw_history: full conversation history from frontend
            system_prompt: base character system prompt
            memory_context: retrieved memory text (from memory_service)

        Returns:
            BuiltContext with messages list and metadata.
        """
        budget = self.max_tokens - self.output_reserved
        metadata = ContextMetadata()

        # --- 1. Assemble system prompt ---
        full_system, summary_tokens_used = self._assemble_system_prompt(
            system_prompt, memory_context, conversation_id
        )
        system_tokens = self.counter.count_text(full_system)

        if system_tokens > self.character_prompt_ceiling + self.memory_ceiling + self.summary_ceiling:
            full_system, summary_tokens_used = self._truncate_system_prompt(
                system_prompt, memory_context, conversation_id
            )
            system_tokens = self.counter.count_text(full_system)

        budget -= system_tokens
        metadata.character_prompt_tokens = self.counter.count_text(system_prompt)
        metadata.summary_tokens = summary_tokens_used
        if memory_context:
            metadata.memory_tokens = self.counter.count_text(memory_context)

        # --- 2. Reserve space for current user message ---
        user_msg_tokens = self.counter.count_text(user_message)
        budget -= user_msg_tokens
        budget -= self.counter.OVERHEAD_PER_MESSAGE

        # --- 3. Fill remaining budget with history (newest first) ---
        included_history = []
        history_tokens_total = 0

        reversed_history = list(reversed(raw_history))
        for msg in reversed_history:
            msg_tokens = (
                self.counter.count_text(msg.content)
                + self.counter.count_text(msg.role)
                + self.counter.OVERHEAD_PER_MESSAGE
            )
            if history_tokens_total + msg_tokens > budget:
                break
            included_history.insert(0, msg)
            history_tokens_total += msg_tokens

        metadata.history_tokens = history_tokens_total
        metadata.messages_included = len(included_history)
        metadata.messages_excluded = len(raw_history) - len(included_history)

        # --- 4. Build final messages list ---
        messages = []

        messages.append({"role": "system", "content": full_system})

        for msg in included_history:
            role = "user" if msg.role == "user" else "assistant"
            messages.append({"role": role, "content": msg.content})

        messages.append({"role": "user", "content": user_message})

        metadata.total_tokens = self.counter.count_messages(messages)

        # --- 5. Update session state ---
        self.session_service.get_or_create(conversation_id, user_id, character_id)
        self.session_service.record_message(conversation_id)

        logger.info(
            f"Context built: {metadata.total_tokens} tokens, "
            f"{metadata.messages_included} msgs included, "
            f"{metadata.messages_excluded} excluded"
        )

        return BuiltContext(messages=messages, metadata=metadata)

    def _assemble_system_prompt(
        self,
        base_prompt: str,
        memory_context: Optional[str],
        conversation_id: str,
    ) -> tuple[str, int]:
        """
        Combine base prompt, memory, and session summary into a single system prompt.
        Returns (assembled_prompt, summary_tokens_used).
        """
        parts = []
        summary_tokens_used = 0

        if base_prompt:
            parts.append(base_prompt)

        session = self.session_service.get_session(conversation_id)
        if session and session.rolling_summary:
            summary_section = f"\n\n[Conversation so far: {session.rolling_summary}]"
            summary_tokens = self.counter.count_text(summary_section)
            if summary_tokens <= self.summary_ceiling:
                parts.append(summary_section)
                summary_tokens_used = summary_tokens

        if memory_context:
            memory_section = (
                f"\n\n[Relevant memory about this user]\n{memory_context}\n"
                "Weave this knowledge naturally into conversation. "
                "Do not explicitly say 'I remember that...'."
            )
            mem_tokens = self.counter.count_text(memory_section)
            if mem_tokens <= self.memory_ceiling:
                parts.append(memory_section)
            else:
                truncated = memory_context[: self.memory_ceiling * 3]
                parts.append(
                    f"\n\n[Relevant memory about this user]\n{truncated}\n"
                    "Weave this knowledge naturally into conversation."
                )

        return "\n".join(parts), summary_tokens_used

    def _truncate_system_prompt(
        self,
        base_prompt: str,
        memory_context: Optional[str],
        conversation_id: str,
    ) -> tuple[str, int]:
        """Fallback: if combined system prompt is too large, keep only the base prompt."""
        logger.warning("System prompt exceeded ceiling, truncating to base prompt only")
        return base_prompt, 0
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```powershell
cd backend
python -m pytest tests/test_context_builder.py -v
```
Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```powershell
git add app/services/context_builder.py tests/test_context_builder.py
git commit -m "feat: add ContextBuilder with token-budgeted context assembly"
```

---

## Task 9: Integrate ContextBuilder into chat.py

**Files:**
- Modify: `backend/app/api/chat.py`

This is the critical integration task. We replace the raw history pass-through with ContextBuilder while preserving all existing behavior (SSE streaming, TTS, memory writeback).

- [ ] **Step 1: Read current chat.py to confirm the exact code to replace**

The current `generate_chat_stream` function calls `llm_service.stream_chat()` directly with raw inputs. We need to insert ContextBuilder before that call.

- [ ] **Step 2: Modify chat.py**

Replace the full content of `backend/app/api/chat.py` with:

```python
"""
Chat API endpoints
Handles chat requests with streaming response
"""
import base64
import json
import logging
import uuid
import asyncio
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from app.models.chat import ChatRequest
from app.services.llm_service import llm_service
from app.services.tts_service import tts_service
from app.services.character_service import character_service
from app.services.memory_service import get_memory_service
from app.services.history_service import history_service
from app.services.context_builder import ContextBuilder
from app.services.session_service import SessionService
from app.services.summarizer import summarizer
from app.services.token_counter import TokenCounter
from app.config import settings
from app.database import get_db

logger = logging.getLogger(__name__)

router = APIRouter()

_session_service = SessionService()
_token_counter = TokenCounter(
    provider=settings.llm_provider,
    model=settings.openai_model,
)
_context_builder = ContextBuilder(
    token_counter=_token_counter,
    session_service=_session_service,
    max_tokens=settings.context_max_tokens,
    output_reserved=settings.context_output_reserved,
    character_prompt_ceiling=settings.context_character_prompt_ceiling,
    memory_ceiling=settings.context_memory_ceiling,
    summary_ceiling=settings.context_summary_ceiling,
)


async def generate_chat_stream(request: ChatRequest, db: Session):
    """
    Generate streaming chat response via SSE.
    Streams text chunks first, then audio chunks (base64-encoded).
    Integrated with memory system for context retrieval and storage.
    """
    full_text = ""

    user_id = request.user_id or "default_user"
    conversation_id = request.conversation_id or f"conv_{uuid.uuid4().hex[:8]}"

    try:
        history_service.create_conversation(db, user_id=user_id, conversation_id=conversation_id)
        history_service.add_message(db, conversation_id=conversation_id, role="user", content=request.message)
    except Exception as e:
        logger.error(f"Failed to persist user message: {str(e)}")

    try:
        current_character = character_service.get_current_character()
        system_prompt = current_character.system_prompt
        character_id = current_character.id if hasattr(current_character, 'id') else "epsilon"

        # Query memory context if memory service is available
        memory_context = ""
        memory_service = get_memory_service()
        if memory_service and user_id:
            try:
                memory_context = await memory_service.query_related_context(
                    user_id=user_id,
                    query_text=request.message,
                    limit=10
                )
                if memory_context:
                    logger.info(f"Retrieved memory context for user {user_id}: {len(memory_context)} chars")
            except Exception as e:
                logger.warning(f"Failed to query memory context: {str(e)}")

        # Build optimized context via ContextBuilder
        built = await _context_builder.build(
            user_message=request.message,
            conversation_id=conversation_id,
            user_id=user_id,
            character_id=character_id,
            raw_history=request.history,
            system_prompt=system_prompt,
            memory_context=memory_context if memory_context else None,
        )

        logger.info(
            f"Context: {built.metadata.total_tokens} tokens, "
            f"{built.metadata.messages_included} msgs included, "
            f"{built.metadata.messages_excluded} excluded"
        )

        # Check if rolling summarization is needed
        session = _session_service.get_session(conversation_id)
        if session and session.message_count > 0 and session.message_count % settings.context_rolling_threshold == 0:
            history_dicts = [{"role": m.role, "content": m.content} for m in request.history]
            new_summary, _ = await summarizer.maybe_rolling_summarize(
                messages=history_dicts,
                existing_summary=session.rolling_summary,
            )
            if new_summary != session.rolling_summary:
                _session_service.set_rolling_summary(conversation_id, new_summary)
                logger.info(f"Rolling summary updated for {conversation_id}")

        # Stream LLM response using pre-built context
        async for chunk in llm_service.astream_from_messages(built.messages):
            full_text += chunk
            yield f"data: {json.dumps({'type': 'text', 'content': chunk}, ensure_ascii=False)}\n\n"

        yield f"data: {json.dumps({'type': 'complete', 'text': full_text}, ensure_ascii=False)}\n\n"

        try:
            history_service.add_message(db, conversation_id=conversation_id, role="assistant", content=full_text)
        except Exception as e:
            logger.error(f"Failed to persist assistant message: {str(e)}")

        # Stream audio via GPT-SoVITS
        try:
            yield f"data: {json.dumps({'type': 'audio_start'}, ensure_ascii=False)}\n\n"

            chunk_index = 0
            async for audio_chunk in tts_service.stream_text_to_speech(
                text=full_text,
                text_lang=request.config.text_lang,
                ref_audio_path=request.config.ref_audio_path,
                prompt_text=request.config.prompt_text,
                prompt_lang=request.config.prompt_lang,
                streaming_mode=request.config.streaming_mode,
                media_type=request.config.media_type,
                text_split_method=request.config.text_split_method,
                top_k=request.config.top_k,
                top_p=request.config.top_p,
                temperature=request.config.temperature,
                speed_factor=request.config.speed_factor,
                fragment_interval=request.config.fragment_interval,
                aux_ref_audio_paths=request.config.aux_ref_audio_paths
            ):
                audio_chunk_base64 = base64.b64encode(audio_chunk).decode("utf-8")
                yield f"data: {json.dumps({'type': 'audio_chunk', 'data': audio_chunk_base64, 'index': chunk_index, 'size': len(audio_chunk)}, ensure_ascii=False)}\n\n"
                chunk_index += 1

            yield f"data: {json.dumps({'type': 'audio_complete', 'total_chunks': chunk_index}, ensure_ascii=False)}\n\n"

        except Exception as e:
            logger.error(f"TTS streaming error: {str(e)}")
            yield f"data: {json.dumps({'type': 'error', 'error': f'TTS failed: {str(e)}'}, ensure_ascii=False)}\n\n"

        # Write conversation to memory (async, non-blocking)
        if memory_service and user_id and full_text:
            messages_for_memory = [
                {"role": "user", "content": request.message},
                {"role": "assistant", "content": full_text}
            ]

            async def write_memory_task():
                try:
                    await memory_service.write_conversation(
                        user_id=user_id,
                        conversation_id=conversation_id,
                        messages=messages_for_memory,
                        character_id=character_id
                    )
                except Exception as e:
                    logger.warning(f"Failed to write memory: {str(e)}")

            asyncio.create_task(write_memory_task())

    except Exception as e:
        logger.error(f"Chat stream error: {str(e)}")
        yield f"data: {json.dumps({'type': 'error', 'error': f'Error: {str(e)}'}, ensure_ascii=False)}\n\n"


@router.post("/chat")
async def chat(request: ChatRequest, db: Session = Depends(get_db)):
    """
    Chat endpoint with streaming response.
    Returns Server-Sent Events stream with text, audio, and status events.
    """
    if not request.message or not request.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    if not request.config.ref_audio_path:
        raise HTTPException(status_code=400, detail="Reference audio path required")

    if request.config.text_lang not in ["zh", "en", "ja", "ko", "yue"]:
        raise HTTPException(status_code=400, detail="Unsupported language")

    if request.config.streaming_mode not in [0, 1, 2, 3]:
        raise HTTPException(status_code=400, detail="streaming_mode must be 0/1/2/3")

    if request.config.media_type not in ["wav", "raw", "ogg", "aac", "fmp4"]:
        raise HTTPException(status_code=400, detail="Unsupported media_type")

    return StreamingResponse(
        generate_chat_stream(request, db),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )
```

- [ ] **Step 3: Add `astream_from_messages` method to llm_service**

The new chat.py calls `llm_service.astream_from_messages(messages)` which takes a pre-built messages list instead of raw inputs. Add this method to `backend/app/services/llm_service.py`, right after the existing `stream_chat` method:

```python
    async def astream_from_messages(
        self,
        messages: list[dict],
    ) -> AsyncIterator[str]:
        """
        Stream chat response from a pre-assembled messages list.
        Used by ContextBuilder integration - context is already optimized.

        Args:
            messages: Pre-built messages list (system + history + user)

        Yields:
            Text chunks as they are generated
        """
        if not self._initialized:
            self._initialize_llm()

        try:
            async for chunk in self.llm.astream(messages):
                if hasattr(chunk, 'content'):
                    content = chunk.content
                    if content:
                        yield content
                elif isinstance(chunk, str):
                    yield chunk
                elif hasattr(chunk, 'text'):
                    yield chunk.text

        except Exception as e:
            logger.error(f"Error in astream_from_messages: {str(e)}")
            yield f"Error generating response: {str(e)}"
```

- [ ] **Step 4: Verify the server starts without errors**

Run:
```powershell
cd backend
python -c "from app.api.chat import router; print('chat.py imports OK')"
```
Expected: `chat.py imports OK`

- [ ] **Step 5: Commit**

```powershell
git add app/api/chat.py app/services/llm_service.py
git commit -m "feat: integrate ContextBuilder into chat pipeline, add astream_from_messages to LLMService"
```

---

## Task 10: Final Integration Verification

- [ ] **Step 1: Run all tests**

```powershell
cd backend
python -m pytest tests/ -v
```
Expected: All tests pass.

- [ ] **Step 2: Verify full import chain**

```powershell
cd backend
python -c "
from app.api.chat import router, _context_builder, _session_service
from app.services.context_builder import ContextBuilder
from app.services.session_service import SessionService
from app.services.summarizer import summarizer
from app.services.token_counter import TokenCounter
from app.models.session import BuiltContext, ContextMetadata, ActiveSession, ConversationSummaryData
from app.models.db_session import ConversationSummaryDB
print('All imports successful')
print(f'ContextBuilder: {type(_context_builder).__name__}')
print(f'SessionService: {type(_session_service).__name__}')
"
```
Expected: All imports successful with correct type names.

- [ ] **Step 3: Verify database tables exist**

```powershell
cd backend
python -c "
from app.database import engine, Base
import app.models.db
import app.models.db_session
Base.metadata.create_all(bind=engine)
from sqlalchemy import inspect
tables = sorted(inspect(engine).get_table_names())
print(f'Tables: {tables}')
assert 'conversation_summaries' in tables
print('OK')
"
```
Expected: Tables include `conversation_summaries`, prints `OK`.

- [ ] **Step 4: Final commit with all changes**

```powershell
git add -A
git status
git commit -m "feat: complete Phase A context foundation - token budgeting, session management, summarization"
```

---

## Post-Implementation Notes

### What Changed (Summary)
- **New dependencies:** tiktoken, pytest, pytest-asyncio
- **New modules:** token_counter, session_service, summarizer, context_builder, plus data models
- **Modified chat.py:** Now routes through ContextBuilder before calling LLM. Memory writeback logic preserved as-is.
- **Modified llm_service.py:** Added `astream_from_messages()` method. All existing methods unchanged.
- **Modified main.py:** Import db_session model before table creation.
- **Modified config.py:** Added `context_*` settings for token budget tuning.
- **New SQLite table:** `conversation_summaries` for persisting end-of-session summaries

### What Did NOT Change
- `llm_service.py` existing methods (`stream_chat`, `chat`) still work for non-chat callers (e.g. memory extraction)
- `memory_service.py` completely unchanged
- `tts_service.py` completely unchanged
- `character_service.py` completely unchanged
- `database.py` completely unchanged
- All frontend code unchanged
- All other API routes unchanged

### Ready for Phase B
Phase B (Character State + ResponseProcessor) will:
1. Create `character_state.py` and its SQLite table
2. Create `response_processor.py` that runs after LLM output
3. Enhance ContextBuilder to inject character state into system prompts
4. Enhance memory_service with relational memory types
5. Add end-of-session summary generation on session cleanup

# Epsilon Character-Centric Architecture Design

Version: 1.0
Date: 2026-04-01
Status: Draft

---

## 1. Design Philosophy

Epsilon is a virtual character dialogue system. The architecture must serve one core goal:
**make the character feel like a real person who remembers you and grows closer over time.**

Key principles:

- **Relationship is felt, not measured.** No affinity meters, no stats panels. The user experiences growth through subtle shifts in dialogue style, natural references to shared history, and adaptive behavior.
- **Evolutionary, not revolutionary.** Build on the existing FastAPI + React + Neo4j codebase. Do not rewrite what already works.
- **Every module must answer: "How does this make the character feel more alive?"** If a module cannot answer this, it does not belong in this phase.
- **Character state is internal machinery.** The user never sees the tracking data. They only see its effects in conversation quality.

---

## 2. Current System Shortcomings (Character Experience Perspective)

### S1: Long conversation degradation
`llm_service._build_messages_from_history` passes all history messages to the LLM without compression. After ~20 turns, context window fills up, character loses coherence and setting consistency.

### S2: Memory is factual, not relational
`memory_service.extract_entities` captures Topic / Project / Skill entities. It does not capture how the character relates to the user emotionally, what conversational preferences the user has, or how past interactions felt.

### S3: Character has no persistent state
`character_service` swaps system prompt strings. The character has no memory of how many times it has spoken with this user, what their last conversation covered, or how their relationship has evolved.

### S4: No cross-session continuity
When a new conversation starts, the character has no awareness of previous conversations. No "last time we discussed..." or contextual pickup from where things left off.

### S5: Context assembly is unbudgeted
System prompt + memory context + history are concatenated without token budget management. When all three are large, they compete for space unpredictably.

---

## 3. Architecture Overview

### Request Flow (After Redesign)

```
[User Message]
      |
      v
  chat.py                          (API layer - thin, delegates to services)
      |
      v
  ContextBuilder                   (NEW - assembles optimized LLM input)
      |--- reads --> SessionService        (NEW - current session runtime state)
      |--- reads --> CharacterState        (NEW - persistent per-user character state)
      |--- reads --> MemoryService         (EXISTING - enhanced with relational memory)
      |--- reads --> Summarizer            (NEW - compressed conversation history)
      |
      |   Output: messages list within token budget
      |   [character_prompt | character_state_context | relational_memory | session_summary | recent_messages]
      |
      v
  LLMService                      (EXISTING - receives pre-assembled context, no changes)
      |
      v
  ResponseProcessor                (NEW - post-response signal extraction)
      |--- updates --> SessionService      (current turn state)
      |--- triggers --> CharacterState     (periodic relationship updates)
      |--- triggers --> MemoryService      (async memory writeback, moved from chat.py)
      |--- extracts --> emotion hints      (for future TTS/Live2D use)
      |
      +--> text output via SSE     (EXISTING)
      +--> TTS via tts_service     (EXISTING - emotion parameter added later in Phase C)
```

### What Changes vs. Current Flow

```
BEFORE:  chat.py -> llm_service(raw_history + prompt + memory) -> tts_service
AFTER:   chat.py -> context_builder -> llm_service(optimized_context) -> response_processor -> tts_service
```

Two new stages inserted. Not seven layers of abstraction.

---

## 4. Module Specifications

### 4.1 ContextBuilder (`services/context_builder.py`)

**Solves:** S1 (long conversation degradation), S5 (unbudgeted context)

**Responsibility:**
Accept raw inputs (user message, conversation_id, user_id, character_id) and assemble an optimized messages list for the LLM, respecting a token budget.

**Token Budget Strategy:**

```
Total available = model context window - output_reserved

Allocation priority (highest first):
  1. Character prompt + state injection     ceiling: 2000 tokens
  2. Current user message                   variable (pass through)
  3. Recent messages (newest first)         fill remaining space
  4. Relational memory (top-K relevant)     ceiling: 1000 tokens
  5. Session summary (if exists)            ceiling: 500 tokens

Output reserved: 4000 tokens

Messages older than the "recent" window are NOT included.
They are represented by the session summary instead.
```

**Interface:**

```python
class ContextBuilder:
    async def build(
        self,
        user_message: str,
        conversation_id: str,
        user_id: str,
        character_id: str,
        raw_history: list[Message],
    ) -> BuiltContext:
        """
        Returns BuiltContext containing:
          - messages: list[dict]       (ready for LLM)
          - metadata: ContextMetadata  (token counts, what was included/excluded)
        """
```

**Token Counting:**
Use tiktoken for OpenAI models. For Gemini, use character-based approximation (1 token ~ 2 CJK chars or ~4 Latin chars). The counter is injected, not hardcoded, so it can be swapped per provider.

**Key Design Decision:**
The character prompt is dynamically assembled, not a static string. ContextBuilder reads from CharacterState and injects relationship-aware instructions. For example:

- For a new user: base system prompt only
- For a familiar user: base prompt + "you know this user prefers concise answers" + "last time you discussed X"
- For a close user: base prompt + accumulated relationship context + natural reference cues

The injection is structured as natural-language instructions appended to the system prompt, NOT as a separate system message. This keeps the character voice unified.

---

### 4.2 Summarizer (`services/summarizer.py`)

**Solves:** S4 (no cross-session continuity), supports S1 (history compression)

**Responsibility:**
Generate structured summaries of conversations for use by ContextBuilder and CharacterState.

**Two Summarization Modes:**

**A. Rolling In-Session Summary:**
When the current session exceeds a message threshold (default: 16 messages), summarize the oldest half. The summary replaces those messages in context. This keeps the context window manageable during long conversations.

Trigger: message_count_in_session > threshold
Action: summarize oldest N/2 messages, store as session rolling summary
Frequency: checked every message, executed when threshold crossed

**B. End-of-Session Summary:**
When a session becomes inactive (no messages for 10 minutes) or is explicitly closed, generate a final structured summary and persist it.

**Summary Data Structure:**

```python
class ConversationSummary:
    id: str
    conversation_id: str
    user_id: str
    character_id: str
    created_at: datetime

    topics_discussed: list[str]
    key_facts_learned: list[str]
    emotional_tone: str                # e.g. "relaxed", "focused", "playful"
    unresolved_threads: list[str]      # things left mid-discussion
    relationship_observation: str      # how the interaction felt from character's perspective
    one_line_summary: str              # e.g. "discussed project architecture, user was enthusiastic"
```

**Storage:** SQLite, new table `conversation_summaries`.

**Summarization Prompt Strategy:**
The LLM call for summarization should be from the character's perspective ("you had this conversation with the user..."). This ensures the summary is usable as character memory, not just a neutral log.

---

### 4.3 CharacterState (`services/character_state.py`)

**Solves:** S3 (character has no persistent state)

**Responsibility:**
Maintain persistent state for each (user_id, character_id) pair. This state is never shown to the user. It influences the character's behavior through prompt injection.

**State Data Structure:**

```python
class CharacterStateRecord:
    user_id: str
    character_id: str
    created_at: datetime
    updated_at: datetime

    # Interaction history
    total_conversations: int
    total_messages: int
    first_interaction_at: datetime
    last_interaction_at: datetime
    last_summary_id: str | None        # reference to most recent ConversationSummary

    # Relationship quality (internal, never displayed)
    familiarity_phase: str             # "new" | "acquainted" | "familiar" | "close"
    
    # Learned user preferences (extracted by ResponseProcessor)
    preferences: dict                  # e.g. {"explanation_depth": "detailed", "tone": "casual_ok"}
    
    # Character's observations (free-form, used in prompt)
    observations: list[str]            # e.g. ["user gets excited about architecture topics",
                                       #        "user prefers not to be interrupted mid-thought"]
```

**Familiarity Phase Transitions:**

```
new         ->  acquainted    after 3 conversations
acquainted  ->  familiar      after 10 conversations
familiar    ->  close         after 25 conversations
```

These thresholds are configurable. The transitions are NOT communicated to the user explicitly. Instead, they control which prompt augmentation template is used:

- **new:** Character is polite, slightly formal. Does not assume knowledge of user. Does not reference past conversations (there are none).
- **acquainted:** Character starts using slightly warmer tone. May reference recent conversations naturally. Begins adapting to learned preferences.
- **familiar:** Character speaks more naturally. Actively references shared history. Adjusts explanation style to match preferences. May show personality quirks more freely.
- **close:** Character speaks as a trusted companion. References are woven in seamlessly. Style is fully adapted. Character may gently challenge or tease where appropriate to the persona.

**Prompt Augmentation Example (familiar phase):**

```
[Base system prompt from character_service]

[Injected by ContextBuilder based on CharacterState:]
You have spoken with this user 15 times before. You know them fairly well.
Things you have observed about this user:
- They get excited about architecture and system design topics
- They prefer detailed explanations with concrete examples
- They are working on a project called Epsilon
The last time you spoke, you discussed memory system architecture. The conversation ended on a positive note, with the user planning to implement the changes.
Continue naturally from this shared history. Do not explicitly state "I remember that..." - weave references in naturally, the way a real person would.
```

**Storage:** SQLite, new table `character_states`.

**Update Rules:**
- Lightweight updates (message count, timestamps): every message
- Heavy updates (observations, preferences, familiarity check): triggered by ResponseProcessor every N messages (default: 6) or at end-of-session

---

### 4.4 SessionService (`services/session_service.py`)

**Responsibility:**
Manage runtime state for active conversations. This is in-memory only, not persisted (it is reconstructable from the latest messages).

**Session State:**

```python
class ActiveSession:
    conversation_id: str
    user_id: str
    character_id: str
    started_at: datetime
    last_activity_at: datetime

    message_count: int
    topics_this_session: list[str]
    current_tone: str                  # detected emotional tone of current conversation
    rolling_summary: str | None        # maintained by Summarizer during long conversations
```

**Lifecycle:**
- Created when first message of a conversation arrives
- Updated every message
- Cleaned up after 30 minutes of inactivity (triggers end-of-session summary before cleanup)

**Why Not Just Use history_service:**
history_service stores raw messages. SessionService maintains a distilled view: "what has been covered, what is the current mood, what is the compressed summary so far." This distilled view is what ContextBuilder and ResponseProcessor consume.

---

### 4.5 ResponseProcessor (`services/response_processor.py`)

**Solves:** S2 (no relational signals extracted), S3 (state never updated)

**Responsibility:**
After LLM generates a response, extract signals and trigger state updates. This consolidates logic currently spread across chat.py's inline lambdas.

**Processing Pipeline:**

```
LLM response text
      |
      v
  [1] Lightweight signal extraction (rule-based, every message)
      - Detect topic keywords
      - Estimate emotional tone from response style
      - Update SessionService state
      |
      v
  [2] Periodic deep analysis (LLM-based, every N messages)
      - Extract new user preferences
      - Generate character observations
      - Check if familiarity phase should advance
      - Update CharacterState
      |
      v
  [3] Memory writeback (async, existing behavior moved here)
      - Buffer messages for entity extraction (existing memory_service flow)
      - Additionally extract relational signals for new memory types
```

**Key Design Decision:**
Step [2] is NOT run every message. It runs every 6 messages or when session ends. This avoids excessive LLM calls and cost. Step [1] is cheap (regex/keyword-based) and runs every message.

**Extraction Prompt for Step [2]:**

```
Given the following recent conversation segment between a character and a user,
extract the following signals:

1. New facts about the user (if any)
2. User preferences observed (explanation style, tone preference, topics of interest)
3. Character's observation about the user (one sentence, from character's perspective)
4. Overall emotional tone of this segment

Return as JSON. Only include signals with reasonable confidence.
```

---

### 4.6 MemoryService Enhancement (`services/memory_service.py`)

**Solves:** S2 (memory is factual only)

**Scope:** Extend the existing memory_service, do not replace it.

**New Node Types in Neo4j:**

```
UserPreference
  - id: str
  - user_id: str
  - character_id: str
  - preference_key: str          # e.g. "explanation_style"
  - preference_value: str        # e.g. "detailed_with_examples"
  - confidence: float
  - observed_at: datetime
  - source_conversation: str

CharacterObservation  
  - id: str
  - user_id: str
  - character_id: str
  - content: str                 # e.g. "user becomes more engaged when discussing system design"
  - observed_at: datetime
  - source_conversation: str
```

**New Relationship Types:**

```
(User)-[:HAS_PREFERENCE]->(UserPreference)
(Character)-[:OBSERVED]->(CharacterObservation)
(CharacterObservation)-[:ABOUT]->(User)
(User)-[:FEELS_ABOUT {valence, intensity}]->(Topic)  # extends existing Topic nodes
```

**Enhanced Retrieval:**
`query_related_context` currently returns entity facts. After enhancement, it also returns:
- Relevant user preferences (for ContextBuilder's prompt injection)
- Character observations (for personality-consistent responses)
- Emotional associations with topics (for tone adjustment)

The retrieval method receives an additional parameter `include_relational: bool` to control whether relational memory is included in results.

---

## 5. Data Model Additions

### 5.1 New SQLite Tables

```sql
CREATE TABLE conversation_summaries (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    character_id TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    topics_discussed TEXT,              -- JSON array
    key_facts_learned TEXT,             -- JSON array
    emotional_tone TEXT,
    unresolved_threads TEXT,            -- JSON array
    relationship_observation TEXT,
    one_line_summary TEXT,
    
    FOREIGN KEY (conversation_id) REFERENCES conversations(id)
);

CREATE TABLE character_states (
    id TEXT PRIMARY KEY,                -- composite: {user_id}_{character_id}
    user_id TEXT NOT NULL,
    character_id TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    total_conversations INTEGER DEFAULT 0,
    total_messages INTEGER DEFAULT 0,
    first_interaction_at TIMESTAMP,
    last_interaction_at TIMESTAMP,
    last_summary_id TEXT,
    
    familiarity_phase TEXT DEFAULT 'new',
    preferences TEXT,                   -- JSON dict
    observations TEXT,                  -- JSON array
    
    UNIQUE(user_id, character_id)
);
```

### 5.2 New Neo4j Node Labels

```
:UserPreference  {id, user_id, character_id, preference_key, preference_value, confidence, observed_at}
:CharacterObservation  {id, user_id, character_id, content, observed_at}
```

### 5.3 Pydantic Models (`models/session.py`)

```python
class BuiltContext:
    messages: list[dict]
    metadata: ContextMetadata

class ContextMetadata:
    total_tokens: int
    character_prompt_tokens: int
    memory_tokens: int
    history_tokens: int
    messages_included: int
    messages_excluded: int

class ConversationSummary:
    id: str
    conversation_id: str
    user_id: str
    character_id: str
    created_at: datetime
    topics_discussed: list[str]
    key_facts_learned: list[str]
    emotional_tone: str
    unresolved_threads: list[str]
    relationship_observation: str
    one_line_summary: str

class CharacterStateRecord:
    user_id: str
    character_id: str
    created_at: datetime
    updated_at: datetime
    total_conversations: int
    total_messages: int
    first_interaction_at: datetime
    last_interaction_at: datetime
    last_summary_id: str | None
    familiarity_phase: str
    preferences: dict
    observations: list[str]

class ActiveSession:
    conversation_id: str
    user_id: str
    character_id: str
    started_at: datetime
    last_activity_at: datetime
    message_count: int
    topics_this_session: list[str]
    current_tone: str
    rolling_summary: str | None
```

---

## 6. File Changes Summary

### New Files (6)

```
backend/app/services/context_builder.py
backend/app/services/summarizer.py
backend/app/services/character_state.py
backend/app/services/session_service.py
backend/app/services/response_processor.py
backend/app/models/session.py
```

### Modified Files (3)

```
backend/app/api/chat.py              -- integrate context_builder and response_processor
backend/app/services/memory_service.py   -- add relational memory types and enhanced retrieval
backend/app/database.py              -- add new SQLite table definitions
```

### Unchanged Files (everything else)

```
backend/app/main.py
backend/app/config.py
backend/app/services/llm_service.py
backend/app/services/tts_service.py
backend/app/services/character_service.py
backend/app/services/history_service.py
backend/app/models/chat.py
backend/app/models/config.py
backend/app/models/character.py
backend/app/models/db.py
backend/app/models/history.py
backend/app/models/memory.py
backend/app/api/config.py
backend/app/api/upload.py
backend/app/api/characters.py
backend/app/api/memory.py
backend/app/api/history.py
frontend/*                            -- no frontend changes in Phase A or B
```

---

## 7. Implementation Phases

### Phase A: Context Foundation

**Goal:** Long conversations stay coherent. Character maintains consistency across 50+ turns.

**Deliverables:**
1. `context_builder.py` - token budget management, priority-based context assembly
2. `summarizer.py` - rolling in-session summarization
3. `session_service.py` - runtime session state tracking
4. `models/session.py` - data models
5. Modified `chat.py` - use ContextBuilder instead of raw history pass-through
6. New SQLite table `conversation_summaries`

**User-Perceivable Change:**
- Character no longer "forgets" its personality in long conversations
- Character no longer repeats itself or contradicts earlier statements
- Conversations feel more focused (irrelevant old context is pruned)

**Estimated Scope:** ~800-1000 lines of new code

### Phase B: Character Memory and State

**Goal:** Character remembers you across sessions. Relationship deepens over time.

**Deliverables:**
1. `character_state.py` - persistent per-user character state
2. `response_processor.py` - post-response signal extraction and state updates
3. Enhanced `memory_service.py` - relational memory types
4. Enhanced `context_builder.py` - character state injection into prompts
5. New SQLite table `character_states`
6. New Neo4j node types (UserPreference, CharacterObservation)
7. End-of-session summary generation

**User-Perceivable Change:**
- New conversations pick up from where the last one ended
- Character naturally references shared history ("you mentioned your project last time...")
- Character's tone gradually warms over many conversations
- Character adapts explanation style to match user preferences
- Character remembers not just facts, but how conversations felt

**Estimated Scope:** ~1200-1500 lines of new code

### Phase C: Multi-modal Character Expression

**Goal:** Character's personality extends beyond text into voice and (future) visual expression.

**Deliverables:**
1. Emotion hints passed from ResponseProcessor to TTS
2. GPT-SoVITS parameter modulation based on emotion (speed, pitch adjustments)
3. Live2D / desktop pet action protocol definition (JSON schema)
4. Response format extension to carry expression metadata alongside text

**User-Perceivable Change:**
- Character's voice tone varies (more energetic when excited, calmer when thoughtful)
- Foundation ready for Live2D/desktop pet integration

**Estimated Scope:** ~500-800 lines of new code + protocol specification

### Phase D: Agent Capabilities (Future, Not in This Spec)

After Phases A-C establish a solid character core:
- Tool Router (standardized tool calling)
- Planner (multi-step task decomposition)
- Permission Gate (safety for external actions)

---

## 8. Key Design Decisions and Rationale

### D1: No UI exposure of character state
**Decision:** Character state (familiarity, observations, preferences) is never shown in the UI.
**Rationale:** The user explicitly wants to experience relationship growth through dialogue quality, not through metrics. Exposing numbers would break the illusion of a real relationship.

### D2: Keep Neo4j, extend rather than replace
**Decision:** Continue using Neo4j for graph memory. Add relational node types alongside existing entity nodes.
**Rationale:** Neo4j is already configured, indexed, and working. The existing entity memory (topics, projects, skills) is valid and useful. Relational memory (preferences, observations) is a natural extension, not a replacement.

### D3: SQLite for summaries and character state
**Decision:** New tabular data (summaries, character state records) goes into SQLite, not Neo4j.
**Rationale:** These are simple row-oriented records with no graph traversal needs. SQLite is already the primary relational store in the project. No need to force everything into the graph.

### D4: ResponseProcessor extracts signals, does not generate responses
**Decision:** ResponseProcessor runs AFTER the LLM has generated text. It does not influence the current response, only future ones.
**Rationale:** Inserting processing before response generation would add latency to every message. The character's behavior change is gradual (across conversations), not instant (within a single reply). Delayed signal extraction is sufficient and keeps the response path fast.

### D5: Familiarity phases, not numerical scores
**Decision:** Character relationship is modeled as discrete phases (new/acquainted/familiar/close), not continuous scores.
**Rationale:** Continuous scores invite optimization and display. Discrete phases map naturally to different prompt templates and behavioral patterns. They are also more robust to noisy signal extraction.

### D6: Periodic deep analysis, not per-message
**Decision:** LLM-based signal extraction (preferences, observations) runs every 6 messages, not every message.
**Rationale:** Cost and latency. Each extraction call uses the LLM. Running it every message would roughly double LLM costs. Every 6 messages provides sufficient granularity for a gradually evolving relationship.

---

## 9. Risks and Mitigations

### R1: Summarizer quality
**Risk:** LLM-generated summaries may miss important details or introduce hallucinations.
**Mitigation:** Summaries are always supplementary. Recent messages are always passed in full. If a summary is wrong, it is overridden by actual conversation content in the context window.

### R2: Character state pollution
**Risk:** Incorrect preference extraction causes the character to behave inappropriately.
**Mitigation:** Preferences have a confidence score. Only high-confidence preferences are injected into prompts. All preferences are overwritable by newer observations. A "decay" mechanism can be added later to reduce confidence of stale preferences.

### R3: Prompt injection through character state
**Risk:** User crafts messages that cause the character state to store adversarial instructions.
**Mitigation:** Character observations and preferences are extracted by a dedicated LLM call with a constrained output schema (JSON with specific fields). Free-form text is not directly injected into prompts; it is filtered through structured extraction.

### R4: Performance overhead
**Risk:** ContextBuilder + ResponseProcessor add latency to every message.
**Mitigation:** ContextBuilder is mostly in-memory operations (token counting, list slicing). ResponseProcessor's lightweight step is regex-based. The only potentially slow operations (summarization, deep analysis) are async and periodic, not per-message.

"""
Token-budgeted context assembly for LLM calls.
Assembles system prompt + memory + history within a configurable token budget.
"""
import logging
from typing import Optional

from app.models.chat import Message
from app.models.session import BuiltContext, ContextMetadata
from app.services.session_service import SessionService
from app.services.token_counter import TokenCounter

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
        max_tokens: int = 16000,
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
        """Build an optimized messages list within the token budget."""
        budget = self.max_tokens - self.output_reserved
        metadata = ContextMetadata()

        full_system, summary_tokens_used = self._assemble_system_prompt(
            system_prompt, memory_context, conversation_id
        )
        system_tokens = self.counter.count_text(full_system)

        max_system_tokens = (
            self.character_prompt_ceiling + self.memory_ceiling + self.summary_ceiling
        )
        if system_tokens > max_system_tokens:
            full_system, summary_tokens_used = self._truncate_system_prompt(system_prompt)
            system_tokens = self.counter.count_text(full_system)

        budget -= system_tokens
        metadata.character_prompt_tokens = self.counter.count_text(system_prompt)
        metadata.summary_tokens = summary_tokens_used
        if memory_context:
            metadata.memory_tokens = self.counter.count_text(memory_context)

        user_msg_tokens = self.counter.count_text(user_message)
        budget -= user_msg_tokens
        budget -= self.counter.OVERHEAD_PER_MESSAGE

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

        messages: list[dict] = [{"role": "system", "content": full_system}]
        for msg in included_history:
            role = "user" if msg.role == "user" else "assistant"
            messages.append({"role": role, "content": msg.content})
        messages.append({"role": "user", "content": user_message})

        metadata.total_tokens = self.counter.count_messages(messages)

        self.session_service.get_or_create(conversation_id, user_id, character_id)
        self.session_service.record_message(conversation_id)

        logger.info(
            "Context built: %s tokens, %s msgs included, %s excluded",
            metadata.total_tokens,
            metadata.messages_included,
            metadata.messages_excluded,
        )
        return BuiltContext(messages=messages, metadata=metadata)

    def _assemble_system_prompt(
        self,
        base_prompt: str,
        memory_context: Optional[str],
        conversation_id: str,
    ) -> tuple[str, int]:
        """Combine base prompt, memory, and session summary into a single prompt."""
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

    def _truncate_system_prompt(self, base_prompt: str) -> tuple[str, int]:
        """Fallback if combined prompt is too large."""
        logger.warning("System prompt exceeded ceiling, truncating to base prompt only")
        return base_prompt, 0

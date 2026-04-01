"""
Token counting abstraction.
Uses tiktoken for OpenAI models, character-based approximation for others.
"""
import logging

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
            if (
                0x4E00 <= cp <= 0x9FFF
                or 0x3400 <= cp <= 0x4DBF
                or 0xF900 <= cp <= 0xFAFF
                or 0x3000 <= cp <= 0x303F
                or 0x3040 <= cp <= 0x309F
                or 0x30A0 <= cp <= 0x30FF
                or 0xAC00 <= cp <= 0xD7AF
            ):
                cjk_count += 1
            else:
                latin_count += 1

        return max(1, (cjk_count + 1) // 2 + (latin_count + 3) // 4) if text else 0

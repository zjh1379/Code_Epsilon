"""Tests for token counting abstraction."""
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

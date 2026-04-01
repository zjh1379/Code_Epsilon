"""Tests for emotion-based TTS parameter mapping."""
from app.api.chat import _apply_emotion_to_tts


def test_energetic_increases_speed_and_reduces_interval():
    speed, interval = _apply_emotion_to_tts(1.0, 0.3, "energetic")
    assert speed > 1.0
    assert interval < 0.3


def test_empathetic_reduces_speed_and_increases_interval():
    speed, interval = _apply_emotion_to_tts(1.0, 0.3, "empathetic")
    assert speed < 1.0
    assert interval > 0.3


def test_neutral_keeps_values():
    speed, interval = _apply_emotion_to_tts(1.0, 0.3, "neutral")
    assert speed == 1.0
    assert interval == 0.3

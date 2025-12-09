"""
Chat request and response models
"""
from typing import List, Optional
from pydantic import BaseModel


class Message(BaseModel):
    """Single message in conversation history"""
    role: str  # "user" or "assistant"
    content: str


class ChatConfig(BaseModel):
    """Chat configuration with TTS parameters"""
    ref_audio_path: str
    prompt_text: str  # Reference audio text content
    prompt_lang: str = "zh"  # Language of prompt text
    text_lang: str  # "zh", "en", "ja"
    text_split_method: str = "cut5"  # Text split method
    speed_factor: float = 1.0  # Speed control
    fragment_interval: float = 0.3  # Interval between sentences
    top_k: int = 5  # Top k sampling
    top_p: float = 1.0  # Top p sampling
    temperature: float = 1.0  # Temperature for sampling
    aux_ref_audio_paths: List[str] = []  # Auxiliary reference audio paths


class ChatRequest(BaseModel):
    """Chat API request model"""
    message: str
    history: List[Message] = []
    config: ChatConfig


class ChatResponse(BaseModel):
    """Chat API response model"""
    type: str  # "text", "complete", "audio", "error"
    content: Optional[str] = None
    text: Optional[str] = None
    audio_data: Optional[str] = None  # Base64 encoded audio
    error: Optional[str] = None


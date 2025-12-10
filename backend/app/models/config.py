"""
Configuration API models
"""
from typing import Optional
from pydantic import BaseModel


class ConfigResponse(BaseModel):
    """Configuration response model"""
    ref_audio_path: str
    prompt_text: str
    prompt_lang: str
    text_lang: str
    text_split_method: str
    speed_factor: float
    fragment_interval: float
    top_k: int
    top_p: float
    temperature: float
    streaming_mode: int = 2  # Streaming mode: 0=non-streaming, 1=return_fragment, 2=true streaming (recommended), 3=fixed length chunk
    media_type: str = "ogg"  # Audio format: "wav", "ogg" (recommended for streaming), "aac", "raw", "fmp4"
    gpt_weights_path: Optional[str] = None
    sovits_weights_path: Optional[str] = None
    
    # LLM Configuration
    llm_provider: str = "openai" # "openai", "gemini"
    llm_model: str = "gpt-3.5-turbo"
    gemini_api_key: Optional[str] = None


class ConfigUpdateRequest(BaseModel):
    """Configuration update request model"""
    ref_audio_path: Optional[str] = None
    prompt_text: Optional[str] = None
    prompt_lang: Optional[str] = None
    text_lang: Optional[str] = None
    text_split_method: Optional[str] = None
    speed_factor: Optional[float] = None
    fragment_interval: Optional[float] = None
    top_k: Optional[int] = None
    top_p: Optional[float] = None
    temperature: Optional[float] = None
    streaming_mode: Optional[int] = None  # Streaming mode: 0=non-streaming, 1=return_fragment, 2=true streaming (recommended), 3=fixed length chunk
    media_type: Optional[str] = None  # Audio format: "wav", "ogg", "aac", "raw", "fmp4"
    gpt_weights_path: Optional[str] = None
    sovits_weights_path: Optional[str] = None
    
    # LLM Configuration
    llm_provider: Optional[str] = None
    llm_model: Optional[str] = None
    gemini_api_key: Optional[str] = None


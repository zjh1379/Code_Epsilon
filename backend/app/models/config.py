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
    gpt_weights_path: Optional[str] = None
    sovits_weights_path: Optional[str] = None


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
    gpt_weights_path: Optional[str] = None
    sovits_weights_path: Optional[str] = None


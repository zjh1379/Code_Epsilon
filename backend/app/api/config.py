"""
Configuration API endpoints
Handles configuration management
"""
import logging
import os
from fastapi import APIRouter, HTTPException
from app.models.config import ConfigResponse, ConfigUpdateRequest
from app.services.llm_service import llm_service
from app.services.gpt_sovits_paths import (
    ReferenceAudioPathError,
    pick_default_reference_audio,
    resolve_reference_audio_path,
)
from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter()

# Default configuration constants
DEFAULT_CONFIG = {
    "ref_audio_path": pick_default_reference_audio(
        settings.gpt_sovits_refs_host_dir,
        settings.gpt_sovits_default_ref_audio,
    ),
    "prompt_text": "こちらの楽曲は春巻ごはんさんに作っていただいた楽曲なんですけど",
    "prompt_lang": "ja",
    "text_lang": "zh",
    "text_split_method": "cut5",
    "speed_factor": 1.0,
    "fragment_interval": 0.3,
    "top_k": 15,
    "top_p": 1.0,
    "temperature": 1.0,
    "streaming_mode": 2,
    "media_type": "ogg",
    "llm_provider": "openai",
    "llm_model": "gpt-3.5-turbo",
    "gemini_api_key": "",
    "deepseek_api_key": ""
}

# In-memory configuration storage (for MVP)
# In production, this should be stored in database or file
_config_cache = {
    "ref_audio_path": "",
    "prompt_text": "",
    "prompt_lang": "zh",
    "text_lang": "zh",
    "text_split_method": "cut5",
    "speed_factor": 1.0,
    "fragment_interval": 0.3,
    "top_k": 5,
    "top_p": 1.0,
    "temperature": 1.0,
    "streaming_mode": 2,
    "media_type": "ogg",
    "llm_provider": "openai",
    "llm_model": "gpt-3.5-turbo",
    "gemini_api_key": "",
    "deepseek_api_key": ""
}


def _initialize_config_with_defaults():
    """Initialize config cache with default values if empty"""
    global _config_cache
    DEFAULT_CONFIG["ref_audio_path"] = pick_default_reference_audio(
        settings.gpt_sovits_refs_host_dir,
        settings.gpt_sovits_default_ref_audio,
    )
    if not _config_cache.get("ref_audio_path"):
        _config_cache.update(DEFAULT_CONFIG)
        
        # Load values from settings (env vars)
        if settings.gemini_api_key:
            _config_cache["gemini_api_key"] = settings.gemini_api_key
        if settings.deepseek_api_key:
            _config_cache["deepseek_api_key"] = settings.deepseek_api_key
            
        logger.info("Configuration initialized with default values")


# Initialize with defaults on module load
_initialize_config_with_defaults()


@router.get("/config", response_model=ConfigResponse)
async def get_config():
    """
    Get current configuration
    
    Returns:
        Current configuration settings
    """
    return ConfigResponse(
        ref_audio_path=_config_cache.get("ref_audio_path", ""),
        prompt_text=_config_cache.get("prompt_text", ""),
        prompt_lang=_config_cache.get("prompt_lang", "zh"),
        text_lang=_config_cache.get("text_lang", "zh"),
        text_split_method=_config_cache.get("text_split_method", "cut5"),
        speed_factor=_config_cache.get("speed_factor", 1.0),
        fragment_interval=_config_cache.get("fragment_interval", 0.3),
        top_k=_config_cache.get("top_k", 5),
        top_p=_config_cache.get("top_p", 1.0),
        temperature=_config_cache.get("temperature", 1.0),
        streaming_mode=_config_cache.get("streaming_mode", 2),
        media_type=_config_cache.get("media_type", "ogg"),
        llm_provider=_config_cache.get("llm_provider", "openai"),
        llm_model=_config_cache.get("llm_model", "gpt-3.5-turbo"),
        gemini_api_key=_config_cache.get("gemini_api_key", ""),
        deepseek_api_key=_config_cache.get("deepseek_api_key", "")
    )


@router.post("/config")
async def update_config(request: ConfigUpdateRequest):
    """
    Update configuration
    
    Args:
        request: Configuration update request
        
    Returns:
        Updated configuration
    """
    if request.ref_audio_path is not None:
        try:
            host_ref_audio_path, _ = resolve_reference_audio_path(
                ref_audio_path=request.ref_audio_path,
                refs_host_dir=settings.gpt_sovits_refs_host_dir,
                refs_container_dir=settings.gpt_sovits_refs_container_dir,
            )
        except ReferenceAudioPathError as e:
            raise HTTPException(status_code=400, detail=str(e)) from e
        _config_cache["ref_audio_path"] = host_ref_audio_path
    
    if request.prompt_text is not None:
        _config_cache["prompt_text"] = request.prompt_text
    
    if request.prompt_lang is not None:
        if request.prompt_lang not in ["zh", "en", "ja", "ko", "yue"]:
            raise HTTPException(status_code=400, detail="不支持的提示语言类型")
        _config_cache["prompt_lang"] = request.prompt_lang
    
    if request.text_lang is not None:
        if request.text_lang not in ["zh", "en", "ja", "ko", "yue"]:
            raise HTTPException(status_code=400, detail="不支持的语言类型")
        _config_cache["text_lang"] = request.text_lang
    
    if request.text_split_method is not None:
        _config_cache["text_split_method"] = request.text_split_method
    
    if request.speed_factor is not None:
        _config_cache["speed_factor"] = request.speed_factor
    
    if request.fragment_interval is not None:
        _config_cache["fragment_interval"] = request.fragment_interval
    
    if request.top_k is not None:
        _config_cache["top_k"] = request.top_k
    
    if request.top_p is not None:
        _config_cache["top_p"] = request.top_p
    
    if request.temperature is not None:
        _config_cache["temperature"] = request.temperature
    
    if request.streaming_mode is not None:
        if request.streaming_mode not in [0, 1, 2, 3]:
            raise HTTPException(status_code=400, detail="streaming_mode必须是0/1/2/3")
        _config_cache["streaming_mode"] = request.streaming_mode
    
    if request.media_type is not None:
        if request.media_type not in ["wav", "raw", "ogg", "aac"]:
            raise HTTPException(status_code=400, detail="不支持的media_type，支持: wav, raw, ogg, aac")
        _config_cache["media_type"] = request.media_type
    
    # Update LLM config
    llm_updated = False
    if request.llm_provider is not None:
        _config_cache["llm_provider"] = request.llm_provider
        settings.llm_provider = request.llm_provider
        llm_updated = True
        
    if request.llm_model is not None:
        _config_cache["llm_model"] = request.llm_model
        settings.openai_model = request.llm_model # Map to internal setting
        llm_updated = True
        
    if request.gemini_api_key is not None:
        _config_cache["gemini_api_key"] = request.gemini_api_key
        settings.gemini_api_key = request.gemini_api_key
        llm_updated = True
    
    if request.deepseek_api_key is not None:
        _config_cache["deepseek_api_key"] = request.deepseek_api_key
        settings.deepseek_api_key = request.deepseek_api_key
        os.environ["DEEPSEEK_API_KEY"] = request.deepseek_api_key
        llm_updated = True
        
    if llm_updated:
        try:
            llm_service.set_model(
                provider=_config_cache.get("llm_provider", "openai"),
                model_id=_config_cache.get("llm_model", "gpt-3.5-turbo")
            )
        except Exception as e:
            logger.error(f"Failed to update LLM model: {str(e)}")
            # Don't fail the request, just log error
    
    logger.info(f"Configuration updated: {_config_cache}")
    
    return ConfigResponse(
        ref_audio_path=_config_cache["ref_audio_path"],
        prompt_text=_config_cache["prompt_text"],
        prompt_lang=_config_cache["prompt_lang"],
        text_lang=_config_cache["text_lang"],
        text_split_method=_config_cache["text_split_method"],
        speed_factor=_config_cache["speed_factor"],
        fragment_interval=_config_cache["fragment_interval"],
        top_k=_config_cache["top_k"],
        top_p=_config_cache["top_p"],
        temperature=_config_cache["temperature"],
        streaming_mode=_config_cache["streaming_mode"],
        media_type=_config_cache["media_type"],
        llm_provider=_config_cache.get("llm_provider", "openai"),
        llm_model=_config_cache.get("llm_model", "gpt-3.5-turbo"),
        gemini_api_key=_config_cache.get("gemini_api_key", ""),
        deepseek_api_key=_config_cache.get("deepseek_api_key", "")
    )

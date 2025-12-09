"""
Configuration API endpoints
Handles configuration management
"""
import logging
from fastapi import APIRouter, HTTPException
from app.models.config import ConfigResponse, ConfigUpdateRequest
from app.services.tts_service import tts_service
from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter()

# In-memory configuration storage (for MVP)
# In production, this should be stored in database or file
# Default configuration for development
_config_cache = {
    "ref_audio_path": r"D:\NEU\epsilon\backend\uploads\audio\vocal_3year.wav.reformatted_vocals.flac_main_vocal.flac_10.flac_0007446080_0007595520_9500f4a7.wav",
    "prompt_text": "こちらの楽曲は春巻ごはんさんに作っていただいた楽曲なんですけど",
    "prompt_lang": "ja",
    "text_lang": "zh",
    "text_split_method": "cut5",
    "speed_factor": 1.0,
    "fragment_interval": 0.3,
    "top_k": 15,
    "top_p": 1.0,
    "temperature": 1.0,
    "gpt_weights_path": r"C:\GPT-SoVITS\GPT-SoVITS-v2pro-20250604\GPT_weights_v2Pro\isekai60-e15.ckpt",
    "sovits_weights_path": r"C:\GPT-SoVITS\GPT-SoVITS-v2pro-20250604\SoVITS_weights_v2Pro\isekai60_e8_s248.pth"
}


@router.get("/config", response_model=ConfigResponse)
async def get_config():
    """
    Get current configuration
    
    Returns:
        Current configuration settings
    """
    # Initialize model weights on first access if they are set
    if _config_cache.get("gpt_weights_path") and not _config_cache.get("_gpt_weights_initialized", False):
        try:
            cleaned_path = _config_cache["gpt_weights_path"].strip().strip('"').strip("'")
            success = await tts_service.set_gpt_weights(cleaned_path)
            if success:
                _config_cache["_gpt_weights_initialized"] = True
                logger.info(f"Default GPT weights initialized: {cleaned_path}")
            else:
                logger.warning(f"Failed to initialize default GPT weights: {cleaned_path}")
        except Exception as e:
            logger.warning(f"Failed to initialize default GPT weights: {e}")
    
    if _config_cache.get("sovits_weights_path") and not _config_cache.get("_sovits_weights_initialized", False):
        try:
            cleaned_path = _config_cache["sovits_weights_path"].strip().strip('"').strip("'")
            success = await tts_service.set_sovits_weights(cleaned_path)
            if success:
                _config_cache["_sovits_weights_initialized"] = True
                logger.info(f"Default SoVITS weights initialized: {cleaned_path}")
            else:
                logger.warning(f"Failed to initialize default SoVITS weights: {cleaned_path}")
        except Exception as e:
            logger.warning(f"Failed to initialize default SoVITS weights: {e}")
    
    return ConfigResponse(
        ref_audio_path=_config_cache.get("ref_audio_path", ""),
        prompt_text=_config_cache.get("prompt_text", ""),
        prompt_lang=_config_cache.get("prompt_lang", "zh"),
        text_lang=_config_cache.get("text_lang", "zh"),
        text_split_method=_config_cache.get("text_split_method", "cut5"),
        speed_factor=_config_cache.get("speed_factor", 1.0),
        fragment_interval=_config_cache.get("fragment_interval", 0.3),
        top_k=_config_cache.get("top_k", 15),
        top_p=_config_cache.get("top_p", 1.0),
        temperature=_config_cache.get("temperature", 1.0),
        gpt_weights_path=_config_cache.get("gpt_weights_path"),
        sovits_weights_path=_config_cache.get("sovits_weights_path")
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
        _config_cache["ref_audio_path"] = request.ref_audio_path
    
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
    
    # Update model weights if provided
    if request.gpt_weights_path is not None and request.gpt_weights_path.strip():
        # Clean the path
        cleaned_path = request.gpt_weights_path.strip().strip('"').strip("'")
        success = await tts_service.set_gpt_weights(cleaned_path)
        if success:
            _config_cache["gpt_weights_path"] = cleaned_path
        else:
            raise HTTPException(status_code=400, detail="GPT模型权重设置失败，请检查路径是否正确")
    
    if request.sovits_weights_path is not None and request.sovits_weights_path.strip():
        # Clean the path
        cleaned_path = request.sovits_weights_path.strip().strip('"').strip("'")
        success = await tts_service.set_sovits_weights(cleaned_path)
        if success:
            _config_cache["sovits_weights_path"] = cleaned_path
        else:
            raise HTTPException(status_code=400, detail="SoVITS模型权重设置失败，请检查路径是否正确")
    
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
        gpt_weights_path=_config_cache["gpt_weights_path"],
        sovits_weights_path=_config_cache["sovits_weights_path"]
    )


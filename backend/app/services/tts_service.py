"""
GPT-SoVITS TTS service wrapper
Handles text-to-speech conversion via GPT-SoVITS API
"""
import asyncio
import base64
import logging
from typing import Optional, List
import aiohttp
from app.config import settings

logger = logging.getLogger(__name__)


class TTSService:
    """Service for GPT-SoVITS TTS API integration"""
    
    def __init__(self):
        self.base_url = settings.gpt_sovits_base_url.rstrip('/')
        self.timeout = aiohttp.ClientTimeout(total=30)
    
    async def text_to_speech(
        self,
        text: str,
        text_lang: str,
        ref_audio_path: str,
        prompt_text: str = "",
        prompt_lang: str = "zh",
        text_split_method: str = "cut5",
        speed_factor: float = 1.0,
        fragment_interval: float = 0.3,
        top_k: int = 5,
        top_p: float = 1.0,
        temperature: float = 1.0,
        aux_ref_audio_paths: List[str] = None,
        max_retries: int = 3
    ) -> Optional[str]:
        """
        Convert text to speech using GPT-SoVITS API
        
        Args:
            text: Text to convert
            text_lang: Text language (zh/en/ja)
            ref_audio_path: Reference audio file path
            max_retries: Maximum number of retry attempts
            
        Returns:
            Base64 encoded audio data, or None if failed
        """
        url = f"{self.base_url}/tts"
        
        # Clean and validate text
        text = text.strip()
        # Remove leading punctuation marks that might cause issues
        while text and text[0] in ['，', ',', '。', '.', '！', '!', '？', '?', '、']:
            text = text[1:].strip()
        
        if not text:
            logger.error("Text is empty after cleaning")
            return None
        
        # Clean prompt text
        prompt_text = prompt_text.strip() if prompt_text else ""
        
        # Build request payload with required and default parameters
        payload = {
            "text": text,
            "text_lang": text_lang.lower(),
            "ref_audio_path": ref_audio_path,
            "prompt_lang": prompt_lang.lower(),
            "prompt_text": prompt_text,
            "top_k": top_k,
            "top_p": top_p,
            "temperature": temperature,
            "text_split_method": text_split_method,
            "batch_size": 1,
            "batch_threshold": 0.75,
            "split_bucket": True,
            "speed_factor": speed_factor,
            "fragment_interval": fragment_interval,
            "seed": -1,
            "media_type": "wav",
            "parallel_infer": True,
            "repetition_penalty": 1.35,
            "sample_steps": 32,
            "super_sampling": False,
            "streaming_mode": False,
            "overlap_length": 2,
            "min_chunk_length": 16,
            "aux_ref_audio_paths": aux_ref_audio_paths or []
        }
        
        # Retry logic with exponential backoff
        for attempt in range(max_retries):
            try:
                async with aiohttp.ClientSession(timeout=self.timeout) as session:
                    async with session.post(url, json=payload) as response:
                        if response.status == 200:
                            audio_data = await response.read()
                            # Convert to base64 for transmission
                            audio_base64 = base64.b64encode(audio_data).decode('utf-8')
                            logger.info(f"TTS conversion successful for text length: {len(text)}")
                            return audio_base64
                        else:
                            error_text = await response.text()
                            try:
                                # Try to parse JSON error response
                                import json as json_lib
                                error_json = json_lib.loads(error_text)
                                error_msg = error_json.get("message", "Unknown error")
                                error_exception = error_json.get("Exception", "")
                                logger.error(f"TTS API error {response.status}: {error_msg}")
                                if error_exception:
                                    logger.error(f"Exception details: {error_exception}")
                            except:
                                logger.error(f"TTS API error {response.status}: {error_text}")
                            
                            logger.error(f"Request details: text={text[:100]}..., text_lang={text_lang}, prompt_lang={prompt_lang}, prompt_text={prompt_text[:50] if prompt_text else 'empty'}...")
                            logger.error(f"ref_audio_path={ref_audio_path}")
                            
                            # Don't retry on 400 errors (bad request), only retry on 500+ errors
                            if response.status >= 500 and attempt < max_retries - 1:
                                wait_time = 2 ** attempt  # Exponential backoff: 1s, 2s, 4s
                                logger.info(f"Retrying TTS request in {wait_time} seconds...")
                                await asyncio.sleep(wait_time)
                                continue
                            # For 400 errors, return None immediately
                            return None
            except asyncio.TimeoutError:
                logger.error(f"TTS API timeout (attempt {attempt + 1}/{max_retries})")
                if attempt < max_retries - 1:
                    wait_time = 2 ** attempt
                    await asyncio.sleep(wait_time)
                    continue
                return None
            except Exception as e:
                logger.error(f"TTS API exception: {str(e)}")
                if attempt < max_retries - 1:
                    wait_time = 2 ** attempt
                    await asyncio.sleep(wait_time)
                    continue
                return None
        
        return None
    
    async def set_refer_audio(self, refer_audio_path: str) -> bool:
        """
        Set reference audio globally (optional GPT-SoVITS feature)
        
        Args:
            refer_audio_path: Reference audio file path
            
        Returns:
            True if successful, False otherwise
        """
        url = f"{self.base_url}/set_refer_audio"
        params = {"refer_audio_path": refer_audio_path}
        
        try:
            async with aiohttp.ClientSession(timeout=self.timeout) as session:
                async with session.get(url, params=params) as response:
                    if response.status == 200:
                        logger.info(f"Reference audio set: {refer_audio_path}")
                        return True
                    else:
                        logger.warning(f"Failed to set reference audio: {response.status}")
                        return False
        except Exception as e:
            logger.error(f"Error setting reference audio: {str(e)}")
            return False
    
    async def set_gpt_weights(self, weights_path: str) -> bool:
        """
        Set GPT model weights
        
        Args:
            weights_path: Path to GPT weights file
            
        Returns:
            True if successful, False otherwise
        """
        # Remove quotes if present and strip whitespace
        weights_path = weights_path.strip().strip('"').strip("'")
        
        if not weights_path:
            logger.error("GPT weights path is empty")
            return False
        
        url = f"{self.base_url}/set_gpt_weights"
        params = {"weights_path": weights_path}
        
        try:
            async with aiohttp.ClientSession(timeout=self.timeout) as session:
                async with session.get(url, params=params) as response:
                    if response.status == 200:
                        logger.info(f"GPT weights set: {weights_path}")
                        return True
                    else:
                        error_text = await response.text()
                        logger.error(f"Failed to set GPT weights: {response.status}, {error_text}")
                        return False
        except Exception as e:
            logger.error(f"Error setting GPT weights: {str(e)}")
            return False
    
    async def set_sovits_weights(self, weights_path: str) -> bool:
        """
        Set SoVITS model weights
        
        Args:
            weights_path: Path to SoVITS weights file
            
        Returns:
            True if successful, False otherwise
        """
        # Remove quotes if present and strip whitespace
        weights_path = weights_path.strip().strip('"').strip("'")
        
        if not weights_path:
            logger.error("SoVITS weights path is empty")
            return False
        
        url = f"{self.base_url}/set_sovits_weights"
        params = {"weights_path": weights_path}
        
        try:
            async with aiohttp.ClientSession(timeout=self.timeout) as session:
                async with session.get(url, params=params) as response:
                    if response.status == 200:
                        logger.info(f"SoVITS weights set: {weights_path}")
                        return True
                    else:
                        error_text = await response.text()
                        logger.error(f"Failed to set SoVITS weights: {response.status}, {error_text}")
                        return False
        except Exception as e:
            logger.error(f"Error setting SoVITS weights: {str(e)}")
            return False


# Global TTS service instance
tts_service = TTSService()


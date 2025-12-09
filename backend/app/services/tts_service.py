"""
GPT-SoVITS TTS service wrapper
Handles text-to-speech conversion via GPT-SoVITS API
"""
import asyncio
import base64
import logging
from typing import Optional, List, AsyncIterator
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
        original_text = text
        text = text.strip()
        
        # Remove leading punctuation marks that might cause issues
        # Include more punctuation marks
        leading_punctuation = ['，', ',', '。', '.', '！', '!', '？', '?', '、', '：', ':', '；', ';', '…', '…', '—', '-', '–', '—', ' ']
        while text and text[0] in leading_punctuation:
            text = text[1:].strip()
        
        # Also remove trailing punctuation that might cause issues
        trailing_punctuation = ['，', ',', '。', '.', '！', '!', '？', '?', '、', '：', ':', '；', ';']
        while text and text[-1] in trailing_punctuation and len(text) > 1:
            text = text[:-1].strip()
        
        if not text:
            logger.error(f"Text is empty after cleaning. Original: {original_text[:50]}...")
            return None
        
        # Log text cleaning
        if original_text != text:
            logger.info(f"Text cleaned: '{original_text[:50]}...' -> '{text[:50]}...'")
        
        # Clean prompt text
        prompt_text = prompt_text.strip() if prompt_text else ""
        
        # Validate prompt_text matches prompt_lang
        if prompt_text and prompt_lang:
            logger.info(f"Using prompt_text: '{prompt_text[:50]}...' with prompt_lang: {prompt_lang}")
        elif not prompt_text:
            logger.warning(f"prompt_text is empty but prompt_lang is {prompt_lang}. This may cause issues.")
        
        # Validate language parameters
        if not ref_audio_path:
            logger.error("ref_audio_path is empty")
            return None
        
        # Log language configuration
        logger.info(f"TTS language config: text_lang={text_lang}, prompt_lang={prompt_lang}, text_length={len(text)}")
        
        # Build request payload with required and default parameters
        # Ensure language codes are lowercase and valid
        text_lang_clean = text_lang.lower().strip()
        prompt_lang_clean = prompt_lang.lower().strip()
        
        # Validate language codes
        valid_langs = ['zh', 'en', 'ja', 'ko', 'yue']
        if text_lang_clean not in valid_langs:
            logger.warning(f"Invalid text_lang: {text_lang_clean}, defaulting to 'zh'")
            text_lang_clean = 'zh'
        if prompt_lang_clean not in valid_langs:
            logger.warning(f"Invalid prompt_lang: {prompt_lang_clean}, defaulting to 'zh'")
            prompt_lang_clean = 'zh'
        
        payload = {
            "text": text,
            "text_lang": text_lang_clean,
            "ref_audio_path": ref_audio_path,
            "prompt_lang": prompt_lang_clean,
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
                            
                            logger.error(f"Request details:")
                            logger.error(f"  text (cleaned): {text[:100]}...")
                            logger.error(f"  text_lang: {text_lang}")
                            logger.error(f"  prompt_lang: {prompt_lang}")
                            logger.error(f"  prompt_text: {prompt_text[:100] if prompt_text else 'empty'}...")
                            logger.error(f"  ref_audio_path: {ref_audio_path}")
                            logger.error(f"  text_split_method: {text_split_method}")
                            logger.error(f"  Full payload keys: {list(payload.keys())}")
                            
                            # Log payload for debugging (without sensitive data)
                            payload_debug = {k: v for k, v in payload.items() if k not in ['text', 'prompt_text']}
                            payload_debug['text_length'] = len(text)
                            payload_debug['prompt_text_length'] = len(prompt_text) if prompt_text else 0
                            logger.error(f"  Payload summary: {payload_debug}")
                            
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
    
    async def stream_text_to_speech(
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
        aux_ref_audio_paths: List[str] = None
    ) -> AsyncIterator[bytes]:
        """
        Stream text-to-speech conversion using GPT-SoVITS API
        
        Args:
            text: Text to convert
            text_lang: Text language (zh/en/ja)
            ref_audio_path: Reference audio file path
            prompt_text: Prompt text for reference audio
            prompt_lang: Prompt language
            text_split_method: Text splitting method
            speed_factor: Speed adjustment factor
            fragment_interval: Fragment interval
            top_k: Top-k sampling parameter
            top_p: Top-p sampling parameter
            temperature: Temperature parameter
            aux_ref_audio_paths: Auxiliary reference audio paths
            
        Yields:
            Audio chunks as bytes
        """
        url = f"{self.base_url}/tts"
        
        # Clean and validate text (same as non-streaming version)
        original_text = text
        text = text.strip()
        
        # Remove leading punctuation marks
        leading_punctuation = ['，', ',', '。', '.', '！', '!', '？', '?', '、', '：', ':', '；', ';', '…', '…', '—', '-', '–', '—', ' ']
        while text and text[0] in leading_punctuation:
            text = text[1:].strip()
        
        # Remove trailing punctuation
        trailing_punctuation = ['，', ',', '。', '.', '！', '!', '？', '?', '、', '：', ':', '；', ';']
        while text and text[-1] in trailing_punctuation and len(text) > 1:
            text = text[:-1].strip()
        
        if not text:
            logger.error(f"Text is empty after cleaning. Original: {original_text[:50]}...")
            return
        
        # Clean prompt text
        prompt_text = prompt_text.strip() if prompt_text else ""
        
        # Validate language codes
        text_lang_clean = text_lang.lower().strip()
        prompt_lang_clean = prompt_lang.lower().strip()
        valid_langs = ['zh', 'en', 'ja', 'ko', 'yue']
        if text_lang_clean not in valid_langs:
            logger.warning(f"Invalid text_lang: {text_lang_clean}, defaulting to 'zh'")
            text_lang_clean = 'zh'
        if prompt_lang_clean not in valid_langs:
            logger.warning(f"Invalid prompt_lang: {prompt_lang_clean}, defaulting to 'zh'")
            prompt_lang_clean = 'zh'
        
        # Build request payload with streaming_mode enabled
        payload = {
            "text": text,
            "text_lang": text_lang_clean,
            "ref_audio_path": ref_audio_path,
            "prompt_lang": prompt_lang_clean,
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
            "streaming_mode": True,  # Enable streaming mode
            "overlap_length": 2,
            "min_chunk_length": 16,
            "aux_ref_audio_paths": aux_ref_audio_paths or []
        }
        
        logger.info(f"Starting streaming TTS: text_lang={text_lang_clean}, prompt_lang={prompt_lang_clean}, "
                   f"text_length={len(text)}")
        
        try:
            # Use longer timeout for streaming
            streaming_timeout = aiohttp.ClientTimeout(total=120)  # 2 minutes for streaming
            
            async with aiohttp.ClientSession(timeout=streaming_timeout) as session:
                async with session.post(url, json=payload) as response:
                    if response.status != 200:
                        error_text = await response.text()
                        logger.error(f"TTS streaming API error {response.status}: {error_text}")
                        return
                    
                    # Stream audio chunks
                    chunk_index = 0
                    async for chunk in response.content.iter_chunked(8192):  # 8KB chunks
                        if chunk:
                            logger.debug(f"Received audio chunk {chunk_index}, size: {len(chunk)} bytes")
                            yield chunk
                            chunk_index += 1
                    
                    logger.info(f"Streaming TTS completed, total chunks: {chunk_index}")
        
        except asyncio.TimeoutError:
            logger.error("TTS streaming API timeout")
        except Exception as e:
            logger.error(f"TTS streaming exception: {str(e)}")


# Global TTS service instance
tts_service = TTSService()


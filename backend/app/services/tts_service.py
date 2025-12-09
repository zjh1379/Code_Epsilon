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
        # Streaming may take longer; set a longer timeout window
        self.timeout = aiohttp.ClientTimeout(total=300)
    
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
        Convert text to speech using GPT-SoVITS API (non-streaming, base64)
        """
        url = f"{self.base_url}/tts"
        
        # Clean and validate text
        text = text.strip()
        while text and text[0] in ['，', ',', '。', '.', '！', '!', '？', '?', '、']:
            text = text[1:].strip()
        
        if not text:
            logger.error("Text is empty after cleaning")
            return None
        
        prompt_text = prompt_text.strip() if prompt_text else ""
        
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
                            audio_base64 = base64.b64encode(audio_data).decode('utf-8')
                            logger.info(f"TTS conversion successful for text length: {len(text)}")
                            return audio_base64
                        else:
                            error_text = await response.text()
                            try:
                                import json as json_lib
                                error_json = json_lib.loads(error_text)
                                error_msg = error_json.get("message", "Unknown error")
                                error_exception = error_json.get("Exception", "")
                                logger.error(f"TTS API error {response.status}: {error_msg}")
                                if error_exception:
                                    logger.error(f"Exception details: {error_exception}")
                            except Exception:
                                logger.error(f"TTS API error {response.status}: {error_text}")
                            
                            logger.error(f"Request details: text={text[:100]}..., text_lang={text_lang}, prompt_lang={prompt_lang}, prompt_text={prompt_text[:50] if prompt_text else 'empty'}...")
                            logger.error(f"ref_audio_path={ref_audio_path}")
                            
                            # Don't retry on 400 errors (bad request), only retry on 500+ errors
                            if response.status >= 500 and attempt < max_retries - 1:
                                wait_time = 2 ** attempt  # Exponential backoff: 1s, 2s, 4s
                                logger.info(f"Retrying TTS request in {wait_time} seconds...")
                                await asyncio.sleep(wait_time)
                                continue
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
    
    async def stream_text_to_speech(
        self,
        text: str,
        text_lang: str,
        ref_audio_path: str,
        prompt_lang: str,
        prompt_text: str = "",
        streaming_mode: int = 2,
        media_type: str = "wav",
        text_split_method: str = "cut5",
        top_k: int = 5,
        top_p: float = 1.0,
        temperature: float = 1.0,
        speed_factor: float = 1.0,
        fragment_interval: float = 0.3,
        overlap_length: int = 2,
        min_chunk_length: int = 16,
        aux_ref_audio_paths: Optional[List[str]] = None,
        max_retries: int = 3
    ) -> AsyncIterator[bytes]:
        """
        Stream TTS audio chunks using GPT-SoVITS streaming API.
        
        Yields raw audio bytes; caller decides encoding (e.g., base64 for SSE).
        """
        url = f"{self.base_url}/tts"
        
        # Clean text similar to non-streaming path
        text = text.strip()
        while text and text[0] in ['，', ',', '。', '.', '！', '!', '？', '?', '、']:
            text = text[1:].strip()
        
        if not text:
            raise ValueError("Text is empty after cleaning")
        
        prompt_text = prompt_text.strip() if prompt_text else ""
        
        if streaming_mode not in [0, 1, 2, 3]:
            raise ValueError(f"streaming_mode必须是0/1/2/3，当前值: {streaming_mode}")
        if media_type not in ["wav", "raw", "ogg", "aac", "fmp4"]:
            raise ValueError(f"不支持的media_type: {media_type}")
        
        payload = {
            "text": text,
            "text_lang": text_lang.lower(),
            "ref_audio_path": ref_audio_path,
            "prompt_lang": prompt_lang.lower(),
            "prompt_text": prompt_text,
            "media_type": media_type,
            "streaming_mode": streaming_mode,  # must be int
            "text_split_method": text_split_method,
            "top_k": top_k,
            "top_p": top_p,
            "temperature": temperature,
            "speed_factor": speed_factor,
            "fragment_interval": fragment_interval,
            "overlap_length": overlap_length,
            "min_chunk_length": min_chunk_length,
            "batch_size": 1,
            "batch_threshold": 0.75,
            "split_bucket": True,
            "seed": -1,
            "parallel_infer": True,
            "repetition_penalty": 1.35,
            "sample_steps": 32,
            "super_sampling": False,
            "aux_ref_audio_paths": aux_ref_audio_paths or []
        }
        
        for attempt in range(max_retries):
            try:
                async with aiohttp.ClientSession(timeout=self.timeout) as session:
                    async with session.post(url, json=payload) as response:
                        if response.status != 200:
                            error_text = await response.text()
                            try:
                                import json as json_lib
                                error_json = json_lib.loads(error_text)
                                error_msg = error_json.get("message", "Unknown error")
                            except Exception:
                                error_msg = error_text
                            
                            logger.error(f"TTS streaming error {response.status}: {error_msg}")
                            
                            if response.status == 400:
                                raise Exception(f"TTS API错误: {error_msg}")
                            if attempt < max_retries - 1:
                                wait_time = 2 ** attempt
                                logger.info(f"重试TTS流式请求，等待{wait_time}秒...")
                                await asyncio.sleep(wait_time)
                                continue
                            raise Exception(f"TTS API错误: {error_msg}")
                        
                        chunk_count = 0
                        first_chunk_size = 0
                        async for chunk in response.content.iter_chunked(8192):
                            if chunk:
                                chunk_count += 1
                                if chunk_count == 1:
                                    first_chunk_size = len(chunk)
                                    logger.debug(f"收到第一个chunk (WAV header), 大小: {len(chunk)} bytes")
                                else:
                                    logger.debug(f"收到音频chunk #{chunk_count}, 大小: {len(chunk)} bytes")
                                yield chunk
                        
                        if chunk_count == 0:
                            logger.warning("未收到任何音频chunk")
                            if attempt < max_retries - 1:
                                wait_time = 2 ** attempt
                                await asyncio.sleep(wait_time)
                                continue
                            raise Exception("TTS流式响应未返回任何数据")
                        
                        # Validate first chunk is WAV header (approximately 44 bytes)
                        if first_chunk_size > 0 and first_chunk_size < 50:
                            logger.info(f"成功接收{chunk_count}个音频chunk，第一个chunk大小: {first_chunk_size} bytes (WAV header)")
                        else:
                            logger.warning(f"第一个chunk大小异常: {first_chunk_size} bytes")
                        
                        return
            
            except asyncio.TimeoutError:
                logger.error(f"TTS流式请求超时 (尝试 {attempt + 1}/{max_retries})")
                if attempt < max_retries - 1:
                    wait_time = 2 ** attempt
                    await asyncio.sleep(wait_time)
                    continue
                raise Exception("TTS API请求超时")
            except Exception as e:
                logger.error(f"TTS流式请求异常: {str(e)}")
                if attempt < max_retries - 1:
                    wait_time = 2 ** attempt
                    await asyncio.sleep(wait_time)
                    continue
                raise
        
        raise Exception("TTS流式请求失败，已达到最大重试次数")
    
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


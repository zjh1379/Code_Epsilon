"""
Chat API endpoints
Handles chat requests with streaming response
"""
import base64
import json
import logging
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from app.models.chat import ChatRequest
from app.services.llm_service import llm_service
from app.services.tts_service import tts_service
from app.services.character_service import character_service

logger = logging.getLogger(__name__)

router = APIRouter()


async def generate_chat_stream(request: ChatRequest):
    """
    Generate streaming chat response via SSE.
    Streams text chunks first, then audio chunks (base64-encoded).
    """
    full_text = ""
    
    try:
        current_character = character_service.get_current_character()
        system_prompt = current_character.system_prompt
        
        # 1) Stream LLM response
        async for chunk in llm_service.stream_chat(
            message=request.message,
            history=request.history,
            system_prompt=system_prompt
        ):
            full_text += chunk
            yield f"data: {json.dumps({'type': 'text', 'content': chunk}, ensure_ascii=False)}\n\n"
        
        # 2) Send completion message
        yield f"data: {json.dumps({'type': 'complete', 'text': full_text}, ensure_ascii=False)}\n\n"
        
        # 3) Stream audio via GPT-SoVITS
        try:
            yield f"data: {json.dumps({'type': 'audio_start'}, ensure_ascii=False)}\n\n"
            
            chunk_index = 0
            async for audio_chunk in tts_service.stream_text_to_speech(
                text=full_text,
                text_lang=request.config.text_lang,
                ref_audio_path=request.config.ref_audio_path,
                prompt_text=request.config.prompt_text,
                prompt_lang=request.config.prompt_lang,
                streaming_mode=request.config.streaming_mode,
                media_type=request.config.media_type,
                text_split_method=request.config.text_split_method,
                top_k=request.config.top_k,
                top_p=request.config.top_p,
                temperature=request.config.temperature,
                speed_factor=request.config.speed_factor,
                fragment_interval=request.config.fragment_interval,
                aux_ref_audio_paths=request.config.aux_ref_audio_paths
            ):
                audio_chunk_base64 = base64.b64encode(audio_chunk).decode("utf-8")
                yield f"data: {json.dumps({'type': 'audio_chunk', 'data': audio_chunk_base64, 'index': chunk_index, 'size': len(audio_chunk)}, ensure_ascii=False)}\n\n"
                chunk_index += 1
            
            yield f"data: {json.dumps({'type': 'audio_complete', 'total_chunks': chunk_index}, ensure_ascii=False)}\n\n"
        
        except Exception as e:
            logger.error(f"TTS streaming error: {str(e)}")
            logger.error(f"TTS config: text_lang={request.config.text_lang}, prompt_lang={request.config.prompt_lang}, ref_audio_path={request.config.ref_audio_path}")
            yield f"data: {json.dumps({'type': 'error', 'error': f'音频生成失败: {str(e)}'}, ensure_ascii=False)}\n\n"
    
    except Exception as e:
        logger.error(f"Chat stream error: {str(e)}")
        yield f"data: {json.dumps({'type': 'error', 'error': f'生成回复时出现错误: {str(e)}'}, ensure_ascii=False)}\n\n"


@router.post("/chat")
async def chat(request: ChatRequest):
    """
    Chat endpoint with streaming response
    
    Returns Server-Sent Events stream with:
    - text chunks during generation
    - complete message when done
    - audio data when TTS completes
    """
    # Validate request
    if not request.message or not request.message.strip():
        raise HTTPException(status_code=400, detail="消息内容不能为空")
    
    if not request.config.ref_audio_path:
        raise HTTPException(status_code=400, detail="参考音频路径不能为空")
    
    if request.config.text_lang not in ["zh", "en", "ja", "ko", "yue"]:
        raise HTTPException(status_code=400, detail="不支持的语言类型")
    
    if request.config.streaming_mode not in [0, 1, 2, 3]:
        raise HTTPException(status_code=400, detail="streaming_mode必须是0/1/2/3")
    
    if request.config.media_type not in ["wav", "raw", "ogg", "aac", "fmp4"]:
        raise HTTPException(status_code=400, detail="不支持的media_type，支持: wav, raw, ogg, aac, fmp4")
    
    return StreamingResponse(
        generate_chat_stream(request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


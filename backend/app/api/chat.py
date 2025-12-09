"""
Chat API endpoints
Handles chat requests with streaming response
"""
import json
import logging
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from app.models.chat import ChatRequest, ChatResponse
from app.services.llm_service import llm_service
from app.services.tts_service import tts_service
from app.services.character_service import character_service

logger = logging.getLogger(__name__)

router = APIRouter()


async def generate_chat_stream(request: ChatRequest):
    """
    Generate streaming chat response
    
    Yields SSE formatted messages for text chunks, completion, and audio
    """
    full_text = ""
    
    try:
        # Get current active character's system prompt
        current_character = character_service.get_current_character()
        system_prompt = current_character.system_prompt
        
        # Stream LLM response with system prompt
        async for chunk in llm_service.stream_chat(
            message=request.message,
            history=request.history,
            system_prompt=system_prompt
        ):
            full_text += chunk
            # Send text chunk via SSE
            response_data = {
                "type": "text",
                "content": chunk
            }
            yield f"data: {json.dumps(response_data, ensure_ascii=False)}\n\n"
        
        # Send completion message with full text
        complete_data = {
            "type": "complete",
            "text": full_text
        }
        yield f"data: {json.dumps(complete_data, ensure_ascii=False)}\n\n"
        
        # Generate audio using TTS
        try:
            audio_data = await tts_service.text_to_speech(
                text=full_text,
                text_lang=request.config.text_lang,
                ref_audio_path=request.config.ref_audio_path,
                prompt_text=request.config.prompt_text,
                prompt_lang=request.config.prompt_lang,
                text_split_method=request.config.text_split_method,
                speed_factor=request.config.speed_factor,
                fragment_interval=request.config.fragment_interval,
                top_k=request.config.top_k,
                top_p=request.config.top_p,
                temperature=request.config.temperature,
                aux_ref_audio_paths=request.config.aux_ref_audio_paths
            )
            
            if audio_data:
                audio_response = {
                    "type": "audio",
                    "data": audio_data
                }
                yield f"data: {json.dumps(audio_response, ensure_ascii=False)}\n\n"
            else:
                # TTS failed but text was generated successfully
                error_response = {
                    "type": "error",
                    "error": "音频生成失败，但文本回复已生成。请检查GPT-SoVITS服务日志或配置参数。"
                }
                yield f"data: {json.dumps(error_response, ensure_ascii=False)}\n\n"
        
        except Exception as e:
            logger.error(f"TTS error: {str(e)}")
            logger.error(f"TTS config: text_lang={request.config.text_lang}, prompt_lang={request.config.prompt_lang}, ref_audio_path={request.config.ref_audio_path}")
            # Don't fail the whole request if TTS fails
            error_response = {
                "type": "error",
                "error": f"音频生成失败: {str(e)}"
            }
            yield f"data: {json.dumps(error_response, ensure_ascii=False)}\n\n"
    
    except Exception as e:
        logger.error(f"Chat stream error: {str(e)}")
        error_response = {
            "type": "error",
            "error": f"生成回复时出现错误: {str(e)}"
        }
        yield f"data: {json.dumps(error_response, ensure_ascii=False)}\n\n"


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
    
    return StreamingResponse(
        generate_chat_stream(request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


"""
Chat API endpoints
Handles chat requests with streaming response
"""
import base64
import json
import logging
import uuid
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from app.models.chat import ChatRequest
from app.services.llm_service import llm_service
from app.services.tts_service import tts_service
from app.services.character_service import character_service
from app.services.memory_service import get_memory_service
from app.services.history_service import history_service
from app.services.context_builder import ContextBuilder
from app.services.session_service import SessionService
from app.services.summarizer import summarizer
from app.services.token_counter import TokenCounter
from app.services.character_state import character_state_service
from app.services.response_processor import ResponseProcessor
from app.config import settings
from app.database import get_db

logger = logging.getLogger(__name__)

router = APIRouter()

_session_service = SessionService()
_token_counter = TokenCounter(
    provider=settings.llm_provider,
    model=settings.openai_model,
)
_context_builder = ContextBuilder(
    token_counter=_token_counter,
    session_service=_session_service,
    max_tokens=settings.context_max_tokens,
    output_reserved=settings.context_output_reserved,
    character_prompt_ceiling=settings.context_character_prompt_ceiling,
    memory_ceiling=settings.context_memory_ceiling,
    summary_ceiling=settings.context_summary_ceiling,
)
_response_processor = ResponseProcessor(
    session_service=_session_service,
    character_state_service=character_state_service,
)


def _apply_emotion_to_tts(
    speed_factor: float,
    fragment_interval: float,
    emotion: str,
) -> tuple[float, float]:
    """Apply lightweight emotion-based modulation to TTS parameters."""
    speed = speed_factor
    interval = fragment_interval

    if emotion == "energetic":
        speed *= 1.08
        interval *= 0.90
    elif emotion == "empathetic":
        speed *= 0.95
        interval *= 1.10
    elif emotion == "focused":
        interval *= 0.95

    speed = max(0.75, min(1.25, speed))
    interval = max(0.15, min(0.60, interval))
    return speed, interval


async def _cleanup_stale_sessions(db: Session, max_idle_seconds: int = 600) -> None:
    """Generate end-of-session summaries and cleanup stale in-memory sessions."""
    stale_ids = _session_service.get_stale_sessions(max_idle_seconds=max_idle_seconds)
    for stale_id in stale_ids:
        session = _session_service.get_session(stale_id)
        if session is None:
            continue
        try:
            db_messages = history_service.get_messages(db, stale_id)
            history_dicts = [{"role": m.role, "content": m.content} for m in db_messages]
            summary = await summarizer.generate_end_of_session_summary(
                conversation_id=stale_id,
                user_id=session.user_id,
                character_id=session.character_id,
                messages=history_dicts,
                db=db,
            )
            if summary:
                character_state_service.set_last_summary(
                    db=db,
                    user_id=session.user_id,
                    character_id=session.character_id,
                    summary_id=summary.id,
                )
        except Exception as e:
            logger.warning(f"Failed stale session cleanup for {stale_id}: {str(e)}")
        finally:
            _session_service.remove_session(stale_id)


async def generate_chat_stream(request: ChatRequest, db: Session):
    """
    Generate streaming chat response via SSE.
    Streams text chunks first, then audio chunks (base64-encoded).
    Integrated with memory system for context retrieval and storage.
    """
    full_text = ""
    await _cleanup_stale_sessions(db, max_idle_seconds=600)
    
    # Generate user_id and conversation_id if not provided
    user_id = request.user_id or "default_user"
    conversation_id = request.conversation_id or f"conv_{uuid.uuid4().hex[:8]}"
    
    # Persist conversation and user message to SQLite
    try:
        history_service.create_conversation(db, user_id=user_id, conversation_id=conversation_id)
        history_service.add_message(db, conversation_id=conversation_id, role="user", content=request.message)
    except Exception as e:
        logger.error(f"Failed to persist user message: {str(e)}")

    try:
        current_character = character_service.get_current_character()
        system_prompt = current_character.system_prompt
        character_id = current_character.id if hasattr(current_character, 'id') else "epsilon"
        
        # Query memory context if memory service is available
        memory_context = ""
        memory_service = get_memory_service()
        if memory_service and user_id:
            try:
                memory_context = await memory_service.query_related_context(
                    user_id=user_id,
                    query_text=request.message,
                    limit=10
                )
                if memory_context:
                    logger.info(f"Retrieved memory context for user {user_id}: {len(memory_context)} chars")
            except Exception as e:
                logger.warning(f"Failed to query memory context: {str(e)}")
                # Continue without memory context if query fails
        
        is_new_session = _session_service.get_session(conversation_id) is None
        if is_new_session:
            state = character_state_service.mark_conversation_start(db, user_id, character_id)
        else:
            state = character_state_service.get_or_create(db, user_id, character_id)
        character_state_context = character_state_service.build_prompt_context(state)

        built = await _context_builder.build(
            user_message=request.message,
            conversation_id=conversation_id,
            user_id=user_id,
            character_id=character_id,
            raw_history=request.history,
            system_prompt=system_prompt,
            memory_context=memory_context if memory_context else None,
            character_state_context=character_state_context,
        )

        logger.info(
            "Context: %s tokens, %s msgs included, %s excluded",
            built.metadata.total_tokens,
            built.metadata.messages_included,
            built.metadata.messages_excluded,
        )

        session = _session_service.get_session(conversation_id)
        if (
            session
            and session.message_count > 0
            and session.message_count % settings.context_rolling_threshold == 0
        ):
            history_dicts = [{"role": m.role, "content": m.content} for m in request.history]
            new_summary, _ = await summarizer.maybe_rolling_summarize(
                messages=history_dicts,
                existing_summary=session.rolling_summary,
            )
            if new_summary and new_summary != session.rolling_summary:
                _session_service.set_rolling_summary(conversation_id, new_summary)
                logger.info("Rolling summary updated for %s", conversation_id)

        # 1) Stream LLM response with built context
        async for chunk in llm_service.astream_from_messages(built.messages):
            full_text += chunk
            yield f"data: {json.dumps({'type': 'text', 'content': chunk}, ensure_ascii=False)}\n\n"
        
        # 2) Send completion message
        yield f"data: {json.dumps({'type': 'complete', 'text': full_text}, ensure_ascii=False)}\n\n"
        
        # Persist assistant message to SQLite
        try:
            history_service.add_message(db, conversation_id=conversation_id, role="assistant", content=full_text)
        except Exception as e:
            logger.error(f"Failed to persist assistant message: {str(e)}")

        processed = await _response_processor.process_turn(
            db=db,
            conversation_id=conversation_id,
            user_id=user_id,
            character_id=character_id,
            user_message=request.message,
            assistant_text=full_text,
            history_messages=[{"role": m.role, "content": m.content} for m in request.history],
        )
        tts_speed, tts_interval = _apply_emotion_to_tts(
            speed_factor=request.config.speed_factor,
            fragment_interval=request.config.fragment_interval,
            emotion=processed.emotion,
        )
        
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
                speed_factor=tts_speed,
                fragment_interval=tts_interval,
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
async def chat(request: ChatRequest, db: Session = Depends(get_db)):
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
    
    if request.config.media_type not in ["wav", "raw", "ogg", "aac"]:
        raise HTTPException(status_code=400, detail="不支持的media_type，支持: wav, raw, ogg, aac")
    
    return StreamingResponse(
        generate_chat_stream(request, db),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


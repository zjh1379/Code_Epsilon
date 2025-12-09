"""
LLM service wrapper using LangChain
Handles OpenAI API integration via LangChain
"""
import logging
from typing import AsyncIterator, List, Optional
from langchain_openai import ChatOpenAI
from app.config import settings
from app.models.chat import Message

logger = logging.getLogger(__name__)


class LLMService:
    """Service for LLM integration using LangChain with OpenAI API"""
    
    def __init__(self):
        self.llm: Optional[ChatOpenAI] = None
        self._initialized = False
    
    def _initialize_llm(self):
        """Initialize LLM model using OpenAI API"""
        if self._initialized:
            return
        
        try:
            # Check for OpenAI API key
            if not settings.openai_api_key:
                logger.error("OPENAI_API_KEY not configured in .env file")
                raise ValueError("OPENAI_API_KEY is required")
            
            # Initialize OpenAI Chat model
            self.llm = ChatOpenAI(
                openai_api_key=settings.openai_api_key,
                model=settings.openai_model,
                temperature=0.7,
                streaming=True,
                verbose=True
            )
            
            self._initialized = True
            logger.info(f"OpenAI LLM initialized: {settings.openai_model}")
            
        except Exception as e:
            logger.error(f"Failed to initialize OpenAI LLM: {str(e)}")
            raise
    
    def _build_messages_from_history(
        self, 
        history: List[Message], 
        current_message: str,
        system_prompt: Optional[str] = None
    ) -> List[dict]:
        """Build messages list for OpenAI API from history"""
        messages = []
        
        # Add system prompt if provided
        if system_prompt:
            messages.append({
                "role": "system",
                "content": system_prompt
            })
        
        # Add history messages
        for msg in history:
            role = "user" if msg.role == "user" else "assistant"
            messages.append({
                "role": role,
                "content": msg.content
            })
        
        # Add current message
        messages.append({
            "role": "user",
            "content": current_message
        })
        
        return messages
    
    async def stream_chat(
        self,
        message: str,
        history: List[Message] = None,
        system_prompt: Optional[str] = None
    ) -> AsyncIterator[str]:
        """
        Stream chat response from OpenAI API
        
        Args:
            message: User message
            history: Conversation history
            system_prompt: System prompt from current character
            
        Yields:
            Text chunks as they are generated
        """
        if not self._initialized:
            self._initialize_llm()
        
        try:
            # Build messages list for OpenAI API with system prompt
            messages = self._build_messages_from_history(
                history or [], 
                message,
                system_prompt=system_prompt
            )
            
            # Stream response from OpenAI
            async for chunk in self.llm.astream(messages):
                # Handle different chunk types
                if hasattr(chunk, 'content'):
                    content = chunk.content
                    if content:
                        yield content
                elif isinstance(chunk, str):
                    yield chunk
                elif hasattr(chunk, 'text'):
                    yield chunk.text
        
        except Exception as e:
            logger.error(f"Error in stream_chat: {str(e)}")
            yield f"抱歉，生成回复时出现错误: {str(e)}"
    
    async def chat(
        self,
        message: str,
        history: List[Message] = None,
        system_prompt: Optional[str] = None
    ) -> str:
        """
        Get complete chat response from OpenAI API (non-streaming)
        
        Args:
            message: User message
            history: Conversation history
            system_prompt: System prompt from current character
            
        Returns:
            Complete response text
        """
        if not self._initialized:
            self._initialize_llm()
        
        try:
            # Build messages list for OpenAI API with system prompt
            messages = self._build_messages_from_history(
                history or [], 
                message,
                system_prompt=system_prompt
            )
            
            # Get response from OpenAI
            response = await self.llm.ainvoke(messages)
            
            if hasattr(response, 'content'):
                return response.content
            return str(response)
        
        except Exception as e:
            logger.error(f"Error in chat: {str(e)}")
            return f"抱歉，生成回复时出现错误: {str(e)}"


# Global LLM service instance
llm_service = LLMService()


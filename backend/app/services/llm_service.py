"""
LLM service wrapper using LangChain
Handles OpenAI API integration via LangChain
"""
import logging
from typing import AsyncIterator, List, Optional, Dict
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
try:
    from langchain_google_genai import ChatGoogleGenerativeAI
except ImportError:
    ChatGoogleGenerativeAI = None

from app.config import settings
from app.models.chat import Message

logger = logging.getLogger(__name__)


class LLMService:
    """Service for LLM integration using LangChain with OpenAI and Gemini support"""
    
    # Available models configuration
    AVAILABLE_MODELS = [
        {"id": "gpt-3.5-turbo", "name": "GPT-3.5 Turbo", "provider": "openai"},
        {"id": "gpt-4o", "name": "GPT-4o", "provider": "openai"},
        {"id": "gemini-3-pro", "name": "Gemini 3 Pro", "provider": "gemini"},
        {"id": "gemini-2.5-flash", "name": "Gemini 2.5 Flash", "provider": "gemini"},
        {"id": "gemini-2.5-flash-tts", "name": "Gemini 2.5 Flash TTS", "provider": "gemini"},
        {"id": "gemini-1.5-pro", "name": "Gemini 1.5 Pro", "provider": "gemini"},
    ]

    def __init__(self):
        self.llm = None
        self.embeddings: Optional[OpenAIEmbeddings] = None
        self._initialized = False
        self.current_provider = settings.llm_provider
        self.current_model = settings.openai_model
    
    def _initialize_llm(self):
        """Initialize LLM model based on configuration"""
        try:
            # Initialize Embeddings (Always prefer OpenAI for vector DB consistency)
            if settings.openai_api_key:
                self.embeddings = OpenAIEmbeddings(
                    openai_api_key=settings.openai_api_key,
                    model="text-embedding-3-small"
                )
            
            # Initialize Chat Model
            if self.current_provider == "gemini":
                if not settings.gemini_api_key:
                    raise ValueError("GEMINI_API_KEY is required for Gemini models")
                
                if ChatGoogleGenerativeAI is None:
                    raise ImportError("langchain-google-genai is not installed")
                
                self.llm = ChatGoogleGenerativeAI(
                    google_api_key=settings.gemini_api_key,
                    model=self.current_model,
                    temperature=0.7,
                    convert_system_message_to_human=True # Gemini sometimes needs this
                )
                logger.info(f"Gemini LLM initialized: {self.current_model}")
                
            else: # Default to OpenAI
                if not settings.openai_api_key:
                    raise ValueError("OPENAI_API_KEY is required for OpenAI models")
                
                self.llm = ChatOpenAI(
                    openai_api_key=settings.openai_api_key,
                    model=self.current_model,
                    temperature=0.7,
                    streaming=True,
                    verbose=True
                )
                logger.info(f"OpenAI LLM initialized: {self.current_model}")
            
            self._initialized = True
            
        except Exception as e:
            logger.error(f"Failed to initialize LLM: {str(e)}")
            # Don't raise here to allow re-configuration
            self._initialized = False

    def get_available_models(self) -> List[Dict[str, str]]:
        """Return list of available models"""
        return self.AVAILABLE_MODELS

    def set_model(self, provider: str, model_id: str):
        """Switch model at runtime"""
        self.current_provider = provider
        self.current_model = model_id
        self._initialized = False
        self._initialize_llm()

    async def get_embedding(self, text: str) -> List[float]:
        """Get embedding for text"""
        if not self.embeddings:
            # Try to init if not ready
            self._initialize_llm()
            if not self.embeddings:
                logger.warning("Embeddings not initialized (missing OpenAI Key)")
                return []
            
        try:
            return await self.embeddings.aembed_query(text)
        except Exception as e:
            logger.error(f"Failed to get embedding: {str(e)}")
            return []
    
    def _build_messages_from_history(
        self, 
        history: List[Message], 
        current_message: str,
        system_prompt: Optional[str] = None,
        memory_context: Optional[str] = None
    ) -> List[dict]:
        """
        Build messages list for OpenAI API from history
        
        Args:
            history: Conversation history
            current_message: Current user message
            system_prompt: System prompt from character
            memory_context: Memory context from graph database (optional)
        """
        messages = []
        
        # Build enhanced system prompt with memory context
        enhanced_system_prompt = system_prompt or ""
        if memory_context:
            memory_section = f"\n\n## 相关记忆信息\n{memory_context}\n\n请根据以上记忆信息，在回复中自然地引用相关信息，体现你对用户的了解。"
            enhanced_system_prompt = enhanced_system_prompt + memory_section
        
        # Add system prompt if provided
        if enhanced_system_prompt:
            messages.append({
                "role": "system",
                "content": enhanced_system_prompt
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
        system_prompt: Optional[str] = None,
        memory_context: Optional[str] = None
    ) -> AsyncIterator[str]:
        """
        Stream chat response from OpenAI API
        
        Args:
            message: User message
            history: Conversation history
            system_prompt: System prompt from current character
            memory_context: Memory context from graph database (optional)
            
        Yields:
            Text chunks as they are generated
        """
        if not self._initialized:
            self._initialize_llm()
        
        try:
            # Build messages list for OpenAI API with system prompt and memory context
            messages = self._build_messages_from_history(
                history or [], 
                message,
                system_prompt=system_prompt,
                memory_context=memory_context
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
        system_prompt: Optional[str] = None,
        memory_context: Optional[str] = None
    ) -> str:
        """
        Get complete chat response from OpenAI API (non-streaming)
        
        Args:
            message: User message
            history: Conversation history
            system_prompt: System prompt from current character
            memory_context: Memory context from graph database (optional)
            
        Returns:
            Complete response text
        """
        if not self._initialized:
            self._initialize_llm()
        
        try:
            # Build messages list for OpenAI API with system prompt and memory context
            messages = self._build_messages_from_history(
                history or [], 
                message,
                system_prompt=system_prompt,
                memory_context=memory_context
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


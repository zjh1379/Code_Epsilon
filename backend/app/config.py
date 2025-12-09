"""
Configuration management module
Loads environment variables and provides configuration settings
"""
import os
from typing import Optional
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""
    
    # GPT-SoVITS API Configuration
    gpt_sovits_base_url: str = "http://127.0.0.1:9880"
    
    # LLM Configuration
    openai_api_key: Optional[str] = None
    openai_model: str = "gpt-3.5-turbo"
    llm_model_path: Optional[str] = None
    llm_model_type: str = "openai"
    
    # Frontend Configuration
    frontend_url: str = "http://localhost:5173"
    
    # Server Configuration
    host: str = "0.0.0.0"
    port: int = 8000
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


# Global settings instance
settings = Settings()


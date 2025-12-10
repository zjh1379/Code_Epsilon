"""
Configuration management module
Loads environment variables and provides configuration settings
"""
from typing import Optional
from pydantic_settings import BaseSettings
from pydantic import ConfigDict
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""
    
    # GPT-SoVITS API Configuration
    gpt_sovits_base_url: str = "http://127.0.0.1:9880"
    
    # LLM Configuration
    openai_api_key: Optional[str] = None
    gemini_api_key: Optional[str] = None
    openai_model: str = "gpt-3.5-turbo" # Current selected model name
    llm_provider: str = "openai" # "openai" or "gemini"
    llm_model_path: Optional[str] = None
    llm_model_type: str = "openai" # Deprecated, use llm_provider
    
    # Frontend Configuration
    frontend_url: str = "http://localhost:5173"
    
    # Server Configuration
    host: str = "0.0.0.0"
    port: int = 8000
    
    # Graph Memory Configuration (Phase 3B)
    graph_memory_enabled: bool = False  # Default disabled, enable via env var
    neo4j_uri: str = "neo4j+s://c9810bad.databases.neo4j.io"  # Neo4j Aura encrypted connection
    neo4j_username: str = "neo4j"  # Maps to NEO4J_USERNAME env var
    neo4j_password: str = ""  # Load from env var, do not hardcode
    neo4j_database: str = "neo4j"
    
    @property
    def neo4j_user(self) -> str:
        """Backward compatibility alias for neo4j_username"""
        return self.neo4j_username
    
    model_config = ConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"  # Ignore extra environment variables
    )


# Global settings instance
settings = Settings()


"""
Audio utility functions
"""
import base64
import tempfile
import os
from typing import Optional


def save_audio_from_base64(audio_base64: str, output_path: Optional[str] = None) -> str:
    """
    Save base64 encoded audio data to file
    
    Args:
        audio_base64: Base64 encoded audio data
        output_path: Optional output file path. If None, creates temp file
        
    Returns:
        Path to saved audio file
    """
    audio_data = base64.b64decode(audio_base64)
    
    if output_path:
        with open(output_path, 'wb') as f:
            f.write(audio_data)
        return output_path
    else:
        # Create temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as f:
            f.write(audio_data)
            return f.name


def load_audio_to_base64(audio_path: str) -> str:
    """
    Load audio file and convert to base64
    
    Args:
        audio_path: Path to audio file
        
    Returns:
        Base64 encoded audio data
    """
    with open(audio_path, 'rb') as f:
        audio_data = f.read()
        return base64.b64encode(audio_data).decode('utf-8')


def cleanup_temp_audio_file(file_path: str):
    """
    Delete temporary audio file
    
    Args:
        file_path: Path to file to delete
    """
    try:
        if os.path.exists(file_path):
            os.remove(file_path)
    except Exception:
        pass  # Ignore errors during cleanup


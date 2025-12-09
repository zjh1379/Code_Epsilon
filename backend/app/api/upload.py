"""
File upload API endpoints
Handles audio file uploads
"""
import os
import logging
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)

router = APIRouter()

# Create uploads directory if it doesn't exist
# Use absolute path relative to backend directory
BASE_DIR = Path(__file__).parent.parent.parent
UPLOAD_DIR = BASE_DIR / "uploads" / "audio"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


@router.post("/upload/audio")
async def upload_audio(file: UploadFile = File(...)):
    """
    Upload audio file and return absolute path
    
    Args:
        file: Audio file to upload
        
    Returns:
        Absolute path to saved file
    """
    # Validate file type
    allowed_extensions = ['.wav', '.mp3', '.flac', '.ogg', '.m4a']
    file_ext = Path(file.filename).suffix.lower()
    
    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"不支持的文件格式。支持的格式: {', '.join(allowed_extensions)}"
        )
    
    try:
        # Generate unique filename to avoid conflicts
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        original_name = Path(file.filename).stem
        saved_filename = f"{original_name}_{unique_id}{file_ext}"
        file_path = UPLOAD_DIR / saved_filename
        
        # Save file
        with open(file_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
        
        # Get absolute path
        absolute_path = str(file_path.resolve())
        
        logger.info(f"Audio file uploaded: {absolute_path}")
        
        return JSONResponse({
            "success": True,
            "file_path": absolute_path,
            "filename": saved_filename
        })
    
    except Exception as e:
        logger.error(f"Error uploading file: {str(e)}")
        raise HTTPException(status_code=500, detail=f"文件上传失败: {str(e)}")


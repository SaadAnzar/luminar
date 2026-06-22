from openai import AsyncOpenAI
import io
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

async def transcribe_audio(audio_bytes: bytes, filename: str = "audio.mp3") -> str:
    """
    Transcribes audio bytes to text using OpenAI Whisper.
    """
    try:
        # Create a file-like object
        audio_file = io.BytesIO(audio_bytes)
        audio_file.name = filename
        
        transcript = await client.audio.transcriptions.create(
            model="whisper-1", 
            file=audio_file,
            response_format="text"
        )
        return transcript
    except Exception as e:
        logger.error(f"Whisper transcription failed: {e}")
        raise e

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


# Whisper's upload limit is 25 MB; leave headroom for multipart overhead.
WHISPER_MAX_BYTES = 24 * 1024 * 1024


class TranscriptionError(Exception):
    """Raised when a video can't be turned into a timed transcript."""


def _extract_audio(video_bytes: bytes, suffix: str) -> bytes:
    """Pull a small mono MP3 track out of a video with ffmpeg (installed in the
    backend Docker image). Keeps long videos under Whisper's size limit."""
    import shutil
    import subprocess
    import tempfile
    from pathlib import Path

    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise TranscriptionError("This video is too large to transcribe directly and ffmpeg isn't available on the server.")
    with tempfile.TemporaryDirectory() as tmp:
        src = Path(tmp) / f"input{suffix}"
        out = Path(tmp) / "audio.mp3"
        src.write_bytes(video_bytes)
        proc = subprocess.run(
            [ffmpeg, "-nostdin", "-y", "-i", str(src), "-vn", "-ac", "1", "-ar", "16000", "-b:a", "32k", str(out)],
            capture_output=True,
            timeout=600,
        )
        if proc.returncode != 0 or not out.exists():
            raise TranscriptionError("Couldn't read the audio track from this video.")
        return out.read_bytes()


async def transcribe_segments(video_bytes: bytes, filename: str) -> list[dict]:
    """Transcribe a video/audio file into timed segments [{text, start, duration}]
    (seconds), the same shape as YouTube caption segments."""
    import asyncio
    from pathlib import Path

    suffix = Path(filename).suffix.lower() or ".mp4"
    audio, name = video_bytes, f"upload{suffix}"
    if len(video_bytes) > WHISPER_MAX_BYTES:
        audio = await asyncio.to_thread(_extract_audio, video_bytes, suffix)
        name = "audio.mp3"
        if len(audio) > WHISPER_MAX_BYTES:
            raise TranscriptionError("This video is too long to transcribe (audio over 24 MB).")

    audio_file = io.BytesIO(audio)
    audio_file.name = name
    try:
        result = await client.audio.transcriptions.create(
            model="whisper-1",
            file=audio_file,
            response_format="verbose_json",
            timestamp_granularities=["segment"],
        )
    except Exception as e:
        logger.error(f"Whisper segment transcription failed: {e}")
        raise TranscriptionError("Transcription failed — try again, or use a shorter video.") from e

    segments = [
        {"text": s.text.strip(), "start": float(s.start), "duration": float(s.end) - float(s.start)}
        for s in (result.segments or [])
        if (s.text or "").strip()
    ]
    if not segments:
        raise TranscriptionError("No speech was found in this video.")
    return segments

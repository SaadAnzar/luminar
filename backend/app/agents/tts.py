from openai import AsyncOpenAI
import io
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

VOICE_MAP = {
    "calm_tutor": "nova",
    "energetic": "echo",
    "professional": "onyx",
    "friendly": "alloy",
    "teacher": "nova",    # dialogue teacher voice
    "student": "shimmer", # dialogue student voice
}

async def generate_tts(narration: str, voice_style: str | None,
                        speaker_a: str | None, speaker_b: str | None) -> tuple[bytes, int]:
    """Returns (audio_bytes, duration_ms)."""
    if speaker_a and speaker_b:
        # Dialogue mode: parse turns and stitch audio
        # Note: pydub requires ffmpeg installed
        return await _generate_dialogue_tts(narration, speaker_a, speaker_b)

    voice = VOICE_MAP.get(voice_style or "friendly", "alloy")
    response = await client.audio.speech.create(
        model="tts-1-hd",
        voice=voice,
        input=narration,
        response_format="mp3",
    )
    audio_bytes = response.content
    # Estimate duration: TTS-1-HD averages ~130 words/min
    word_count = len(narration.split())
    duration_ms = int((word_count / 130) * 60 * 1000)
    return audio_bytes, duration_ms

async def _generate_dialogue_tts(narration: str, speaker_a: str, speaker_b: str):
    """Parse [Teacher]: / [Student]: tags and interleave audio."""
    import re
    from pydub import AudioSegment

    turns = re.findall(r'\[(Teacher|Student)\]:\s*(.+?)(?=\[(?:Teacher|Student)\]:|$)',
                       narration, re.DOTALL)
    segments = []
    total_duration = 0
    for speaker, text in turns:
        voice = VOICE_MAP["teacher"] if speaker == "Teacher" else VOICE_MAP["student"]
        response = await client.audio.speech.create(
            model="tts-1-hd", voice=voice, input=text.strip(), response_format="mp3"
        )
        seg = AudioSegment.from_mp3(io.BytesIO(response.content))
        segments.append(seg)
        total_duration += len(seg)

    if not segments:
        return b"", 0

    combined = segments[0]
    for seg in segments[1:]:
        combined += seg

    buf = io.BytesIO()
    combined.export(buf, format="mp3")
    return buf.getvalue(), total_duration
    
# For fallback if pydub/ffmpeg is missing or fails
async def generate_simple_tts(narration: str, voice_style: str | None) -> tuple[bytes, int]:
    voice = VOICE_MAP.get(voice_style or "friendly", "alloy")
    response = await client.audio.speech.create(
        model="tts-1-hd",
        voice=voice,
        input=narration,
        response_format="mp3",
    )
    audio_bytes = response.content
    word_count = len(narration.split())
    duration_ms = int((word_count / 130) * 60 * 1000)
    return audio_bytes, duration_ms

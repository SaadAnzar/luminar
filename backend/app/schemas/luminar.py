from pydantic import BaseModel, ConfigDict
import uuid
from datetime import datetime


class CaptionSegmentOut(BaseModel):
    text: str
    start_ms: int
    end_ms: int


class QuizCardBrief(BaseModel):
    id: str
    question: str
    options: list[str]
    hint: str | None = None
    difficulty: str = "medium"
    trigger_at_ms: int | None = None


class SceneOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    scene_index: int
    title: str | None = None
    narration_text: str | None = None
    caption_segments: list[dict] | None = None
    svg_url: str | None = None
    audio_url: str | None = None
    duration_ms: int | None = None
    dialogue_mode: bool = False
    visual_style: str = "concept_diagram"


class LuminarInDB(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    title: str
    prompt: str
    description: str | None = None
    source_type: str = "none"
    source_url: str | None = None
    duration_minutes: int
    dialogue_mode: bool
    voice_style: str
    status: str
    published: bool = False
    full_script: list | None = None
    key_concepts: list | None = None
    suggested_next_topics: list | None = None
    difficulty_hint: str = "medium"
    created_at: datetime
    updated_at: datetime

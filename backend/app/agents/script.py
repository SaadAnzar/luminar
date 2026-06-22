from pydantic import BaseModel, ConfigDict
from pydantic_ai import Agent


class CaptionSegment(BaseModel):
    text: str
    start_ms: int
    end_ms: int


class SceneScript(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    scene_index: int
    # Full narration with [VISUAL_CUE: ...] tags and optional [Teacher]/[Student] turns
    narration: str
    # Plain narration (no tags) split into caption segments at ~130wpm
    caption_segments: list[CaptionSegment]
    estimated_duration_ms: int


class FullScript(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    scenes: list[SceneScript]


script_agent = Agent(
    model="openai:gpt-4o",
    output_type=FullScript,
    system_prompt="""
    You are an expert educational scriptwriter for an interactive lesson platform.
    You turn a scene blueprint into spoken narration that is warm, vivid, and
    genuinely clear — the voice of a great teacher, not a textbook.

    The request states a TOTAL WORD BUDGET (a min–max range) for the whole script.
    Distribute words across scenes so the SUM lands inside that range — this
    controls the final audio length. Do not undershoot or overshoot it.

    For each scene:
    1. `narration` (~130 words/minute):
       - Open with a concrete hook, explain ONE idea, use a quick example or
         analogy, and lead into the next scene. Speak directly to the learner
         ("you"). Plain language; define any term the first time it appears.
       - Embed [VISUAL_CUE: <specific, concrete instruction>] inline at the moment
         each visual should appear — name the objects, labels, and motion you want
         (e.g. "[VISUAL_CUE: draw three boxes labelled Input, Model, Output; an
         arrow flows left-to-right and pulses]"). These drive the animation, so be
         specific and sequence them with the narration beats.
       - Dialogue scenes only: format turns as
           [Teacher]: <text>
           [Student]: <text>
    2. `caption_segments`: the narration split into short phrases (3–8 words),
       start_ms/end_ms at 130 wpm (1 word ≈ 461 ms). Captions must NOT contain
       [VISUAL_CUE:...] or [Teacher]/[Student] tags — strip them.
    3. `estimated_duration_ms`: total narration duration in ms (words × 461).

    Caption timing example for "The stack grows upward":
      [{text: "The stack", start_ms: 0, end_ms: 923},
       {text: "grows upward", start_ms: 923, end_ms: 1846}]
    """,
)


def build_caption_segments(plain_text: str) -> list[dict]:
    """Fallback: split plain text into 5-word chunks at 130wpm if agent output is missing."""
    words = plain_text.split()
    ms_per_word = 461  # 130wpm ≈ 461ms/word
    chunks: list[dict] = []
    chunk_size = 5
    for i in range(0, len(words), chunk_size):
        chunk = words[i:i + chunk_size]
        start_ms = i * ms_per_word
        end_ms = (i + len(chunk)) * ms_per_word
        chunks.append({"text": " ".join(chunk), "start_ms": start_ms, "end_ms": end_ms})
    return chunks

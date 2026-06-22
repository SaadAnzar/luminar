from pydantic import BaseModel
from pydantic_ai import Agent
from typing import Literal


class QuizCardOutput(BaseModel):
    question: str
    options: list[str]       # Exactly 4 options
    correct_index: int       # 0–3
    hint: str
    explanation: str
    difficulty: Literal["easy", "medium", "hard"]


class QuizSetOutput(BaseModel):
    cards: list[QuizCardOutput]


quiz_agent = Agent(
    model="openai:gpt-4o",
    output_type=QuizSetOutput,
    system_prompt="""
    You create multiple-choice quiz questions for educational videos.

    You will be given a scene topic, narration text, and a required question count.
    Generate exactly that many questions — no more, no fewer.

    Rules:
    - Questions must test genuine comprehension, not trivial recall.
    - All 4 options must be plausible (no obviously wrong distractors).
    - Hint should nudge without giving away the answer.
    - Explanation: 2–3 sentences clarifying why the correct answer is right
      and why the top distractor is wrong.
    - Distribute difficulty: easy for 2-min, mix for 3-min, harder for 5-min.
    """,
)


from app.core.luminar_spec import spec_for


def quiz_count_for_duration(duration_minutes: int) -> int:
    """Question count per tier — canonical values live in luminar_spec
    (2-min → 3, 3-min → 5, 5-min → 8)."""
    return spec_for(duration_minutes).quiz_count

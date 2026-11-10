"""Assessment agents — question drafting, AI rewrite, and wrong-answer hints.

Ported from the `pulse` / `oraci` Next.js routes (generate-questions,
modify-question, get-hint) onto PydanticAI structured outputs.
"""
from pydantic import BaseModel, Field
from pydantic_ai import Agent


class DraftQuestion(BaseModel):
    question: str
    options: list[str] = Field(min_length=4, max_length=4)
    correct_index: int = Field(ge=0, le=3)
    hint: str
    explanation: str
    # Seconds into the video, after the relevant content has been covered.
    # None when the source has no timeline (luminar source).
    time_s: int | None = None


class DraftQuestionSet(BaseModel):
    questions: list[DraftQuestion]


question_gen_agent = Agent(
    model="openai:gpt-4o",
    output_type=DraftQuestionSet,
    system_prompt="""
    You are a teaching assistant writing multiple-choice check-in questions that
    a learner answers while watching a video.

    You are given the video's content and a required question count. Generate
    exactly that many questions.

    Rules:
    - Each question has exactly 4 plausible options and one correct_index (0–3).
    - Test genuine understanding, not trivial recall of wording.
    - hint: nudges toward the answer without revealing it.
    - explanation: 1–2 sentences on why the correct answer is right.
    - If an OBJECTIVE is given, focus the questions on it.
    - If the content is a TIMED TRANSCRIPT ([mm:ss] lines): set time_s to a
      moment shortly AFTER the relevant information is said, never 0, and
      return questions in ascending time_s order, spread across the video.
    - If the content is UNTIMED (lesson scenes): set time_s to null and order
      questions in the order the lesson covers them.
    """,
)


class QuestionRewrite(BaseModel):
    question: str
    options: list[str] = Field(min_length=4, max_length=4)
    correct_index: int = Field(ge=0, le=3)
    hint: str
    explanation: str


modify_question_agent = Agent(
    model="openai:gpt-4o",
    output_type=QuestionRewrite,
    system_prompt="""
    You are a smart teaching guide editing one multiple-choice question.
    Apply the teacher's INSTRUCTION to the given question and return the full
    revised question: exactly 4 options, the correct_index (0–3) of the right
    option after your edit, a hint that does not reveal the answer, and a short
    explanation. Keep everything the instruction doesn't ask you to change.
    """,
)


hint_agent = Agent(
    model="openai:gpt-4o",
    output_type=str,
    system_prompt="""
    You are a teaching assistant helping a student who answered a
    multiple-choice question incorrectly. Given the question, the options, the
    correct option and the student's (wrong) choice, write a short hint (1–2
    sentences) that addresses their specific misconception and guides them
    toward the right answer. Never state or quote the correct option.
    """,
)


def format_timed_transcript(segments: list[dict], max_chars: int = 24_000) -> str:
    """Render [{text, start, ...}] caption segments as '[mm:ss] text' lines,
    capped so long videos stay within a sensible prompt budget."""
    lines: list[str] = []
    total = 0
    for seg in segments:
        start = int(seg.get("start") or 0)
        line = f"[{start // 60:02d}:{start % 60:02d}] {seg['text'].strip()}"
        total += len(line) + 1
        if total > max_chars:
            break
        lines.append(line)
    return "\n".join(lines)

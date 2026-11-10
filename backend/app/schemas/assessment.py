import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


SourceType = Literal["youtube", "upload", "luminar"]


class TranscriptSegment(BaseModel):
    text: str = Field(max_length=2000)
    start: float = Field(ge=0)
    duration: float = Field(default=0, ge=0)


class QuestionIn(BaseModel):
    id: uuid.UUID | None = None
    question: str = Field(min_length=1)
    options: list[str] = Field(min_length=4, max_length=4)
    correct_index: int = Field(ge=0, le=3)
    hint: str | None = None
    explanation: str | None = None
    time_s: int | None = Field(default=None, ge=0)

    @field_validator("options")
    @classmethod
    def _options_non_empty(cls, v: list[str]) -> list[str]:
        if any(not o.strip() for o in v):
            raise ValueError("All 4 options must be filled in")
        return v


class AssessmentSource(BaseModel):
    source_type: SourceType
    youtube_url: str | None = None
    luminar_id: uuid.UUID | None = None
    video_url: str | None = None
    # Uploaded videos only: the timed transcript returned by /upload-video.
    transcript: list[TranscriptSegment] | None = Field(default=None, max_length=5000)

    @model_validator(mode="after")
    def _source_ref(self) -> "AssessmentSource":
        if self.source_type == "youtube" and not (self.youtube_url or "").strip():
            raise ValueError("youtube_url is required for a YouTube assessment")
        if self.source_type == "upload" and not (self.video_url or "").strip():
            raise ValueError("video_url is required for an uploaded-video assessment")
        if self.source_type == "luminar" and not self.luminar_id:
            raise ValueError("luminar_id is required for a luminar assessment")
        return self


class DraftQuestionsIn(AssessmentSource):
    num_questions: int = Field(default=5, ge=1, le=20)
    objective: str | None = None


class ModifyQuestionIn(BaseModel):
    question: QuestionIn
    instruction: str = Field(min_length=1)


class AssessmentCreate(AssessmentSource):
    title: str = Field(min_length=1)
    objective: str | None = None
    questions: list[QuestionIn] = Field(min_length=1)
    published: bool = False
    listed: bool = False


class AssessmentUpdate(BaseModel):
    title: str | None = None
    objective: str | None = None
    questions: list[QuestionIn] | None = None
    listed: bool | None = None


class PublishIn(BaseModel):
    published: bool


class AnswerIn(BaseModel):
    selected_index: int = Field(ge=0, le=3)


# ---------------------------------------------------------------------------
# Responses
# ---------------------------------------------------------------------------

class QuestionPublicOut(BaseModel):
    """What a learner sees — no correct answer, hint or explanation."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    position: int
    time_s: int | None = None
    question: str
    options: list[str]


class QuestionOwnerOut(QuestionPublicOut):
    correct_index: int
    hint: str | None = None
    explanation: str | None = None


class AssessmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    title: str
    objective: str | None = None
    source_type: SourceType
    youtube_url: str | None = None
    luminar_id: uuid.UUID | None = None
    video_url: str | None = None
    published: bool
    listed: bool = False
    is_owner: bool = False
    author_name: str | None = None
    submission_count: int = 0
    created_at: datetime
    updated_at: datetime
    # Owner gets QuestionOwnerOut items; everyone else gets QuestionPublicOut.
    questions: list[QuestionOwnerOut | QuestionPublicOut]
    # Owner only (uploaded videos): lets the builder draft more questions.
    transcript: list[TranscriptSegment] | None = None


class AssessmentSummary(BaseModel):
    id: uuid.UUID
    title: str
    objective: str | None = None
    source_type: SourceType
    published: bool
    listed: bool = False
    question_count: int
    submission_count: int
    created_at: datetime


class DirectoryItem(BaseModel):
    """Public directory card — never includes questions or answers."""
    id: uuid.UUID
    title: str
    objective: str | None = None
    source_type: SourceType
    youtube_url: str | None = None
    author_name: str
    author_avatar_url: str | None = None
    question_count: int
    learner_count: int
    created_at: datetime


class VideoUploadOut(BaseModel):
    video_url: str
    transcript: list[TranscriptSegment]
    duration_s: float


class AnswerStateOut(BaseModel):
    question_id: uuid.UUID
    attempts: int
    solved: bool
    hints_used: int


class AnswerResult(BaseModel):
    is_correct: bool
    attempts: int
    solved: bool
    # Wrong answer → a hint toward the right one (never the answer itself).
    hint: str | None = None
    # Correct answer → why it's right.
    explanation: str | None = None
    recorded: bool = True


class QuestionStat(BaseModel):
    question_id: uuid.UUID
    position: int
    question: str
    answered: int
    solved: int
    first_try_correct: int
    avg_attempts: float


class LearnerResult(BaseModel):
    user_id: uuid.UUID
    name: str
    email: str
    avatar_url: str | None = None
    answered: int
    solved: int
    first_try_correct: int
    hints_used: int
    total_questions: int
    last_activity: datetime


class AssessmentResponsesOut(BaseModel):
    total_questions: int
    learners: list[LearnerResult]
    questions: list[QuestionStat]

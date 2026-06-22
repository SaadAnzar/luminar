import uuid
from pydantic import BaseModel, ConfigDict

class QuizAttemptIn(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    selected_index: int

class QuizAttemptResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    is_correct: bool
    explanation: str
    correct_index: int

class QuizCardResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    question: str
    options: list[str]
    hint: str | None = None
    explanation: str | None = None

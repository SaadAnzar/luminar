from pydantic import BaseModel
from pydantic_ai import Agent
from typing import Literal

class SceneCode(BaseModel):
    language: Literal["javascript", "python", "typescript", "html", "css"]
    starter_code: str
    solution_code: str
    explanation: str
    test_cases: list[dict] # { input, expected, description }

code_agent = Agent(
    model="openai:gpt-4o",
    output_type=SceneCode,
    system_prompt="""
    You are an expert software engineering teacher. Your goal is to produce
    bite-sized coding exercises for a video scene.
    
    Given a topic and narration text, generate:
    1. A 'starter_code' block (the initial state the student sees).
    2. A 'solution_code' block.
    3. A short 'explanation' of the technical concept.
    4. Simple 'test_cases' for basic validation (e.g. if a function returns X).
    
    Keep exercises tiny (under 10 lines of code) so they fit in a video player.
    """
)

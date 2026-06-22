from pydantic import BaseModel
from pydantic_ai import Agent

class TeachBackEvaluation(BaseModel):
    score: float  # 0.0 to 1.0
    feedback: str
    missing_concepts: list[str]
    strong_points: list[str]

teach_back_agent = Agent(
    model="openai:gpt-4o",
    output_type=TeachBackEvaluation,
    system_prompt="""
    You evaluate a learner's explanation of a topic they just watched a video about.
    Score their explanation from 0.0 (completely wrong) to 1.0 (expert explanation).

    Evaluate on: accuracy, completeness, use of correct terminology, and ability
    to explain the 'why' not just the 'what'.

    Be encouraging but honest. Identify specific missing concepts by name and 
    highlight areas where they showed good understanding.
    """
)

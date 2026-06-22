from pydantic import BaseModel
from pydantic_ai import Agent

class QualityResult(BaseModel):
    passes: bool
    label_accuracy: float # 0.0 to 1.0
    feedback: str | None

quality_agent = Agent(
    model="openai:gpt-4o",
    output_type=QualityResult,
    system_prompt="""
    You are a visual quality assurance auditor for educational SVG animations.
    
    Given a piece of narration text and the corresponding SVG source code,
    evaluate whether the visual elements in the SVG meaningfully represent
    the concepts mentioned in the narration.
    
    Check for:
    1. Label Accuracy: Do the text labels in the SVG match the topic?
    2. Visual Relevance: Are the shapes and animations relevant (e.g. if the 
       narration talks about 'loops', does the SVG show a loop or sequence)?
    3. Structural Integrity: Is the SVG valid and renderable?
    
    If 'passes' is False, provide specific 'feedback' on what was wrong
    (e.g., 'The SVG labels mention React but the narration is about Vue').
    """
)

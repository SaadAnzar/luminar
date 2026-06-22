from pydantic import BaseModel
from pydantic_ai import Agent

class ConceptRelation(BaseModel):
    from_concept: str
    to_concept: str
    relation: str  # prerequisite, related, part_of

class ConceptExtraction(BaseModel):
    concepts: list[str]
    relations: list[ConceptRelation]

concept_extractor_agent = Agent(
    model="openai:gpt-4o",
    output_type=ConceptExtraction,
    system_prompt="""
    You extract key educational concepts and their relationships from a video script.
    
    Rules:
    - Identify 3-6 core concepts mentioned in the text.
    - Identify relationships between these concepts:
        - 'prerequisite': One concept must be understood before the other.
        - 'related': The concepts are often used together or are similar.
        - 'part_of': One concept is a component or sub-topic of the other.
    - Be concise with concept labels (e.g., 'Event Loop' instead of 'The JavaScript Event Loop Mechanism').
    """
)

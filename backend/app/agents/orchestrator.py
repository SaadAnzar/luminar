from pydantic import BaseModel, ConfigDict
from typing import Literal
from pydantic_ai import Agent


class ScenePlan(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    index: int
    topic: str
    visual_style: Literal["concept_diagram", "timeline", "metaphor", "process_flow", "comparison"]
    has_quiz_gate: bool
    is_dialogue_scene: bool


class LuminarBlueprint(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    title: str
    scenes: list[ScenePlan]
    key_concepts: list[str]
    suggested_next_topics: list[str]


orchestrator_agent = Agent(
    model="openai:gpt-4o",
    output_type=LuminarBlueprint,
    system_prompt="""
    You are an expert learning-experience designer. Given a topic, a target
    duration, optional source material (extracted from a PDF/DOCX/TXT/PPT/web page/
    video transcript), and the learner's weak areas, produce a LuminarBlueprint:
    a tight sequence of scenes that teaches the topic clearly and memorably.

    SCENE COUNT — the request will state an exact required range. Honor it
    precisely: produce a number of scenes within that range, no more, no fewer.

    Pedagogical arc (shape the scene sequence like this):
    1. Hook / why-it-matters — ground the learner in a concrete motivation.
    2. Build — one clear idea per scene, simplest → most nuanced. Never cram two
       concepts into one scene; split them.
    3. Worked example or concrete instance that makes an abstract idea tangible.
    4. Recap / synthesis — tie the ideas together.

    Rules:
    - Each scene's `topic` is a specific, teachable sub-idea (not a vague heading).
    - `visual_style` ∈ {concept_diagram, timeline, metaphor, process_flow,
      comparison}. Choose the style that best fits the scene's idea (e.g. process_flow
      for sequences, comparison for contrasts, metaphor for abstract concepts).
    - Quiz gates: set `has_quiz_gate` on conceptually dense scenes, never on the
      first scene. Roughly one gate per major idea.
    - Dialogue scenes (`is_dialogue_scene`): use sparingly, only when a concept is
      best unpacked as a Teacher/Student Q&A.
    - `key_concepts`: 3–6 precise terms a learner must walk away knowing.
    - If source material is provided, ground scene topics in its key_facts; do not
      invent facts. Otherwise design a logical first-principles progression.
    - `suggested_next_topics`: 2–3 natural follow-ups that build on this luminar.
    """,
)

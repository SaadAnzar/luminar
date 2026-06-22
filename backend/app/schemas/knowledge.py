import uuid
from pydantic import BaseModel, ConfigDict

class NodeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    label: str
    mastery_score: float

class EdgeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    source: uuid.UUID
    target: uuid.UUID
    relation: str | None = None

class GraphResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    nodes: list[NodeResponse]
    edges: list[EdgeResponse]

import uuid
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from loguru import logger
from pydantic import BaseModel, ConfigDict

from app.core.database import get_db
from app.api.v1.auth import get_current_user
from app.models.knowledge_graph import ConceptNode, ConceptEdge
from app.models.user import User

from app.schemas.knowledge import NodeResponse, EdgeResponse, GraphResponse

router = APIRouter()

@router.get("/graph", response_model=GraphResponse)
async def get_knowledge_graph(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """Retrieve the user's personalized knowledge graph (concepts and relationships)."""
    logger.info(f"Fetching knowledge graph for user {current_user.id}")
    
    # Fetch all nodes for the user
    nodes_result = await db.execute(
        select(ConceptNode).where(ConceptNode.user_id == current_user.id)
    )
    nodes = nodes_result.scalars().all()
    
    # Fetch all edges for the user
    edges_result = await db.execute(
        select(ConceptEdge).where(ConceptEdge.user_id == current_user.id)
    )
    edges = edges_result.scalars().all()
    
    return {
        "nodes": [
            {
                "id": n.id, 
                "label": n.label, 
                "mastery_score": n.mastery_score
            } 
            for n in nodes
        ],
        "edges": [
            {
                "id": e.id, 
                "source": e.from_concept_id, 
                "target": e.to_concept_id, 
                "relation": e.relation
            } 
            for e in edges
        ]
    }

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.knowledge_graph import ConceptNode, LuminarConceptLink
from app.models.quiz import QuizCard
import uuid
from loguru import logger

async def get_weak_areas(user_id: uuid.UUID, db: AsyncSession) -> list[str]:
    result = await db.execute(
        select(ConceptNode.label)
        .where(ConceptNode.user_id == user_id, ConceptNode.mastery_score < 0.5)
        .order_by(ConceptNode.mastery_score)
        .limit(5)
    )
    return [r[0] for r in result.fetchall()]

async def update_knowledge_graph(user_id: uuid.UUID, concepts: list[str], luminar_id: uuid.UUID, db: AsyncSession):
    for label in concepts:
        result = await db.execute(
            select(ConceptNode).where(ConceptNode.user_id == user_id, ConceptNode.label == label)
        )
        node = result.scalar_one_or_none()

        if not node:
            node = ConceptNode(user_id=user_id, label=label, mastery_score=0.3)
            db.add(node)
            await db.flush()
        else:
            node.mastery_score = min(1.0, node.mastery_score + 0.05)

        link_result = await db.execute(
            select(LuminarConceptLink).where(
                LuminarConceptLink.luminar_id == luminar_id,
                LuminarConceptLink.concept_id == node.id
            )
        )
        if not link_result.scalar_one_or_none():
            db.add(LuminarConceptLink(luminar_id=luminar_id, concept_id=node.id))

    await db.commit()

async def update_mastery_from_quiz(user_id: uuid.UUID, quiz_card_id: uuid.UUID, is_correct: bool, db: AsyncSession):
    from app.models.scene import Scene
    from app.models.luminar import Luminar

    result = await db.execute(
        select(ConceptNode)
        .join(LuminarConceptLink, LuminarConceptLink.concept_id == ConceptNode.id)
        .join(Luminar, Luminar.id == LuminarConceptLink.luminar_id)
        .join(Scene, Scene.luminar_id == Luminar.id)
        .join(QuizCard, QuizCard.scene_id == Scene.id)
        .where(QuizCard.id == quiz_card_id, ConceptNode.user_id == user_id)
    )
    nodes = result.scalars().all()

    delta = 0.15 if is_correct else -0.1
    for node in nodes:
        node.mastery_score = max(0.0, min(1.0, node.mastery_score + delta))

    await db.commit()

async def update_mastery_from_teach_back(user_id: uuid.UUID, luminar_id: uuid.UUID, score: float, missing_concepts: list[str], db: AsyncSession):
    result = await db.execute(
        select(ConceptNode)
        .join(LuminarConceptLink, LuminarConceptLink.concept_id == ConceptNode.id)
        .where(LuminarConceptLink.luminar_id == luminar_id, ConceptNode.user_id == user_id)
    )
    nodes = result.scalars().all()

    for node in nodes:
        if node.label in missing_concepts:
            node.mastery_score = max(0.0, min(1.0, score - 0.2))
        else:
            boost = (score - 0.5) * 0.4
            node.mastery_score = max(0.0, min(1.0, node.mastery_score + boost))

    await db.commit()

class AdaptiveEngine:
    @staticmethod
    async def get_weak_areas(user_id: uuid.UUID, db: AsyncSession) -> list[str]:
        return await get_weak_areas(user_id, db)

    @staticmethod
    async def update_knowledge_graph(user_id: uuid.UUID, concepts: list[str], luminar_id: uuid.UUID, db: AsyncSession):
        return await update_knowledge_graph(user_id, concepts, luminar_id, db)

    @staticmethod
    async def update_mastery_from_quiz(user_id: uuid.UUID, quiz_card_id: uuid.UUID, is_correct: bool, db: AsyncSession):
        return await update_mastery_from_quiz(user_id, quiz_card_id, is_correct, db)

    @staticmethod
    async def update_mastery_from_teach_back(user_id: uuid.UUID, luminar_id: uuid.UUID, score: float, missing_concepts: list[str], db: AsyncSession):
        return await update_mastery_from_teach_back(user_id, luminar_id, score, missing_concepts, db)

adaptive_engine = AdaptiveEngine()

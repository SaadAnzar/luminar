import uuid
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from loguru import logger

from app.core.database import get_db
from app.core.scheduler import scheduler
from app.core.ws_manager import ws_manager
from app.api.v1.auth import get_current_user
from app.models.luminar import Luminar
from app.models.scene import Scene
from app.models.user import User
from app.schemas.luminar import LuminarInDB, SceneOut
from app.jobs.luminar_jobs import generate_script_job, generate_assets_job
from app.services.storage import upload_file

router = APIRouter()

DRAFT_STATUSES = {"pending", "script_generating", "script_ready", "assets_generating", "failed"}
READY_STATUS = "ready"


# ---------------------------------------------------------------------------
# WebSocket — real-time progress
# ---------------------------------------------------------------------------

@router.websocket("/ws/{luminar_id}")
async def luminar_progress_ws(luminar_id: str, ws: WebSocket) -> None:
    await ws_manager.connect(luminar_id, ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(luminar_id, ws)


# ---------------------------------------------------------------------------
# Phase 1: generate script
# ---------------------------------------------------------------------------

@router.post("/generate", status_code=status.HTTP_202_ACCEPTED)
async def generate_script(
    topic: str = Form(""),
    title: str = Form(""),
    description: str = Form(""),
    source_type: str = Form("none"),
    duration_minutes: int = Form(...),
    dialogue_mode: bool = Form(False),
    voice_style: str = Form("alloy"),
    source_file: UploadFile | None = File(None),
    source_url: str = Form(""),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    if duration_minutes not in (2, 3, 5):
        raise HTTPException(status_code=400, detail="Duration must be 2, 3, or 5 minutes")
    if not topic.strip():
        raise HTTPException(status_code=400, detail="Topic is required")
    FILE_SOURCE_TYPES = ("pdf", "txt", "ppt", "docx")
    URL_SOURCE_TYPES = ("blog", "website", "youtube")
    if source_type not in ("none", *FILE_SOURCE_TYPES, *URL_SOURCE_TYPES):
        raise HTTPException(status_code=400, detail="Invalid source_type")
    if source_type in URL_SOURCE_TYPES and not source_url.strip():
        raise HTTPException(status_code=400, detail="source_url required for this source_type")
    if source_type in FILE_SOURCE_TYPES and not source_file:
        raise HTTPException(status_code=400, detail="source_file required for this source_type")

    resolved_title = title.strip() or topic[:80]

    uploaded_source_url: str | None = None
    source_bytes: bytes | None = None
    if source_file:
        source_bytes = await source_file.read()
        uploaded_source_url = await upload_file(
            source_bytes,
            f"sources/{current_user.id}/{uuid.uuid4()}/{source_file.filename}",
            source_file.content_type or "application/octet-stream",
        )

    effective_source_url = source_url.strip() if source_type in URL_SOURCE_TYPES else uploaded_source_url

    db_luminar = Luminar(
        user_id=current_user.id,
        title=resolved_title,
        prompt=topic,
        description=description.strip() or None,
        source_type=source_type,
        source_url=effective_source_url,
        duration_minutes=duration_minutes,
        dialogue_mode=dialogue_mode,
        voice_style=voice_style,
        status="pending",
    )
    db.add(db_luminar)
    await db.commit()
    await db.refresh(db_luminar)

    luminar_id = str(db_luminar.id)
    logger.info(f"Scheduling Phase 1 for luminar {luminar_id}")
    scheduler.add_job(
        generate_script_job,
        trigger=None,
        kwargs={
            "luminar_id": luminar_id,
            "user_id": str(current_user.id),
            "prompt": topic,
            "duration": duration_minutes,
            "dialogue_mode": dialogue_mode,
            "voice_style": voice_style,
            "source_type": source_type,
            "source_url": effective_source_url,
            "source_bytes": source_bytes,
        },
        id=f"script_{luminar_id}",
        replace_existing=True,
    )

    return {"luminar_id": luminar_id, "status": "pending"}


# ---------------------------------------------------------------------------
# Phase 2: approve script → generate assets
# ---------------------------------------------------------------------------

@router.post("/{luminar_id}/approve", status_code=status.HTTP_202_ACCEPTED)
async def approve_script(
    luminar_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    result = await db.execute(
        select(Luminar).where(Luminar.id == luminar_id, Luminar.user_id == current_user.id)
    )
    luminar = result.scalar_one_or_none()
    if not luminar:
        raise HTTPException(status_code=404, detail="Luminar not found")
    if luminar.status != "script_ready":
        raise HTTPException(status_code=400, detail=f"Luminar is not in script_ready state (current: {luminar.status})")

    lid_str = str(luminar_id)
    logger.info(f"Scheduling Phase 2 for luminar {lid_str}")
    scheduler.add_job(
        generate_assets_job,
        trigger=None,
        kwargs={
            "luminar_id": lid_str,
            "voice_style": luminar.voice_style,
            "duration_minutes": luminar.duration_minutes,
        },
        id=f"assets_{lid_str}",
        replace_existing=True,
    )
    return {"luminar_id": lid_str, "status": "assets_generating"}


# ---------------------------------------------------------------------------
# Retry a failed generation
# ---------------------------------------------------------------------------

@router.post("/{luminar_id}/retry", status_code=status.HTTP_202_ACCEPTED)
async def retry_generation(
    luminar_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    result = await db.execute(
        select(Luminar).where(Luminar.id == luminar_id, Luminar.user_id == current_user.id)
    )
    luminar = result.scalar_one_or_none()
    if not luminar:
        raise HTTPException(status_code=404, detail="Luminar not found")
    if luminar.status != "failed":
        raise HTTPException(
            status_code=400,
            detail=f"Only failed luminars can be retried (current: {luminar.status})",
        )

    lid_str = str(luminar_id)

    # If the script was already written (scenes exist), the failure was in
    # Phase 2 — re-run asset generation only. Otherwise re-run Phase 1.
    has_scenes = (
        await db.execute(select(Scene.id).where(Scene.luminar_id == luminar_id).limit(1))
    ).first() is not None

    if has_scenes and luminar.full_script:
        new_status = "assets_generating"
        logger.info(f"Retrying Phase 2 for luminar {lid_str}")
        scheduler.add_job(
            generate_assets_job,
            trigger=None,
            kwargs={
                "luminar_id": lid_str,
                "voice_style": luminar.voice_style,
                "duration_minutes": luminar.duration_minutes,
            },
            id=f"assets_{lid_str}",
            replace_existing=True,
        )
    else:
        new_status = "script_generating"
        logger.info(f"Retrying Phase 1 for luminar {lid_str}")
        scheduler.add_job(
            generate_script_job,
            trigger=None,
            kwargs={
                "luminar_id": lid_str,
                "user_id": str(current_user.id),
                "prompt": luminar.prompt,
                "duration": luminar.duration_minutes,
                "dialogue_mode": luminar.dialogue_mode,
                "voice_style": luminar.voice_style,
                "source_type": luminar.source_type,
                "source_url": luminar.source_url,
                "source_bytes": None,  # re-downloaded from source_url inside the job
            },
            id=f"script_{lid_str}",
            replace_existing=True,
        )

    # Reflect the transition immediately so the client doesn't briefly re-read "failed".
    luminar.status = new_status
    await db.commit()
    return {"luminar_id": lid_str, "status": new_status}


# ---------------------------------------------------------------------------
# Publish / unpublish to the Discover feed
# ---------------------------------------------------------------------------

class PublishIn(BaseModel):
    published: bool


@router.post("/{luminar_id}/publish")
async def set_published(
    luminar_id: uuid.UUID,
    body: PublishIn,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, bool | str]:
    result = await db.execute(
        select(Luminar).where(Luminar.id == luminar_id, Luminar.user_id == current_user.id)
    )
    luminar = result.scalar_one_or_none()
    if not luminar:
        raise HTTPException(status_code=404, detail="Luminar not found")
    if body.published and luminar.status != "ready":
        raise HTTPException(status_code=400, detail="Only a finished luminar can be published")
    luminar.published = body.published
    await db.commit()
    return {"luminar_id": str(luminar_id), "published": luminar.published}


# ---------------------------------------------------------------------------
# Tutor chat — grounded in the luminar
# ---------------------------------------------------------------------------

class ChatMessage(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class ChatIn(BaseModel):
    message: str
    history: list[ChatMessage] = []


@router.post("/{luminar_id}/chat")
async def chat_about_luminar(
    luminar_id: uuid.UUID,
    body: ChatIn,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    luminar = (await db.execute(select(Luminar).where(Luminar.id == luminar_id))).scalar_one_or_none()
    if not luminar:
        raise HTTPException(status_code=404, detail="Luminar not found")

    scenes = (await db.execute(
        select(Scene).where(Scene.luminar_id == luminar_id).order_by(Scene.scene_index)
    )).scalars().all()

    narration = "\n".join(
        f"Scene {s.scene_index + 1} ({s.title}): {(s.narration_text or '')[:600]}"
        for s in scenes
    )
    context = (
        f"Title: {luminar.title}\n"
        f"Topic: {luminar.prompt}\n"
        f"Key concepts: {', '.join(luminar.key_concepts or [])}\n\n"
        f"Narration:\n{narration}"
    )
    convo = "\n".join(f"{m.role}: {m.content}" for m in body.history[-8:])
    prompt = (
        f"LESSON CONTEXT:\n{context}\n\n"
        f"{'CONVERSATION SO FAR:' + chr(10) + convo + chr(10) + chr(10) if convo else ''}"
        f"Learner asks: {body.message}"
    )

    from app.agents.chat import tutor_agent
    result = await tutor_agent.run(prompt)
    return {"answer": result.output}


# ---------------------------------------------------------------------------
# Read endpoints
# ---------------------------------------------------------------------------

@router.get("/me", response_model=list[LuminarInDB])
async def get_my_luminars(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[Luminar]:
    result = await db.execute(
        select(Luminar)
        .where(Luminar.user_id == current_user.id)
        .order_by(desc(Luminar.created_at))
    )
    return list(result.scalars().all())


@router.get("/{luminar_id}", response_model=LuminarInDB)
async def get_luminar(
    luminar_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> Luminar:
    result = await db.execute(select(Luminar).where(Luminar.id == luminar_id))
    luminar = result.scalar_one_or_none()
    if not luminar:
        raise HTTPException(status_code=404, detail="Luminar not found")
    return luminar


@router.get("/{luminar_id}/scenes", response_model=list[SceneOut])
async def get_luminar_scenes(
    luminar_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> list[Scene]:
    result = await db.execute(
        select(Scene)
        .where(Scene.luminar_id == luminar_id)
        .order_by(Scene.scene_index)
    )
    return list(result.scalars().all())

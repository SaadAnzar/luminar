"""Clone one READY luminar (scenes + quiz cards, with their real public asset
URLs) from prod into the LOCAL dev DB, under the stable harness IDs, so the
Playwright harness reproduces exactly what a user sees with real audio/SVG.

Read-only on prod; writes only to LOCAL_DATABASE_URL.

    PYTHONPATH=. LOCAL_DATABASE_URL=postgresql+asyncpg://localhost:5432/luminar_dev \
        .venv/bin/python scripts/seed_clone_prod.py
"""
import asyncio
import json
import os
import uuid

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.core.database import engine as prod_engine  # uses settings → prod
from app.models import Base, User, Luminar, Scene, QuizCard
from app.core.security import create_access_token

LOCAL_URL = os.environ["LOCAL_DATABASE_URL"]
USER_ID = uuid.UUID("00000000-0000-0000-0000-0000000000aa")
LUMINAR_ID = uuid.UUID("00000000-0000-0000-0000-0000000000b1")


async def main() -> None:
    # --- read one ready luminar from prod ---
    async with prod_engine.connect() as conn:
        lum = (await conn.execute(text(
            "select title, prompt, duration_minutes, dialogue_mode, voice_style, "
            "key_concepts, suggested_next_topics, difficulty_hint "
            "from luminars where status='ready' order by created_at desc limit 1"
        ))).mappings().first()
        lid = (await conn.execute(text(
            "select id from luminars where status='ready' order by created_at desc limit 1"
        ))).scalar()
        scenes = (await conn.execute(text(
            "select scene_index, title, narration_text, caption_segments, svg_url, audio_url, "
            "duration_ms, dialogue_mode, visual_style from scenes where luminar_id=:l order by scene_index"
        ), {"l": lid})).mappings().all()
        cards = (await conn.execute(text(
            "select scene_index_q, question, options, correct_index, hint, explanation, difficulty, trigger_at_ms "
            "from (select q.*, s.scene_index as scene_index_q from quiz_cards q "
            "join scenes s on s.id=q.scene_id where q.luminar_id=:l) t order by trigger_at_ms"
        ), {"l": lid})).mappings().all()
    await prod_engine.dispose()

    # --- write into local ---
    local = create_async_engine(LOCAL_URL)
    async with local.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    Session = async_sessionmaker(local, expire_on_commit=False, class_=AsyncSession)
    async with Session() as db:
        db.add(User(id=USER_ID, google_id="dev-google-id", email="dev@luminar.test", name="Dev Learner"))
        db.add(Luminar(
            id=LUMINAR_ID, user_id=USER_ID, title=lum["title"], prompt=lum["prompt"],
            description="Cloned from prod for harness.", source_type="none",
            duration_minutes=lum["duration_minutes"], dialogue_mode=lum["dialogue_mode"],
            voice_style=lum["voice_style"], status="ready",
            key_concepts=lum["key_concepts"], suggested_next_topics=lum["suggested_next_topics"],
            difficulty_hint=lum["difficulty_hint"] or "medium",
        ))
        idx_to_sid = {}
        for s in scenes:
            sid = uuid.uuid4()
            idx_to_sid[s["scene_index"]] = sid
            db.add(Scene(
                id=sid, luminar_id=LUMINAR_ID, scene_index=s["scene_index"], title=s["title"],
                narration_text=s["narration_text"], caption_segments=s["caption_segments"],
                svg_url=s["svg_url"], audio_url=s["audio_url"], duration_ms=s["duration_ms"],
                dialogue_mode=s["dialogue_mode"], visual_style=s["visual_style"] or "concept_diagram",
            ))
        for c in cards:
            db.add(QuizCard(
                scene_id=idx_to_sid[c["scene_index_q"]], luminar_id=LUMINAR_ID,
                question=c["question"], options=c["options"], correct_index=c["correct_index"],
                hint=c["hint"], explanation=c["explanation"], difficulty=c["difficulty"] or "medium",
                trigger_at_ms=c["trigger_at_ms"],
            ))
        await db.commit()
    token = create_access_token({"sub": str(USER_ID)})
    await local.dispose()

    artifact = {"luminarId": str(LUMINAR_ID), "userId": str(USER_ID), "token": token,
                "user": {"id": str(USER_ID), "email": "dev@luminar.test", "name": "Dev Learner"}}
    with open(os.path.join(os.path.dirname(__file__), ".dev-seed.json"), "w") as f:
        json.dump(artifact, f, indent=2)

    print("CLONE_OK", lum["title"], "| scenes:", len(scenes), "| cards:", len(cards))
    print("first scene durations(ms):", [s["duration_ms"] for s in scenes])
    print("quiz trigger_at_ms:", [c["trigger_at_ms"] for c in cards])


if __name__ == "__main__":
    asyncio.run(main())

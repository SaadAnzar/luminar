"""Local dev seed — creates the schema on a LOCAL Postgres and inserts one
ready luminar (with scenes + quiz cards) plus a user, then prints a JWT for that
user. Used by the Playwright visual/e2e harness; never touches production.

Usage:
    LOCAL_DATABASE_URL=postgresql+asyncpg://localhost:5432/luminar_dev \
        .venv/bin/python scripts/seed_dev.py

The script builds its own engine against LOCAL_DATABASE_URL — importing the app
models pulls in app.core.database (which constructs the prod engine lazily), but
that engine never connects here. The JWT is signed with the same JWT_SECRET the
backend reads from .env, so tokens validate when the backend runs against the
same local DB.
"""
import asyncio
import os
import uuid

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.models import Base, User, Luminar, Scene, QuizCard
from app.core.security import create_access_token

LOCAL_URL = os.environ.get(
    "LOCAL_DATABASE_URL", "postgresql+asyncpg://localhost:5432/luminar_dev"
)

# Stable IDs so the harness can hardcode URLs.
USER_ID = uuid.UUID("00000000-0000-0000-0000-0000000000aa")
LUMINAR_ID = uuid.UUID("00000000-0000-0000-0000-0000000000b1")


def _svg(label: str, color: str) -> str:
    """A tiny self-contained SVG as a data: URI (proves the <object> render path)."""
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450">'
        f'<rect width="800" height="450" fill="{color}"/>'
        f'<circle cx="400" cy="200" r="80" fill="white" fill-opacity="0.85"/>'
        f'<text x="400" y="360" text-anchor="middle" font-family="sans-serif" '
        f'font-size="34" fill="white">{label}</text></svg>'
    )
    import urllib.parse
    return "data:image/svg+xml," + urllib.parse.quote(svg)


SCENES = [
    ("What is Photosynthesis?", "Plants convert light into chemical energy.", "#2563eb", 2500),
    ("The Light Reactions", "Chlorophyll captures photons in the thylakoid.", "#0891b2", 3000),
    ("The Calvin Cycle", "Carbon fixation builds glucose from CO2.", "#059669", 2500),
]


async def main() -> None:
    engine = create_async_engine(LOCAL_URL)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    Session = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with Session() as db:
        db.add(User(
            id=USER_ID, google_id="dev-google-id", email="dev@luminar.test", name="Dev Learner",
        ))
        db.add(Luminar(
            id=LUMINAR_ID, user_id=USER_ID, title="Photosynthesis, visually",
            prompt="photosynthesis", description="A seeded demo luminar.",
            source_type="none", duration_minutes=3, dialogue_mode=False, voice_style="alloy",
            status="ready",
            published=True,
            key_concepts=["light reactions", "Calvin cycle", "chlorophyll"],
            suggested_next_topics=["Cellular respiration", "ATP synthesis"],
            difficulty_hint="medium",
        ))

        scene_ids = []
        cumulative = 0
        for i, (title, narration, color, dur) in enumerate(SCENES):
            sid = uuid.uuid4()
            scene_ids.append((sid, dur))
            cumulative += dur
            db.add(Scene(
                id=sid, luminar_id=LUMINAR_ID, scene_index=i, title=title,
                narration_text=narration,
                caption_segments=[{"text": narration, "start_ms": 0, "end_ms": dur}],
                svg_url=_svg(title, color), audio_url=None, duration_ms=dur,
                dialogue_mode=False, visual_style="concept_diagram",
            ))

        # One quiz gate at the end of scene 1, another at the end of scene 2.
        gate1 = scene_ids[0][1]
        gate2 = scene_ids[0][1] + scene_ids[1][1]
        db.add(QuizCard(
            scene_id=scene_ids[0][0], luminar_id=LUMINAR_ID,
            question="What do plants convert light into during the process of photosynthesis?",
            options=[
                "Chemical energy stored in glucose molecules",
                "Sound waves that travel through the leaf",
                "Magnetism used to attract nutrients",
                "Static electric charge held in the stem",
            ],
            correct_index=0, hint="Think about what fuels the plant's growth and is stored for later.",
            explanation=(
                "Photosynthesis converts light energy into chemical energy stored in glucose. "
                "The plant later breaks down that glucose to power growth and repair. It is not "
                "stored as sound, magnetism, or static charge — those are not biological energy stores."
            ),
            # Drift: trigger is set PAST the measured scene end. scene_id gating must
            # still pop it at the scene boundary (regression guard for the fix).
            difficulty="easy", trigger_at_ms=gate1 + 800,
        ))
        db.add(QuizCard(
            scene_id=scene_ids[1][0], luminar_id=LUMINAR_ID,
            question="Where are photons captured?",
            options=["Mitochondria", "Thylakoid", "Nucleus", "Ribosome"],
            correct_index=1, hint="It's inside the chloroplast.",
            explanation="Chlorophyll in the thylakoid membrane captures photons.",
            difficulty="medium", trigger_at_ms=gate2,
        ))
        await db.commit()

    token = create_access_token({"sub": str(USER_ID)})
    await engine.dispose()

    # Artifact for the Playwright harness to consume.
    import json
    artifact = {
        "luminarId": str(LUMINAR_ID),
        "userId": str(USER_ID),
        "token": token,
        "user": {"id": str(USER_ID), "email": "dev@luminar.test", "name": "Dev Learner"},
    }
    out_path = os.path.join(os.path.dirname(__file__), ".dev-seed.json")
    with open(out_path, "w") as f:
        json.dump(artifact, f, indent=2)

    print("SEED_OK")
    print(f"LUMINAR_ID={LUMINAR_ID}")
    print(f"USER_ID={USER_ID}")
    print(f"artifact -> {out_path}")


if __name__ == "__main__":
    asyncio.run(main())

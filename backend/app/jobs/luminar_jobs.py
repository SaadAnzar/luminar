"""Two-phase Luminar generation jobs.

Phase 1 (cheap)  — generate_script_job:   DataExtractor → Orchestrator → ScriptAgent
Phase 2 (expensive) — generate_assets_job: SVGAnimator → QualityReview → TTS → QuizGen

Progress is broadcast via WebSocket at /ws/{luminar_id}.
"""
import asyncio
import uuid
import httpx
from loguru import logger
from sqlalchemy import update, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal
from app.services.storage import upload_file
from app.agents.data_extractor import extract_from_bytes, extract_from_url
from app.agents.orchestrator import orchestrator_agent
from app.agents.script import script_agent, build_caption_segments
from app.agents.svg_animator import svg_agent
from app.agents.quality_review import quality_agent
from app.agents.tts import generate_tts
from app.agents.quiz_gen import quiz_agent, quiz_count_for_duration
from app.models.scene import Scene
from app.models.luminar import Luminar
from app.models.quiz import QuizCard
from app.services.adaptive_engine import get_weak_areas
from app.core.luminar_spec import spec_for


# File-based source types are uploaded to S3 and re-downloadable for retries;
# URL-based types are fetched live from their source_url.
FILE_SOURCE_TYPES = ("pdf", "txt", "ppt", "docx")

# Transient states a job passes through — if a luminar is stuck in one of these
# after a restart, its (in-memory APScheduler) job was lost and won't resume.
TRANSIENT_STATUSES = ("pending", "script_generating", "assets_generating")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _download_bytes(url: str) -> bytes | None:
    """Re-fetch an uploaded source file from its (S3) URL. Used on retry, when
    the original in-memory upload bytes are no longer available."""
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=30) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            return resp.content
    except Exception as exc:
        logger.warning(f"Failed to re-download source {url}: {exc}")
        return None


async def recover_stuck_luminars() -> None:
    """On startup, fail any luminar left mid-generation by a crash/restart.

    APScheduler runs jobs in-process with an in-memory store, so a luminar
    interrupted in a transient state would otherwise hang forever. Marking it
    `failed` lets the owner retry via the retry endpoint.
    """
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            update(Luminar)
            .where(Luminar.status.in_(TRANSIENT_STATUSES))
            .values(status="failed")
            .returning(Luminar.id)
        )
        stuck_ids = [row[0] for row in result.fetchall()]
        await db.commit()
    if stuck_ids:
        logger.warning(
            f"Startup recovery: marked {len(stuck_ids)} stuck luminar(s) as failed: {stuck_ids}"
        )


async def _set_status(luminar_id: str, status: str) -> None:
    async with AsyncSessionLocal() as db:
        await db.execute(
            update(Luminar).where(Luminar.id == uuid.UUID(luminar_id)).values(status=status)
        )
        await db.commit()


async def _broadcast(luminar_id: str, pct: int, message: str) -> None:
    try:
        from app.core.ws_manager import ws_manager
        await ws_manager.broadcast(luminar_id, {"progress": pct, "message": message})
    except Exception:
        pass


# ---------------------------------------------------------------------------
# Phase 1 — Script generation
# ---------------------------------------------------------------------------

async def generate_script_job(
    luminar_id: str,
    user_id: str,
    prompt: str,
    duration: int,
    dialogue_mode: bool,
    voice_style: str,
    source_type: str,
    source_url: str | None,
    source_bytes: bytes | None,
) -> None:
    """Extract source content, plan scenes, write script. Sets status=script_ready."""
    logger.info(f"[Phase 1] Starting script generation for {luminar_id}")

    try:
        await _set_status(luminar_id, "script_generating")
        await _broadcast(luminar_id, 5, "Starting…")

        # ── 1. Extract source content ──────────────────────────────────────
        extracted_summary = ""
        if source_type != "none" and (source_bytes or source_url):
            await _broadcast(luminar_id, 10, "Extracting source content…")
            if source_type in FILE_SOURCE_TYPES:
                # On a fresh run we have the upload bytes; on retry they're gone,
                # so re-download from the stored S3 url.
                if source_bytes is None and source_url:
                    source_bytes = await _download_bytes(source_url)
                if source_bytes is None:
                    raise RuntimeError("Source file is no longer available to extract.")
                content = await extract_from_bytes(source_type, source_bytes)
            else:
                content = await extract_from_url(source_url, source_type)  # type: ignore[arg-type]
            extracted_summary = (
                f"Title: {content.title}\n"
                f"Key facts:\n" + "\n".join(f"- {f}" for f in content.key_facts) +
                f"\n\nBody:\n{content.body_text[:4000]}"
            )
            logger.info(f"[Phase 1] Extracted content for {luminar_id}: {content.title}")

        # ── 2. Fetch weak areas + learner profile → adaptive hints ─────────
        await _broadcast(luminar_id, 15, "Loading your learning profile…")
        weak_areas: list[str] = []
        difficulty_hint = "medium"
        profile_note = ""
        async with AsyncSessionLocal() as db:
            weak_areas = await get_weak_areas(uuid.UUID(user_id), db)
            from app.models.user import User
            user = (await db.execute(select(User).where(User.id == uuid.UUID(user_id)))).scalar_one_or_none()

        if weak_areas:
            difficulty_hint = "easy"
            logger.info(f"[Phase 1] Weak areas for {user_id}: {weak_areas}")

        if user:
            if user.skill_level == "beginner":
                difficulty_hint = "easy"
            elif user.skill_level == "advanced":
                difficulty_hint = "hard"
            bits = []
            if user.skill_level:
                bits.append(f"Skill level: {user.skill_level} — calibrate depth and jargon accordingly.")
            if user.interests:
                bits.append(f"Interests: {', '.join(user.interests)} — draw examples/analogies from these when natural.")
            if user.goals:
                bits.append(f"Goals: {', '.join(user.goals)} — frame the lesson toward these.")
            if user.learning_style == "concise":
                bits.append("Prefers concise, to-the-point explanations.")
            elif user.learning_style == "in_depth":
                bits.append("Prefers thorough, in-depth explanations with extra detail.")
            if bits:
                profile_note = "\n\nLearner profile:\n" + "\n".join(f"- {b}" for b in bits)

        # ── 3. Orchestrate scene plan (enforce scene count for the tier) ───
        await _broadcast(luminar_id, 20, "Planning scenes…")
        spec = spec_for(duration)
        base_input = f"Topic: {prompt}\nTarget duration: {duration} minutes"
        if extracted_summary:
            base_input += f"\n\nSource material:\n{extracted_summary}"
        if weak_areas:
            base_input += (
                "\n\nLearner's weak areas (reinforce these with extra clarity):\n"
                + "\n".join(f"- {w}" for w in weak_areas)
            )
        base_input += profile_note
        scene_req = (
            f"\n\nProduce EXACTLY between {spec.min_scenes} and {spec.max_scenes} scenes "
            f"(aim for {spec.target_scenes}) — one animated SVG per scene."
        )

        blueprint = None
        for attempt in range(2):  # one corrective retry if the count is off
            extra = "" if attempt == 0 else (
                f"\n\nYour previous plan had the wrong number of scenes. "
                f"Return EXACTLY {spec.target_scenes} scenes."
            )
            blueprint = (await orchestrator_agent.run(base_input + scene_req + extra)).output
            if spec.min_scenes <= len(blueprint.scenes) <= spec.max_scenes:
                break
        # Never exceed the tier max — clamp + reindex if the model over-produced.
        if len(blueprint.scenes) > spec.max_scenes:
            blueprint.scenes = blueprint.scenes[: spec.max_scenes]
            for i, s in enumerate(blueprint.scenes):
                s.index = i
        logger.info(f"[Phase 1] Blueprint: {len(blueprint.scenes)} scenes for {luminar_id}")

        # ── 4. Write script (target the tier's word budget → audio length) ─
        await _broadcast(luminar_id, 30, "Writing script…")
        budget = (
            f"\n\nTOTAL WORD BUDGET for the whole script: {spec.min_words}–{spec.max_words} "
            f"words (aim for {spec.target_words}); distribute across the "
            f"{len(blueprint.scenes)} scenes so total audio is {spec.min_seconds}–{spec.max_seconds}s."
        )
        script_input = (
            f"Blueprint:\n{blueprint.model_dump_json()}\n"
            f"Dialogue mode: {dialogue_mode}{budget}"
        )
        full_script = (await script_agent.run(script_input)).output
        total_ms = sum(s.estimated_duration_ms for s in full_script.scenes)
        if not (spec.min_ms <= total_ms <= spec.max_ms):
            direction = "longer and richer" if total_ms < spec.min_ms else "tighter and more concise"
            logger.warning(
                f"[Phase 1] {luminar_id}: script ~{total_ms // 1000}s, "
                f"need {spec.min_seconds}-{spec.max_seconds}s; retrying ({direction})."
            )
            full_script = (await script_agent.run(
                script_input
                + f"\n\nYour previous script ran ~{total_ms // 1000}s. Make it {direction} "
                f"to land within {spec.min_seconds}–{spec.max_seconds} seconds total."
            )).output
        logger.info(
            f"[Phase 1] Script ~{sum(s.estimated_duration_ms for s in full_script.scenes) // 1000}s "
            f"for {luminar_id}"
        )

        # ── 5. Persist scenes + luminar metadata ───────────────────────────
        await _broadcast(luminar_id, 38, "Saving script…")
        async with AsyncSessionLocal() as db:
            from sqlalchemy import delete as sql_delete
            await db.execute(sql_delete(Scene).where(Scene.luminar_id == uuid.UUID(luminar_id)))

            full_script_json: list[dict] = []
            for i, (scene_plan, scene_script) in enumerate(
                zip(blueprint.scenes, full_script.scenes, strict=False)
            ):
                caps = [s.model_dump() for s in scene_script.caption_segments]
                if not caps:
                    import re
                    plain = re.sub(r"\[VISUAL_CUE:[^\]]*\]", "", scene_script.narration)
                    plain = re.sub(r"\[(Teacher|Student)\]:\s*", "", plain).strip()
                    caps = build_caption_segments(plain)

                db.add(Scene(
                    luminar_id=uuid.UUID(luminar_id),
                    scene_index=i,
                    title=scene_plan.topic,
                    narration_text=scene_script.narration,
                    caption_segments=caps,
                    duration_ms=scene_script.estimated_duration_ms,
                    dialogue_mode=scene_plan.is_dialogue_scene,
                    visual_style=scene_plan.visual_style,
                ))

                full_script_json.append({
                    "scene_index": i,
                    "topic": scene_plan.topic,
                    "visual_style": scene_plan.visual_style,
                    "has_quiz_gate": scene_plan.has_quiz_gate,
                    "narration": scene_script.narration,
                    "estimated_duration_ms": scene_script.estimated_duration_ms,
                })

            await db.execute(
                update(Luminar)
                .where(Luminar.id == uuid.UUID(luminar_id))
                .values(
                    status="script_ready",
                    full_script=full_script_json,
                    key_concepts=blueprint.key_concepts,
                    suggested_next_topics=blueprint.suggested_next_topics,
                    difficulty_hint=difficulty_hint,
                )
            )
            await db.commit()

        await _broadcast(luminar_id, 40, "Script ready — awaiting approval")
        logger.info(f"[Phase 1] Complete for {luminar_id}")

    except Exception as exc:
        logger.exception(f"[Phase 1] Fatal error for {luminar_id}: {exc}")
        await _set_status(luminar_id, "failed")
        await _broadcast(luminar_id, 0, f"Generation failed: {exc}")


# ---------------------------------------------------------------------------
# Phase 2 — Asset generation
# ---------------------------------------------------------------------------

async def _generate_scene_assets(
    luminar_id: str,
    scene: Scene,
    voice_style: str,
    total_scenes: int,
    scene_progress_start: int,
    scene_progress_range: int,
) -> dict:
    """Generate SVG + audio for one scene. Returns asset URLs + actual duration."""
    i = scene.scene_index
    narration = scene.narration_text or ""
    topic = scene.title or f"Scene {i + 1}"

    svg_result = await svg_agent.run(
        f"Topic: {topic}\nVisual style: {scene.visual_style}\n"
        f"Target duration ms: {scene.duration_ms or 30000}\n"
        f"Narration: {narration}"
    )
    svg_output = svg_result.output

    qa_result = await quality_agent.run(
        f"Narration: {narration}\nSVG Source: {svg_output.svg_code}"
    )
    if not qa_result.output.passes:
        logger.warning(f"[Phase 2] QA failed scene {i}, retrying: {qa_result.output.feedback}")
        svg_result = await svg_agent.run(
            f"RETRY — previous feedback: {qa_result.output.feedback}\n"
            f"Topic: {topic}\nVisual style: {scene.visual_style}\n"
            f"Target duration ms: {scene.duration_ms or 30000}\n"
            f"Narration: {narration}"
        )
        svg_output = svg_result.output

    audio_bytes, actual_duration_ms = await generate_tts(
        narration,
        voice_style,
        "[Teacher]" if scene.dialogue_mode else None,
        "[Student]" if scene.dialogue_mode else None,
    )

    svg_url = await upload_file(
        svg_output.svg_code.encode(),
        f"luminars/{luminar_id}/scenes/{i}/animation.svg",
        "image/svg+xml",
    )
    audio_url = await upload_file(
        audio_bytes,
        f"luminars/{luminar_id}/scenes/{i}/audio.mp3",
        "audio/mpeg",
    )

    pct = scene_progress_start + int(scene_progress_range * (i + 1) / max(total_scenes, 1))
    await _broadcast(luminar_id, pct, f"Scene {i + 1}/{total_scenes} ready")

    return {
        "scene_id": str(scene.id),
        "svg_url": svg_url,
        "audio_url": audio_url,
        "actual_duration_ms": actual_duration_ms,
    }


async def generate_assets_job(
    luminar_id: str,
    voice_style: str,
    duration_minutes: int,
) -> None:
    """Generate all scene assets. Triggered after user approves the script."""
    logger.info(f"[Phase 2] Starting asset generation for {luminar_id}")

    try:
        await _set_status(luminar_id, "assets_generating")
        await _broadcast(luminar_id, 42, "Generating animations and audio…")

        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(Scene)
                .where(Scene.luminar_id == uuid.UUID(luminar_id))
                .order_by(Scene.scene_index)
            )
            scenes = list(result.scalars().all())
            total_scenes = len(scenes)

        if not scenes:
            logger.error(f"[Phase 2] No scenes found for {luminar_id}")
            await _set_status(luminar_id, "failed")
            return

        tasks = [
            _generate_scene_assets(
                luminar_id=luminar_id,
                scene=scene,
                voice_style=voice_style,
                total_scenes=total_scenes,
                scene_progress_start=42,
                scene_progress_range=40,  # 42% → 82%
            )
            for scene in scenes
        ]
        asset_results = await asyncio.gather(*tasks, return_exceptions=True)

        # Per-scene resilience: a single scene's SVG/TTS failure degrades that
        # scene (player falls back to a placeholder + estimated duration) rather
        # than failing the whole luminar. Only a total wipeout is fatal.
        asset_map: dict[str, dict] = {}
        failed_scenes = 0
        for scene, r in zip(scenes, asset_results):
            if isinstance(r, Exception):
                failed_scenes += 1
                logger.error(f"[Phase 2] Scene {scene.scene_index} failed, degrading: {r}")
                asset_map[str(scene.id)] = {
                    "scene_id": str(scene.id),
                    "svg_url": None,
                    "audio_url": None,
                    "actual_duration_ms": scene.duration_ms or 0,
                    "degraded": True,
                }
            else:
                asset_map[r["scene_id"]] = r  # type: ignore[index]

        if failed_scenes >= total_scenes:
            logger.error(f"[Phase 2] All {total_scenes} scenes failed for {luminar_id}")
            await _set_status(luminar_id, "failed")
            await _broadcast(luminar_id, 0, "Generation failed: no scenes could be rendered.")
            return
        if failed_scenes:
            await _broadcast(
                luminar_id, 82,
                f"{failed_scenes} of {total_scenes} scenes degraded — continuing.",
            )

        # Build cumulative start times using actual TTS durations
        cumulative_ms = 0
        scene_cumulative: dict[str, int] = {}
        for scene in scenes:
            assets = asset_map.get(str(scene.id))
            actual_ms = assets["actual_duration_ms"] if assets else (scene.duration_ms or 0)
            cumulative_ms += actual_ms
            # trigger_at_ms = end of this scene (quiz fires right as scene ends)
            scene_cumulative[str(scene.id)] = cumulative_ms

        # Quiz generation
        await _broadcast(luminar_id, 83, "Generating quiz questions…")
        total_questions = quiz_count_for_duration(duration_minutes)
        quiz_scenes = [s for s in scenes if s.narration_text][:total_questions]

        quiz_cards_data: list[dict] = []
        if quiz_scenes:
            quiz_topics = "\n".join(
                f"Scene {s.scene_index}: {s.title}" for s in quiz_scenes
            )
            combined_narration = "\n\n".join(
                f"[Scene {s.scene_index} — {s.title}]\n{s.narration_text}"
                for s in quiz_scenes
            )
            quiz_result = await quiz_agent.run(
                f"Generate exactly {total_questions} questions covering these scenes:\n"
                f"{quiz_topics}\n\nNarrations:\n{combined_narration}"
            )
            for j, card in enumerate(quiz_result.output.cards[:total_questions]):
                target_scene = quiz_scenes[min(j, len(quiz_scenes) - 1)]
                quiz_cards_data.append({
                    "scene_id": str(target_scene.id),
                    "luminar_id": luminar_id,
                    "question": card.question,
                    "options": card.options,
                    "correct_index": card.correct_index,
                    "hint": card.hint,
                    "explanation": card.explanation,
                    "difficulty": card.difficulty,
                    "trigger_at_ms": scene_cumulative.get(str(target_scene.id)),
                })

        # Persist asset URLs + quiz cards
        await _broadcast(luminar_id, 90, "Saving assets…")
        async with AsyncSessionLocal() as db:
            for scene in scenes:
                assets = asset_map.get(str(scene.id))
                if assets:
                    await db.execute(
                        update(Scene)
                        .where(Scene.id == scene.id)
                        .values(
                            svg_url=assets["svg_url"],
                            audio_url=assets["audio_url"],
                            duration_ms=assets["actual_duration_ms"],
                        )
                    )

            for qc in quiz_cards_data:
                db.add(QuizCard(
                    scene_id=uuid.UUID(qc["scene_id"]),
                    luminar_id=uuid.UUID(qc["luminar_id"]),
                    question=qc["question"],
                    options=qc["options"],
                    correct_index=qc["correct_index"],
                    hint=qc["hint"],
                    explanation=qc["explanation"],
                    difficulty=qc["difficulty"],
                    trigger_at_ms=qc["trigger_at_ms"],
                ))

            await db.execute(
                update(Luminar)
                .where(Luminar.id == uuid.UUID(luminar_id))
                .values(status="ready")
            )
            await db.commit()

        await _broadcast(luminar_id, 100, "Luminar ready!")
        logger.info(f"[Phase 2] Complete for {luminar_id}")

    except Exception as exc:
        logger.exception(f"[Phase 2] Fatal error for {luminar_id}: {exc}")
        await _set_status(luminar_id, "failed")
        await _broadcast(luminar_id, 0, f"Generation failed: {exc}")

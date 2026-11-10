"""Assessments API — teacher-authored, shareable question sheets on a video.

Answer-leak contract (mirrors quiz.py): non-owners only ever receive
QuestionPublicOut (no correct_index / hint / explanation), can only open
published assessments, and a wrong answer returns a hint, never the answer.
"""
import asyncio
import uuid

from fastapi import APIRouter, Depends, HTTPException, Response
from loguru import logger
from sqlalchemy import select, func, desc
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.v1.auth import get_current_user
from app.core.database import get_db
from app.models.assessment import Assessment, AssessmentQuestion, AssessmentSubmission, AssessmentAnswer
from app.models.luminar import Luminar
from app.models.scene import Scene
from app.models.user import User
from app.schemas.assessment import (
    AnswerIn, AnswerResult, AnswerStateOut, AssessmentCreate, AssessmentOut, AssessmentResponsesOut,
    AssessmentSummary, AssessmentUpdate, DraftQuestionsIn, LearnerResult, ModifyQuestionIn, PublishIn,
    QuestionIn, QuestionOwnerOut, QuestionPublicOut, QuestionStat,
)

router = APIRouter()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _load(db: AsyncSession, assessment_id: uuid.UUID) -> Assessment:
    result = await db.execute(
        select(Assessment)
        .where(Assessment.id == assessment_id)
        .options(selectinload(Assessment.questions), selectinload(Assessment.user))
    )
    assessment = result.scalar_one_or_none()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")
    return assessment


async def _load_owned(db: AsyncSession, assessment_id: uuid.UUID, user: User) -> Assessment:
    assessment = await _load(db, assessment_id)
    if assessment.user_id != user.id:
        # 404 rather than 403 so private assessments aren't discoverable by id.
        raise HTTPException(status_code=404, detail="Assessment not found")
    return assessment


async def _load_visible(db: AsyncSession, assessment_id: uuid.UUID, user: User) -> Assessment:
    assessment = await _load(db, assessment_id)
    if assessment.user_id != user.id and not assessment.published:
        raise HTTPException(status_code=404, detail="Assessment not found")
    return assessment


async def _submission_count(db: AsyncSession, assessment_id: uuid.UUID) -> int:
    return (await db.execute(
        select(func.count(AssessmentSubmission.id)).where(AssessmentSubmission.assessment_id == assessment_id)
    )).scalar_one()


async def _get_owned_luminar(db: AsyncSession, luminar_id: uuid.UUID, user: User) -> Luminar:
    luminar = (await db.execute(
        select(Luminar).where(Luminar.id == luminar_id, Luminar.user_id == user.id)
    )).scalar_one_or_none()
    if not luminar:
        raise HTTPException(status_code=404, detail="Luminar not found")
    return luminar


def _to_out(assessment: Assessment, user: User, submission_count: int) -> AssessmentOut:
    is_owner = assessment.user_id == user.id
    item_cls = QuestionOwnerOut if is_owner else QuestionPublicOut
    return AssessmentOut(
        id=assessment.id,
        user_id=assessment.user_id,
        title=assessment.title,
        objective=assessment.objective,
        source_type=assessment.source_type,
        youtube_url=assessment.youtube_url,
        luminar_id=assessment.luminar_id,
        published=assessment.published,
        is_owner=is_owner,
        author_name=assessment.user.name if assessment.user else None,
        submission_count=submission_count if is_owner else 0,
        created_at=assessment.created_at,
        updated_at=assessment.updated_at,
        questions=[item_cls.model_validate(q) for q in assessment.questions],
    )


def _build_questions(items: list[QuestionIn], source_type: str) -> list[AssessmentQuestion]:
    if source_type == "youtube":
        # Playback pauses at each time_s, so keep them in timeline order.
        items = sorted(items, key=lambda q: (q.time_s is None, q.time_s or 0))
    return [
        AssessmentQuestion(
            position=i,
            time_s=q.time_s if source_type == "youtube" else None,
            question=q.question.strip(),
            options=[o.strip() for o in q.options],
            correct_index=q.correct_index,
            hint=q.hint,
            explanation=q.explanation,
        )
        for i, q in enumerate(items)
    ]


# ---------------------------------------------------------------------------
# AI drafting (stateless — nothing is persisted until the sheet is saved)
# ---------------------------------------------------------------------------

@router.post("/draft-questions")
async def draft_questions(
    body: DraftQuestionsIn,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, list[QuestionIn]]:
    from app.agents.assessment import question_gen_agent, format_timed_transcript
    from app.agents.data_extractor import ExtractionError, fetch_youtube_segments

    if body.source_type == "youtube":
        try:
            segments = await asyncio.to_thread(fetch_youtube_segments, body.youtube_url or "")
        except ExtractionError as exc:
            raise HTTPException(status_code=422, detail=str(exc))
        content = "TIMED TRANSCRIPT:\n" + format_timed_transcript(segments)
    else:
        luminar = await _get_owned_luminar(db, body.luminar_id, current_user)  # type: ignore[arg-type]
        scenes = (await db.execute(
            select(Scene).where(Scene.luminar_id == luminar.id).order_by(Scene.scene_index)
        )).scalars().all()
        if not scenes:
            raise HTTPException(status_code=422, detail="This luminar has no script yet")
        narration = "\n".join(
            f"Scene {s.scene_index + 1} ({s.title or 'untitled'}): {s.narration_text or ''}" for s in scenes
        )
        content = f"UNTIMED LESSON — {luminar.title}\n{narration[:24_000]}"

    prompt = (
        f"QUESTION COUNT: {body.num_questions}\n"
        + (f"OBJECTIVE: {body.objective}\n" if body.objective else "")
        + f"\n{content}"
    )
    result = await question_gen_agent.run(prompt)
    questions = [
        QuestionIn(
            question=q.question,
            options=q.options,
            correct_index=q.correct_index,
            hint=q.hint,
            explanation=q.explanation,
            time_s=q.time_s if body.source_type == "youtube" else None,
        )
        for q in result.output.questions[: body.num_questions]
    ]
    return {"questions": questions}


@router.post("/modify-question", response_model=QuestionIn)
async def modify_question(
    body: ModifyQuestionIn,
    current_user: User = Depends(get_current_user),
) -> QuestionIn:
    from app.agents.assessment import modify_question_agent

    q = body.question
    options = "\n".join(f"  {i}. {o}" for i, o in enumerate(q.options))
    prompt = (
        f"QUESTION: {q.question}\nOPTIONS:\n{options}\n"
        f"CORRECT INDEX: {q.correct_index}\nHINT: {q.hint or ''}\nEXPLANATION: {q.explanation or ''}\n\n"
        f"INSTRUCTION: {body.instruction}"
    )
    result = await modify_question_agent.run(prompt)
    out = result.output
    return QuestionIn(
        id=q.id,
        question=out.question,
        options=out.options,
        correct_index=out.correct_index,
        hint=out.hint,
        explanation=out.explanation,
        time_s=q.time_s,
    )


# ---------------------------------------------------------------------------
# CRUD (owner)
# ---------------------------------------------------------------------------

@router.post("", response_model=AssessmentOut, status_code=201)
async def create_assessment(
    body: AssessmentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AssessmentOut:
    if body.source_type == "luminar":
        await _get_owned_luminar(db, body.luminar_id, current_user)  # type: ignore[arg-type]

    assessment = Assessment(
        user_id=current_user.id,
        title=body.title.strip(),
        objective=body.objective,
        source_type=body.source_type,
        youtube_url=body.youtube_url if body.source_type == "youtube" else None,
        luminar_id=body.luminar_id if body.source_type == "luminar" else None,
        published=body.published,
        questions=_build_questions(body.questions, body.source_type),
    )
    db.add(assessment)
    await db.commit()
    return _to_out(await _load(db, assessment.id), current_user, 0)


@router.get("/me", response_model=list[AssessmentSummary])
async def my_assessments(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[AssessmentSummary]:
    q_count = (
        select(func.count(AssessmentQuestion.id))
        .where(AssessmentQuestion.assessment_id == Assessment.id)
        .scalar_subquery()
    )
    s_count = (
        select(func.count(AssessmentSubmission.id))
        .where(AssessmentSubmission.assessment_id == Assessment.id)
        .scalar_subquery()
    )
    rows = (await db.execute(
        select(Assessment, q_count, s_count)
        .where(Assessment.user_id == current_user.id)
        .order_by(desc(Assessment.created_at))
    )).all()
    return [
        AssessmentSummary(
            id=a.id, title=a.title, objective=a.objective, source_type=a.source_type,
            published=a.published, question_count=qc, submission_count=sc, created_at=a.created_at,
        )
        for a, qc, sc in rows
    ]


@router.get("/{assessment_id}", response_model=AssessmentOut)
async def get_assessment(
    assessment_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AssessmentOut:
    assessment = await _load_visible(db, assessment_id, current_user)
    count = await _submission_count(db, assessment_id) if assessment.user_id == current_user.id else 0
    return _to_out(assessment, current_user, count)


@router.put("/{assessment_id}", response_model=AssessmentOut)
async def update_assessment(
    assessment_id: uuid.UUID,
    body: AssessmentUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AssessmentOut:
    assessment = await _load_owned(db, assessment_id, current_user)
    count = await _submission_count(db, assessment_id)

    if body.title is not None:
        if not body.title.strip():
            raise HTTPException(status_code=400, detail="Title cannot be empty")
        assessment.title = body.title.strip()
    if body.objective is not None:
        assessment.objective = body.objective
    if body.questions is not None:
        if count > 0:
            # Editing questions/answers under existing responses would silently
            # invalidate learners' results. Duplicate the sheet to change them.
            raise HTTPException(
                status_code=409,
                detail="This assessment already has responses — duplicate it to edit the questions.",
            )
        if not body.questions:
            raise HTTPException(status_code=400, detail="An assessment needs at least one question")
        assessment.questions = _build_questions(body.questions, assessment.source_type)

    await db.commit()
    db.expire_all()
    return _to_out(await _load(db, assessment_id), current_user, count)


@router.post("/{assessment_id}/publish")
async def set_published(
    assessment_id: uuid.UUID,
    body: PublishIn,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, bool | str]:
    assessment = await _load_owned(db, assessment_id, current_user)
    assessment.published = body.published
    await db.commit()
    return {"assessment_id": str(assessment_id), "published": body.published}


@router.post("/{assessment_id}/duplicate", response_model=AssessmentOut, status_code=201)
async def duplicate_assessment(
    assessment_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AssessmentOut:
    src = await _load_owned(db, assessment_id, current_user)
    copy = Assessment(
        user_id=current_user.id,
        title=f"{src.title} (Copy)",
        objective=src.objective,
        source_type=src.source_type,
        youtube_url=src.youtube_url,
        luminar_id=src.luminar_id,
        published=False,
        questions=[
            AssessmentQuestion(
                position=q.position, time_s=q.time_s, question=q.question, options=list(q.options),
                correct_index=q.correct_index, hint=q.hint, explanation=q.explanation,
            )
            for q in src.questions
        ],
    )
    db.add(copy)
    await db.commit()
    return _to_out(await _load(db, copy.id), current_user, 0)


@router.delete("/{assessment_id}", status_code=204)
async def delete_assessment(
    assessment_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    assessment = await _load_owned(db, assessment_id, current_user)
    await db.delete(assessment)
    await db.commit()
    return Response(status_code=204)


# ---------------------------------------------------------------------------
# Taking an assessment (learner)
# ---------------------------------------------------------------------------

@router.get("/{assessment_id}/progress", response_model=list[AnswerStateOut])
async def my_progress(
    assessment_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[AnswerStateOut]:
    await _load_visible(db, assessment_id, current_user)
    rows = (await db.execute(
        select(AssessmentAnswer)
        .join(AssessmentSubmission, AssessmentAnswer.submission_id == AssessmentSubmission.id)
        .where(
            AssessmentSubmission.assessment_id == assessment_id,
            AssessmentSubmission.user_id == current_user.id,
        )
    )).scalars().all()
    return [
        AnswerStateOut(question_id=a.question_id, attempts=a.attempts, solved=a.solved, hints_used=a.hints_used)
        for a in rows
    ]


async def _get_or_create_submission(db: AsyncSession, assessment_id: uuid.UUID, user_id: uuid.UUID) -> AssessmentSubmission:
    stmt = select(AssessmentSubmission).where(
        AssessmentSubmission.assessment_id == assessment_id, AssessmentSubmission.user_id == user_id
    )
    submission = (await db.execute(stmt)).scalar_one_or_none()
    if submission:
        return submission
    submission = AssessmentSubmission(assessment_id=assessment_id, user_id=user_id)
    db.add(submission)
    try:
        await db.commit()
    except IntegrityError:
        # Concurrent first answers (double-click) — the other request won.
        await db.rollback()
        submission = (await db.execute(stmt)).scalar_one()
    return submission


async def _wrong_answer_hint(question: AssessmentQuestion, selected_index: int) -> str | None:
    from app.agents.assessment import hint_agent

    options = "\n".join(f"  {i}. {o}" for i, o in enumerate(question.options))
    prompt = (
        f"QUESTION: {question.question}\nOPTIONS:\n{options}\n"
        f"CORRECT OPTION: {question.correct_index}\nSTUDENT CHOSE: {selected_index}"
    )
    try:
        return (await hint_agent.run(prompt)).output
    except Exception as exc:
        logger.warning(f"Hint generation failed for question {question.id}: {exc}")
        return question.hint


@router.post("/{assessment_id}/questions/{question_id}/answer", response_model=AnswerResult)
async def answer_question(
    assessment_id: uuid.UUID,
    question_id: uuid.UUID,
    body: AnswerIn,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AnswerResult:
    assessment = await _load_visible(db, assessment_id, current_user)
    question = next((q for q in assessment.questions if q.id == question_id), None)
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    is_correct = body.selected_index == question.correct_index
    hint = None if is_correct else await _wrong_answer_hint(question, body.selected_index)
    explanation = question.explanation if is_correct else None

    # The owner previewing their own sheet shouldn't pollute the results.
    if assessment.user_id == current_user.id:
        return AnswerResult(
            is_correct=is_correct, attempts=1, solved=is_correct, hint=hint, explanation=explanation, recorded=False
        )

    submission = await _get_or_create_submission(db, assessment_id, current_user.id)
    answer = (await db.execute(
        select(AssessmentAnswer).where(
            AssessmentAnswer.submission_id == submission.id, AssessmentAnswer.question_id == question_id
        )
    )).scalar_one_or_none()
    if answer is None:
        answer = AssessmentAnswer(
            submission_id=submission.id, question_id=question_id,
            attempts=0, solved=False, first_try_correct=False, hints_used=0,
        )
        db.add(answer)

    if not answer.solved:
        answer.attempts += 1
        if is_correct:
            answer.solved = True
            answer.first_try_correct = answer.attempts == 1
        elif hint:
            answer.hints_used += 1
    submission.updated_at = func.now()

    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Answer already being recorded — try again")

    return AnswerResult(
        is_correct=is_correct, attempts=answer.attempts, solved=answer.solved, hint=hint, explanation=explanation
    )


# ---------------------------------------------------------------------------
# Results (owner)
# ---------------------------------------------------------------------------

@router.get("/{assessment_id}/responses", response_model=AssessmentResponsesOut)
async def assessment_responses(
    assessment_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AssessmentResponsesOut:
    assessment = await _load_owned(db, assessment_id, current_user)
    submissions = (await db.execute(
        select(AssessmentSubmission)
        .where(AssessmentSubmission.assessment_id == assessment_id)
        .options(selectinload(AssessmentSubmission.answers), selectinload(AssessmentSubmission.user))
        .order_by(desc(AssessmentSubmission.updated_at))
    )).scalars().all()

    total = len(assessment.questions)
    learners = [
        LearnerResult(
            user_id=s.user_id,
            name=s.user.name,
            email=s.user.email,
            avatar_url=s.user.avatar_url,
            answered=len(s.answers),
            solved=sum(a.solved for a in s.answers),
            first_try_correct=sum(a.first_try_correct for a in s.answers),
            hints_used=sum(a.hints_used for a in s.answers),
            total_questions=total,
            last_activity=s.updated_at,
        )
        for s in submissions
    ]

    by_question: dict[uuid.UUID, list[AssessmentAnswer]] = {}
    for s in submissions:
        for a in s.answers:
            by_question.setdefault(a.question_id, []).append(a)
    stats = []
    for q in assessment.questions:
        answers = by_question.get(q.id, [])
        stats.append(QuestionStat(
            question_id=q.id,
            position=q.position,
            question=q.question,
            answered=len(answers),
            solved=sum(a.solved for a in answers),
            first_try_correct=sum(a.first_try_correct for a in answers),
            avg_attempts=round(sum(a.attempts for a in answers) / len(answers), 2) if answers else 0.0,
        ))

    return AssessmentResponsesOut(total_questions=total, learners=learners, questions=stats)

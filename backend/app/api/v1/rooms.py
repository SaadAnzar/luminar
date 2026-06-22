import random
import string
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from loguru import logger
from pydantic import BaseModel, ConfigDict

from app.core.database import get_db
from app.api.v1.auth import get_current_user
from app.schemas.room import RoomCreate, RoomResponse

router = APIRouter()

def generate_room_code(length: int = 8) -> str:
    """Generate a random alphanumeric room code."""
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=length))

@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_room(
    data: RoomCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> StudyRoom:
    """Create a new study room for a specific luminar and add the host as a participant."""
    logger.info(f"User {current_user.id} creating study room for luminar {data.luminar_id}")
    
    code = generate_room_code()
    
    room = StudyRoom(
        luminar_id=data.luminar_id,
        host_user_id=current_user.id,
        code=code,
        is_active=True
    )
    db.add(room)
    await db.flush() # Get room ID
    
    # Add host as first participant
    participant = StudyParticipant(room_id=room.id, user_id=current_user.id)
    db.add(participant)
    
    await db.commit()
    await db.refresh(room)
    logger.info(f"Study room {room.id} created with code {code}")
    return room

@router.post("/join/{code}")
async def join_room(
    code: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> StudyRoom:
    """Join an active study room using its code."""
    logger.info(f"User {current_user.id} attempting to join room with code {code}")
    
    result = await db.execute(select(StudyRoom).where(StudyRoom.code == code, StudyRoom.is_active))
    room = result.scalar_one_or_none()
    
    if not room:
        logger.warning(f"Join failed: Active room with code {code} not found")
        raise HTTPException(status_code=404, detail="Active room not found")
    
    # Check if already participant
    p_result = await db.execute(
        select(StudyParticipant).where(StudyParticipant.room_id == room.id, StudyParticipant.user_id == current_user.id)
    )
    if not p_result.scalar_one_or_none():
        logger.info(f"Adding user {current_user.id} as participant to room {room.id}")
        participant = StudyParticipant(room_id=room.id, user_id=current_user.id)
        db.add(participant)
        await db.commit()
    
    return room

@router.get("/{room_id}")
async def get_room(
    room_id: uuid.UUID,
    db: AsyncSession = Depends(get_db)
) -> StudyRoom:
    """Retrieve details for a specific study room."""
    result = await db.execute(select(StudyRoom).where(StudyRoom.id == room_id))
    room = result.scalar_one_or_none()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    return room

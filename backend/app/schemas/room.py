import uuid
from pydantic import BaseModel, ConfigDict

class RoomCreate(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    luminar_id: uuid.UUID

class RoomResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    luminar_id: uuid.UUID
    host_user_id: uuid.UUID
    code: str
    is_active: bool

# Legacy Audit: Deprecated Patterns

The following patterns were identified as legacy or debt according to the modernized target architecture:

## Backend (FastAPI/Pydantic/SQLAlchemy)

### 1. Pydantic v1 Config Style
- **Problem**: Using `class Config` and `from_attributes = True` instead of `model_config = ConfigDict(from_attributes=True)`.
- **References**:
  - [app/schemas/user.py:18](file:///Users/anzar/Developer/Personal/hobby/luminar/backend/app/schemas/user.py#L18)
  - All other schema files (to be audited during migration).

### 2. Manual `load_dotenv()`
- **Problem**: Environment variables should be handled exclusively by `pydantic-settings` to ensure early failure and structured validation.
- **Reference**: [app/main.py:1-2](file:///Users/anzar/Developer/Personal/hobby/luminar/backend/app/main.py#L1-L2)

### 3. Celery / Redis Background Tasks
- **Problem**: Entire Celery/Redis stack is deprecated in favor of APScheduler for local/simple task management.
- **References**:
  - `backend/app/tasks/celery_app.py`
  - `backend/app/tasks/generate_video.py`

### 4. Standard Library Logging
- **Problem**: Standard `logging` is used instead of Loguru.
- **Reference**: [app/services/streak_service.py:5-7](file:///Users/anzar/Developer/Personal/hobby/luminar/backend/app/services/streak_service.py#L5-L7)

### 5. Print Statements
- **Problem**: `print()` used for error reporting instead of structured logging.
- **References**:
  - [app/services/progress_publisher.py:14](file:///Users/anzar/Developer/Personal/hobby/luminar/backend/app/services/progress_publisher.py#L14)
  - [app/services/progress_publisher.py:24](file:///Users/anzar/Developer/Personal/hobby/luminar/backend/app/services/progress_publisher.py#L24)

## Frontend (React/CSS)

### 1. Hardcoded Color Values
- **Problem**: Inline hex/hsl values violate the "zero hardcoded colors" rule.
- **References**:
  - [src/index.css:79](file:///Users/anzar/Developer/Personal/hobby/luminar/frontend/src/index.css#L79)
  - [src/components/coding/CodeScene.tsx:56](file:///Users/anzar/Developer/Personal/hobby/luminar/frontend/src/components/coding/CodeScene.tsx#L56)
  - [src/components/player/SceneRenderer.tsx:26](file:///Users/anzar/Developer/Personal/hobby/luminar/frontend/src/components/player/SceneRenderer.tsx#L26)

### 2. Alpha Version Packages
- **Problem**: Using `alpha-25` of Tailwind CSS.
- **Reference**: `frontend/package.json`

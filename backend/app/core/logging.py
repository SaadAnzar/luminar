import sys
import uuid
from loguru import logger
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from fastapi import Request, Response
from app.core.config import settings


def setup_logging() -> None:
    logger.remove()

    if settings.ENVIRONMENT == "production":
        logger.add(
            sys.stdout,
            format="{time:YYYY-MM-DD HH:mm:ss.SSS} | {level: <8} | {extra[request_id]} | {name}:{function}:{line} - {message}",
            serialize=True,
            filter=lambda r: r["extra"].setdefault("request_id", "-") or True,
        )
    else:
        logger.add(
            sys.stdout,
            colorize=True,
            format="<green>{time:HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{extra[request_id]}</cyan> | <magenta>{name}</magenta>:<magenta>{line}</magenta> - <level>{message}</level>",
            level="DEBUG",
            filter=lambda r: r["extra"].setdefault("request_id", "-") or True,
        )


class RequestIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
        with logger.contextualize(request_id=request_id):
            response = await call_next(request)
            response.headers["X-Request-ID"] = request_id
            return response

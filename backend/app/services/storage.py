import boto3
from botocore.config import Config
from loguru import logger
from app.core.config import settings


def _s3():
    return boto3.client(
        "s3",
        endpoint_url=settings.S3_ENDPOINT,
        region_name=settings.S3_REGION,
        aws_access_key_id=settings.S3_ACCESS_KEY_ID,
        aws_secret_access_key=settings.S3_SECRET_ACCESS_KEY,
        config=Config(signature_version="s3v4"),
    )


async def upload_file(file_content: bytes, file_path: str, content_type: str) -> str:
    """Upload to Supabase S3-compatible storage, return public URL."""
    try:
        _s3().put_object(
            Bucket=settings.S3_BUCKET,
            Key=file_path,
            Body=file_content,
            ContentType=content_type,
        )
        url = f"{settings.SUPABASE_URL}/storage/v1/object/public/{settings.S3_BUCKET}/{file_path}"
        logger.info(f"Uploaded: {file_path}")
        return url
    except Exception as e:
        logger.error(f"Storage upload failed: {e}")
        raise

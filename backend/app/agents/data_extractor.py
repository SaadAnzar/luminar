import io
import re

from pydantic import BaseModel, ConfigDict
from pydantic_ai import Agent
import httpx
from loguru import logger


class ExtractionError(Exception):
    """Raised when a source cannot be parsed into usable text."""


class ExtractedContent(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    title: str
    body_text: str           # Full extracted text (may be truncated to 8 000 chars)
    key_facts: list[str]     # 5–10 bullet facts the agent identified
    reading_level: str       # beginner | intermediate | advanced


data_extractor_agent = Agent(
    model="openai:gpt-4o",
    output_type=ExtractedContent,
    system_prompt="""
    You are a content analysis agent for an educational platform.
    Given raw text extracted from a PDF, TXT, DOCX, PPT slide deck, web page,
    or video transcript, produce a structured summary suitable for building a
    lesson script.

    Rules:
    - title: derive a concise title if not obvious from the text
    - body_text: clean, de-duplicated prose — strip headers, footers, page numbers
    - key_facts: 5–10 bullet-point facts the learner must understand
    - reading_level: estimate as beginner / intermediate / advanced based on vocabulary and concept density

    Output only the JSON. Do not add explanation outside the JSON.
    """,
)


async def extract_from_bytes(source_type: str, raw_bytes: bytes) -> ExtractedContent:
    """Extract structured content from uploaded file bytes."""
    text = _parse_bytes(source_type, raw_bytes)
    if not text.strip():
        raise ExtractionError(
            f"Could not extract any text from the uploaded {source_type} file. "
            "It may be empty, scanned/image-only, or corrupt."
        )
    result = await data_extractor_agent.run(f"Source type: {source_type}\n\n{text[:8000]}")
    return result.output


async def extract_from_url(url: str, source_type: str = "website") -> ExtractedContent:
    """Fetch a URL (blog / generic website / YouTube) and extract content."""
    if source_type == "youtube":
        text = _extract_youtube_transcript(url)
    else:
        text = await _fetch_and_clean(url)

    if not text.strip():
        raise ExtractionError(
            f"Could not extract any usable text from {url}. "
            + (
                "The video may have no transcript/captions available."
                if source_type == "youtube"
                else "The page may be empty, blocked, or JavaScript-only."
            )
        )
    result = await data_extractor_agent.run(
        f"Source type: {source_type}\nURL: {url}\n\n{text[:8000]}"
    )
    return result.output


def _parse_bytes(source_type: str, raw_bytes: bytes) -> str:
    if source_type == "pdf":
        return _parse_pdf(raw_bytes)
    if source_type == "txt":
        return raw_bytes.decode("utf-8", errors="replace")
    if source_type == "ppt":
        return _parse_ppt(raw_bytes)
    if source_type == "docx":
        return _parse_docx(raw_bytes)
    return raw_bytes.decode("utf-8", errors="replace")


def _parse_pdf(raw_bytes: bytes) -> str:
    try:
        import pdfplumber
        with pdfplumber.open(io.BytesIO(raw_bytes)) as pdf:
            pages = [p.extract_text() or "" for p in pdf.pages]
        return "\n".join(pages)
    except Exception as exc:
        logger.warning(f"pdfplumber failed: {exc}")
        return ""


def _parse_ppt(raw_bytes: bytes) -> str:
    try:
        from pptx import Presentation
        prs = Presentation(io.BytesIO(raw_bytes))
        lines = []
        for slide in prs.slides:
            for shape in slide.shapes:
                if hasattr(shape, "text"):
                    lines.append(shape.text)
        return "\n".join(lines)
    except Exception as exc:
        logger.warning(f"python-pptx failed: {exc}")
        return ""


def _parse_docx(raw_bytes: bytes) -> str:
    try:
        from docx import Document
        doc = Document(io.BytesIO(raw_bytes))
        parts = [p.text for p in doc.paragraphs if p.text.strip()]
        # Include table cell text — common in study material / handouts.
        for table in doc.tables:
            for row in table.rows:
                cells = [c.text.strip() for c in row.cells if c.text.strip()]
                if cells:
                    parts.append(" | ".join(cells))
        return "\n".join(parts)
    except Exception as exc:
        logger.warning(f"python-docx failed: {exc}")
        return ""


async def _fetch_and_clean(url: str) -> str:
    """Fetch an HTML page and extract its main readable content.

    Uses trafilatura (readability-style main-content extraction) when
    available, falling back to a BeautifulSoup article/main heuristic.
    """
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=15) as client:
            resp = await client.get(
                url, headers={"User-Agent": "Mozilla/5.0 (Luminar/1.0)"}
            )
            resp.raise_for_status()
            html = resp.text
    except Exception as exc:
        logger.warning(f"Failed to fetch URL {url}: {exc}")
        return ""

    try:
        import trafilatura
        extracted = trafilatura.extract(html, url=url, favor_recall=True)
        if extracted and extracted.strip():
            return extracted
    except Exception as exc:
        logger.debug(f"trafilatura extraction failed for {url}, falling back: {exc}")

    return _strip_html(html)


def _strip_html(html: str) -> str:
    try:
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html, "html.parser")
        # Prefer article/main content
        for tag in soup(["script", "style", "nav", "footer", "header"]):
            tag.decompose()
        article = soup.find("article") or soup.find("main") or soup
        return article.get_text(separator="\n", strip=True)
    except Exception:
        return re.sub(r"<[^>]+>", " ", html)


_YOUTUBE_ID_RE = re.compile(
    r"(?:youtu\.be/|youtube\.com/(?:watch\?(?:.*&)?v=|embed/|shorts/|live/))([A-Za-z0-9_-]{11})"
)


def _youtube_video_id(url: str) -> str | None:
    match = _YOUTUBE_ID_RE.search(url)
    return match.group(1) if match else None


def _extract_youtube_transcript(url: str) -> str:
    """Fetch a YouTube video's caption track as plain text.

    v1 relies on available captions (auto-generated or manual). Videos with
    no transcript raise ExtractionError upstream. A Whisper-on-downloaded-audio
    fallback is deferred to v1.5 (see docs/PLAN.md §3.1) to avoid a yt-dlp
    dependency and the associated rate-limit / bot-detection surface.
    """
    video_id = _youtube_video_id(url)
    if not video_id:
        raise ExtractionError(f"Could not parse a YouTube video id from: {url}")
    try:
        from youtube_transcript_api import YouTubeTranscriptApi
        segments = YouTubeTranscriptApi.get_transcript(video_id)
        return " ".join(seg["text"] for seg in segments if seg.get("text"))
    except Exception as exc:
        logger.warning(f"YouTube transcript fetch failed for {url}: {exc}")
        return ""

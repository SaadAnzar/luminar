import pdfplumber
import io
import logging

logger = logging.getLogger(__name__)

async def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """
    Extracts plain text from a PDF byte stream.
    """
    try:
        text = ""
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
        
        # Basic cleanup: remove excessive whitespace
        text = " ".join(text.split())
        return text
        
    except Exception as e:
        logger.error(f"Error parsing PDF: {e}")
        return ""

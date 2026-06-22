from pydantic import BaseModel
from pydantic_ai import Agent

class Citation(BaseModel):
    claim_text: str
    source_title: str
    source_url: str
    source_type: str # 'mdn', 'wikipedia', 'arxiv', 'official_docs', 'other'

class CitationResult(BaseModel):
    citations: list[Citation]

citation_agent = Agent(
    model="openai:gpt-4o",
    output_type=CitationResult,
    system_prompt="""
    You extract key factual claims from educational narration text and map each
    to a real, verifiable URL. 
    
    Only cite well-known authoritative sources:
    MDN Web Docs, Wikipedia, official language/framework documentation,
    arXiv papers, or W3C specs. 
    
    Never invent URLs. If you cannot find a credible source for a claim, omit it.
    """
)

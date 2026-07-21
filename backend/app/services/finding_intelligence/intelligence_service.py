"""
KAVACH — Finding Intelligence Service
Orchestrates one finding's grounded explanation: build a retrieval query
from the finding's own (sanitized) details -> retrieve+rerank against the
knowledge base -> confidence gate -> (generate a structured, citation-
backed explanation | leave narrative sections null). See this package's
__init__.py for the deterministic-vs-generated split this relies on.
"""

import asyncio
import hashlib
import json
import time
from dataclasses import dataclass, field
from typing import Optional

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.metrics import record_rag_operation, record_token_usage
from app.models.finding import Finding
from app.schemas.finding import RawFinding
from app.services.ai.gateway import get_gateway
from app.services.ai.sanitizer import sanitize_finding
from app.services.ai.token_estimator import estimate_tokens
from app.services.assistant import rerank_manager
from app.services.finding_intelligence.prompts import (
    FINDING_INTELLIGENCE_SYSTEM_PROMPT,
    FINDING_INTELLIGENCE_USER_PROMPT_TEMPLATE,
)
from app.services.knowledge_base import embedding_manager, vector_store
from app.services.search_analytics import analytics_service

FEATURE_NAME = "finding_intelligence"

logger = structlog.get_logger(__name__)
settings = get_settings()

INSUFFICIENT_CONTEXT_NOTE = (
    "No sufficiently relevant supporting documentation was found in the knowledge base for this finding. "
    "Upload OWASP/CWE/NIST/PCI-DSS/RBI/SWIFT-CSP reference material or internal remediation guidance to "
    "enable a grounded explanation — showing only the deterministic facts already known from the scan below."
)
NO_PROVIDER_NOTE = (
    "No AI provider is currently configured, so no synthesized explanation could be generated. "
    "See the citations below for the retrieved supporting documentation, and the deterministic facts above."
)
GENERATION_FAILED_NOTE = (
    "The AI provider's response could not be parsed into a structured explanation. "
    "See the citations below for the retrieved supporting documentation, and the deterministic facts above."
)


@dataclass
class Citation:
    document_id: str
    filename: str
    page_number: Optional[int]
    section_path: Optional[str]
    heading: Optional[str]
    similarity_score: float
    rerank_score: float
    excerpt: str


@dataclass
class FindingIntelligence:
    finding_id: str
    # Deterministic — sourced from the Finding row's own columns, never
    # LLM-generated, so never an "unsupported claim."
    cwe_id: Optional[str]
    cwe_name: Optional[str]
    owasp_category: Optional[str]
    owasp_name: Optional[str]
    mitre_technique_ids: list[str]
    pci_clause: Optional[str]
    rbi_clause: Optional[str]
    swift_clause: Optional[str]
    why_detected: str
    # RAG-grounded, LLM-generated — populated only when `grounded` is True
    plain_english_explanation: Optional[str] = None
    business_impact: Optional[str] = None
    technical_impact: Optional[str] = None
    recommended_remediation: Optional[str] = None
    verification_steps: list[str] = field(default_factory=list)
    code_example: Optional[str] = None
    # Always present
    citations: list[Citation] = field(default_factory=list)
    confidence: float = 0.0
    retrieved_count: int = 0
    grounded: bool = False
    note: Optional[str] = None
    latency_ms: float = 0.0


def build_why_detected(finding: Finding) -> str:
    """Fully deterministic — assembled from the finding's own literal scan
    output, not generated, so it needs no confidence gate."""
    scanners = sorted(set(finding.sources or [finding.source]))
    parts = [f"Detected by {', '.join(scanners)} as a {finding.severity.lower()}-severity '{finding.category}' finding"]
    if finding.cwe_id:
        suffix = f" ({finding.cwe_name})" if finding.cwe_name else ""
        parts.append(f"matching {finding.cwe_id}{suffix}")
    if finding.cve:
        parts.append(f"associated with {finding.cve}")
    if finding.file_path:
        location = finding.file_path
        if finding.line_number:
            location += f":{finding.line_number}"
        parts.append(f"in {location}")
    return " ".join(parts) + "."


def build_retrieval_query(raw: RawFinding, finding: Finding) -> str:
    """
    A short, topic-focused phrase — NOT a compound sentence and NOT a
    labeled field dump — verified empirically against this exact rerank
    model, not just a style guess. Two earlier phrasings were tried and
    measured against real retrieved passages before landing here:
      - A labeled field dump ("Category: X\nSeverity: Y\nCWE: Z...")
        retrieved the right passages by cosine similarity (the bi-encoder
        tolerates the style mismatch) but the cross-encoder reranker —
        trained on short web-search-style queries, far more sensitive to
        phrasing — scored every one of them NEGATIVE.
      - A natural-language COMPOUND question that also embedded the full
        verbose PCI/RBI/SWIFT clause descriptions verbatim (those run to
        full sentences, not short codes) was still scored negative — the
        clause prose reads nothing like a MS-MARCO-style query and
        drowned out the actual topic.
    A short, comma-joined topic phrase built from just CWE/OWASP
    names + the package (never the verbose clause text, never MITRE's
    opaque IDs — dropping both measurably improved scores in testing)
    reliably scores well: the same finding's top match went from a
    negative rerank score to +6.1 (confidence 0.998) after this rewrite.
    Compliance clauses/MITRE IDs are unaffected everywhere else — they're
    still shown in full in the deterministic response fields and in the
    generation prompt's context, just not in this specific query string.

    Built from the SANITIZED finding fragment (see app/services/ai/
    sanitizer.py) rather than raw title/description — the same "never
    send scanner-produced text past this boundary" discipline
    app/services/ai/ai_engine.py already enforces, applied here too since
    this same query text also flows into the generation prompt later.
    """
    sanitized = sanitize_finding(raw)

    topic = finding.cwe_name or sanitized.category.replace("_", " ")
    if finding.cwe_id:
        topic += f" ({finding.cwe_id})"

    parts = [topic]
    if finding.owasp_name:
        parts.append(finding.owasp_name)
    if sanitized.package:
        parts.append(f"{sanitized.package} package")
    parts.append("vulnerability remediation, patch management, and compliance requirements")
    return ", ".join(parts)


def _citation_header(citation: Citation) -> str:
    parts = [f"Source: {citation.filename}"]
    section = citation.section_path or citation.heading
    if section:
        parts.append(f"Section: {section}")
    if citation.page_number is not None:
        parts.append(f"Page: {citation.page_number}")
    return ", ".join(parts)


def build_context_block(citations: list[Citation]) -> str:
    return "\n\n".join(
        f"[{index}] ({_citation_header(citation)})\n{citation.excerpt}" for index, citation in enumerate(citations, start=1)
    )


def _strip_json_fences(text: str) -> str:
    clean = text.strip()
    if clean.startswith("```"):
        lines = clean.split("\n")
        clean = "\n".join(lines[1:-1]) if len(lines) > 2 else clean
    return clean


def parse_generated_explanation(raw_response: str) -> dict:
    """Raises json.JSONDecodeError on malformed output — the caller
    decides the fallback, this function only parses."""
    data = json.loads(_strip_json_fences(raw_response))
    if not isinstance(data, dict):
        raise json.JSONDecodeError("expected a JSON object", raw_response, 0)
    return data


def _generate(raw: RawFinding, query: str, context_block: str) -> tuple[Optional[dict], Optional[str]]:
    """Returns (parsed_json, None) on success, or (None, failure_note) —
    distinguishing "no provider configured" from "a provider responded but
    couldn't be parsed" so the caller can report the right reason rather
    than collapsing both into one generic note."""
    sanitized = sanitize_finding(raw)
    prompt = FINDING_INTELLIGENCE_USER_PROMPT_TEMPLATE.format(
        finding_fragment=sanitized.to_prompt_fragment(),
        context_block=context_block,
    )
    context_hash = hashlib.sha256(context_block.encode()).hexdigest()

    response = get_gateway().complete(
        function_name="finding_intelligence",
        system=FINDING_INTELLIGENCE_SYSTEM_PROMPT,
        prompt=prompt,
        cache_payload={"query": query, "context_hash": context_hash},
        max_tokens=1200,
        temperature=0.2,
    )
    if response is None:
        return None, NO_PROVIDER_NOTE

    record_token_usage(
        FEATURE_NAME,
        prompt_tokens=estimate_tokens(FINDING_INTELLIGENCE_SYSTEM_PROMPT) + estimate_tokens(prompt),
        completion_tokens=estimate_tokens(response.text),
    )

    try:
        return parse_generated_explanation(response.text), None
    except json.JSONDecodeError as exc:
        logger.warning("finding_intelligence.parse_failed", provider=response.provider, error=str(exc))
        return None, GENERATION_FAILED_NOTE


async def build_intelligence(db: AsyncSession, *, finding: Finding, raw: RawFinding) -> FindingIntelligence:
    start = time.monotonic()
    success = True
    try:
        result = await _build_intelligence(db, finding=finding, raw=raw, start=start)
    except Exception:
        success = False
        raise
    finally:
        record_rag_operation(FEATURE_NAME, duration_seconds=(time.monotonic() - start), success=success)

    await analytics_service.log_search(
        feature=FEATURE_NAME,
        query=f"finding:{finding.id}",
        result_count=result.retrieved_count,
        top_score=result.confidence if result.retrieved_count else None,
        latency_ms=result.latency_ms,
        user_id=None,
    )
    return result


async def _build_intelligence(
    db: AsyncSession, *, finding: Finding, raw: RawFinding, start: float
) -> FindingIntelligence:
    query = build_retrieval_query(raw, finding)

    query_embedding = await asyncio.to_thread(embedding_manager.embed_query, query)
    candidates = await vector_store.similarity_search(
        db, query_embedding=query_embedding, top_k=settings.assistant_retrieval_candidates
    )

    citations: list[Citation] = []
    confidence = 0.0
    if candidates:
        documents_text = [chunk.content for chunk, _ in candidates]
        rerank_scores = await asyncio.to_thread(rerank_manager.rerank, query, documents_text)
        ranked = sorted(zip(candidates, rerank_scores), key=lambda pair: pair[1], reverse=True)
        top = ranked[: settings.assistant_top_k]
        confidence = rerank_manager.normalize_confidence(top[0][1]) if top else 0.0
        citations = [
            Citation(
                document_id=str(chunk.document_id),
                filename=chunk.document.filename,
                page_number=chunk.page_number,
                section_path=chunk.section_path,
                heading=chunk.heading,
                similarity_score=round(similarity, 4),
                rerank_score=round(rerank_score, 4),
                excerpt=chunk.content,
            )
            for (chunk, similarity), rerank_score in top
        ]

    deterministic = dict(
        finding_id=str(finding.id),
        cwe_id=finding.cwe_id,
        cwe_name=finding.cwe_name,
        owasp_category=finding.owasp_category,
        owasp_name=finding.owasp_name,
        mitre_technique_ids=finding.mitre_technique_ids or [],
        pci_clause=finding.pci_clause,
        rbi_clause=finding.rbi_clause,
        swift_clause=finding.swift_clause,
        why_detected=build_why_detected(finding),
        citations=citations,
        confidence=confidence,
        retrieved_count=len(candidates),
    )

    if confidence < settings.assistant_min_confidence:
        return FindingIntelligence(
            **deterministic, grounded=False, note=INSUFFICIENT_CONTEXT_NOTE,
            latency_ms=round((time.monotonic() - start) * 1000, 1),
        )

    context_block = build_context_block(citations)
    generated, failure_note = await asyncio.to_thread(_generate, raw, query, context_block)

    if generated is None:
        return FindingIntelligence(
            **deterministic, grounded=False, note=failure_note,
            latency_ms=round((time.monotonic() - start) * 1000, 1),
        )

    return FindingIntelligence(
        **deterministic,
        plain_english_explanation=generated.get("plain_english_explanation"),
        business_impact=generated.get("business_impact"),
        technical_impact=generated.get("technical_impact"),
        recommended_remediation=generated.get("recommended_remediation"),
        verification_steps=generated.get("verification_steps") or [],
        code_example=generated.get("code_example"),
        grounded=True,
        note=None,
        latency_ms=round((time.monotonic() - start) * 1000, 1),
    )

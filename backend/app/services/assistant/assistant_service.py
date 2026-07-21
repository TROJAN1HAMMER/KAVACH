"""
KAVACH — AI Assistant Service
Orchestrates one question-answer turn: retrieve -> rerank -> confidence
gate -> (stream a grounded answer | return the fixed insufficient-context
message). See this package's __init__.py for the full pipeline rationale.

`retrieve_and_rerank` is async (it awaits the DB-backed vector search);
`stream_answer` is a plain sync generator, matching
app/api/v1/endpoints/scan.py's existing SSE-streaming convention
(`stream_finding_explanation`) — Starlette's StreamingResponse iterates a
sync generator in a worker thread automatically, so no extra async-bridge
code is needed here, consistent with that established pattern.
"""

import asyncio
import time
import uuid
from dataclasses import dataclass
from typing import Iterator, Optional

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.metrics import record_rag_operation, record_token_usage
from app.services.ai.gateway import get_gateway
from app.services.ai.token_estimator import estimate_tokens
from app.services.assistant import rerank_manager
from app.services.assistant.prompts import ASSISTANT_SYSTEM_PROMPT
from app.services.knowledge_base import embedding_manager, vector_store
from app.services.search_analytics import analytics_service

logger = structlog.get_logger(__name__)
settings = get_settings()

FEATURE_NAME = "assistant_chat"
INSUFFICIENT_CONTEXT_MESSAGE = "I could not find sufficient information inside the KAVACH knowledge base."


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
class RetrievalResult:
    citations: list[Citation]
    context_block: str
    confidence: float
    retrieved_count: int
    sufficient: bool
    retrieval_latency_ms: float


def _citation_header(citation: Citation) -> str:
    parts = [f"Source: {citation.filename}"]
    section = citation.section_path or citation.heading
    if section:
        parts.append(f"Section: {section}")
    if citation.page_number is not None:
        parts.append(f"Page: {citation.page_number}")
    return ", ".join(parts)


def build_context_block(citations: list[Citation]) -> str:
    """Numbered excerpt blocks the system prompt tells the model to cite
    by number — pure/testable independent of retrieval or the DB."""
    return "\n\n".join(
        f"[{index}] ({_citation_header(citation)})\n{citation.excerpt}"
        for index, citation in enumerate(citations, start=1)
    )


def format_history(history: list[dict], max_turns: int) -> str:
    """Renders the last `max_turns` of client-supplied conversation
    history as plain text for the prompt. Deliberately not persisted
    server-side (see package docstring / docs) — the client sends it back
    each turn, and this just bounds how much of it reaches the prompt."""
    recent = history[-max_turns:] if max_turns > 0 else []
    return "\n".join(f"{turn['role'].capitalize()}: {turn['content']}" for turn in recent)


def is_sufficient(confidence: float) -> bool:
    return confidence >= settings.assistant_min_confidence


async def retrieve_and_rerank(
    db: AsyncSession, *, query: str, user_id: Optional[uuid.UUID] = None
) -> RetrievalResult:
    start = time.monotonic()
    success = True
    try:
        query_embedding = await asyncio.to_thread(embedding_manager.embed_query, query)
        candidates = await vector_store.similarity_search(
            db,
            query_embedding=query_embedding,
            top_k=settings.assistant_retrieval_candidates,
        )

        if not candidates:
            result = RetrievalResult(
                citations=[],
                context_block="",
                confidence=0.0,
                retrieved_count=0,
                sufficient=False,
                retrieval_latency_ms=round((time.monotonic() - start) * 1000, 1),
            )
        else:
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

            result = RetrievalResult(
                citations=citations,
                context_block=build_context_block(citations),
                confidence=confidence,
                retrieved_count=len(candidates),
                sufficient=is_sufficient(confidence),
                retrieval_latency_ms=round((time.monotonic() - start) * 1000, 1),
            )
    except Exception:
        success = False
        raise
    finally:
        record_rag_operation(FEATURE_NAME, duration_seconds=(time.monotonic() - start), success=success)

    await analytics_service.log_search(
        feature=FEATURE_NAME,
        query=query,
        result_count=result.retrieved_count,
        top_score=result.citations[0].similarity_score if result.citations else None,
        latency_ms=result.retrieval_latency_ms,
        user_id=user_id,
    )
    return result


def stream_answer(retrieval: RetrievalResult, *, message: str, history: list[dict]) -> Iterator[str]:
    """
    Only ever called after `retrieval.sufficient` is True (see the
    endpoint) — the confidence gate, not this function, is what enforces
    "never answer from model memory if nothing relevant is retrieved."
    """
    history_text = format_history(history, settings.assistant_max_history_turns)
    prompt_sections = []
    if history_text:
        prompt_sections.append(f"Conversation so far:\n{history_text}")
    prompt_sections.append(f"Context excerpts:\n{retrieval.context_block}")
    prompt_sections.append(f"Question: {message}")
    prompt = "\n\n".join(prompt_sections)

    chunk_iter = get_gateway().stream(
        function_name="assistant_chat",
        system=ASSISTANT_SYSTEM_PROMPT,
        prompt=prompt,
        max_tokens=settings.assistant_max_tokens,
        temperature=settings.assistant_temperature,
    )

    if chunk_iter is not None:
        prompt_tokens = estimate_tokens(ASSISTANT_SYSTEM_PROMPT) + estimate_tokens(prompt)
        completion_chars = 0
        for _, text in chunk_iter:
            completion_chars += len(text)
            yield text
        # Estimated, not exact — see app/services/ai/token_estimator.py and
        # docs/production_hardening.md for why an exact provider-reported
        # count isn't available through this codebase's plain-REST
        # provider calls without touching every provider file.
        record_token_usage(
            FEATURE_NAME, prompt_tokens=prompt_tokens, completion_tokens=estimate_tokens("x" * completion_chars)
        )
        return

    # No LLM provider configured (see gateway.py's docstring — this is the
    # expected, documented outcome, not an error). The deterministic
    # fallback surfaces the retrieved excerpts directly rather than
    # fabricating a generated answer — never invent, only ever show what
    # was actually retrieved.
    logger.info("assistant_service.no_provider_configured_using_extractive_fallback")
    yield "No AI model is currently configured, so here are the most relevant excerpts found in the knowledge base:\n\n"
    for index, citation in enumerate(retrieval.citations, start=1):
        yield f"[{index}] ({_citation_header(citation)})\n{citation.excerpt}\n\n"

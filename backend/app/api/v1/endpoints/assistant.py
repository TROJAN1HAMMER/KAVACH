"""
KAVACH — AI Assistant Routes
RAG Milestone 2: a single streaming chat endpoint over the knowledge base
built in Milestone 1. Same SSE pattern as
app/api/v1/endpoints/scan.py's `stream_finding_explanation` (`_sse_pack`
duplicated locally rather than shared — it's a five-line helper and that
file doesn't export it either).

RBAC: gated by Permission.KNOWLEDGE_READ — the same permission
`/knowledge/search` uses (Security Analyst, Security Manager, Admin,
Executive/Board). Asking the assistant a question is a read of the
knowledge base, not a curation action, so it doesn't need
KNOWLEDGE_WRITE. Like `/knowledge/search`, this is a POST-shaped
read-only endpoint, so it's also listed in PermissionMiddleware's
READ_ONLY_QUERY_PATH_PREFIXES (app/middleware/permission_middleware.py)
so Executive/Board isn't wrongly blocked by the coarse verb-based rule.
"""

import json
import time
from typing import Annotated

import structlog
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.permissions import Permission, require_permission
from app.db.session import get_db
from app.middleware.rate_limit import require_rate_limit
from app.models.user import User
from app.schemas.assistant import ChatRequest
from app.services.assistant import assistant_service

logger = structlog.get_logger(__name__)
router = APIRouter()

# Per-user, on top of the global per-IP limit (Milestone 5) — a chat turn
# does an embedding call, a rerank pass, and potentially an LLM
# completion, so this budget is deliberately much tighter than a plain
# read endpoint's would be.
_RATE_LIMIT = require_rate_limit("assistant_chat", limit=20, window_seconds=60)


def _sse_pack(data: str, *, event: str | None = None) -> str:
    prefix = f"event: {event}\n" if event else ""
    data_lines = "\n".join(f"data: {line}" for line in data.split("\n"))
    return f"{prefix}{data_lines}\n\n"


@router.post("/assistant/chat")
async def chat(
    payload: ChatRequest,
    current_user: Annotated[User, Depends(require_permission(Permission.KNOWLEDGE_READ))],
    _rate_limited: Annotated[User, Depends(_RATE_LIMIT)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Server-Sent Events stream. Event sequence:
      "retrieval"           — always sent first: retrieved_count, confidence,
                               and the full citation list (document, page,
                               section, similarity score, excerpt).
      "insufficient_context" — sent INSTEAD of any "token" events when the
                               confidence gate fails; the LLM is never
                               called in this case.
      "token"                — one or more, the streamed answer text.
      "done"                 — always sent last (after "token"s, never after
                               "insufficient_context"): confidence,
                               retrieved_count, latency_ms.
      "error"                 — only if the stream fails part-way through.
    """
    request_start = time.monotonic()
    retrieval = await assistant_service.retrieve_and_rerank(db, query=payload.message, user_id=current_user.id)

    def _event_source():
        yield _sse_pack(
            json.dumps(
                {
                    "retrieved_count": retrieval.retrieved_count,
                    "confidence": retrieval.confidence,
                    "citations": [
                        {
                            "document_id": c.document_id,
                            "filename": c.filename,
                            "page_number": c.page_number,
                            "section_path": c.section_path,
                            "heading": c.heading,
                            "similarity_score": c.similarity_score,
                            "rerank_score": c.rerank_score,
                            "excerpt": c.excerpt,
                        }
                        for c in retrieval.citations
                    ],
                }
            ),
            event="retrieval",
        )

        if not retrieval.sufficient:
            yield _sse_pack(
                json.dumps(
                    {
                        "message": assistant_service.INSUFFICIENT_CONTEXT_MESSAGE,
                        "retrieved_count": retrieval.retrieved_count,
                        "confidence": retrieval.confidence,
                        "latency_ms": round((time.monotonic() - request_start) * 1000, 1),
                    }
                ),
                event="insufficient_context",
            )
            return

        try:
            history = [turn.model_dump() for turn in payload.history]
            for chunk in assistant_service.stream_answer(retrieval, message=payload.message, history=history):
                yield _sse_pack(chunk, event="token")
        except Exception as exc:
            logger.warning("assistant_api.stream_failed", error=str(exc))
            yield _sse_pack("The response stream failed part-way through.", event="error")
            return

        yield _sse_pack(
            json.dumps(
                {
                    "confidence": retrieval.confidence,
                    "retrieved_count": retrieval.retrieved_count,
                    "latency_ms": round((time.monotonic() - request_start) * 1000, 1),
                }
            ),
            event="done",
        )

    return StreamingResponse(
        _event_source(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )

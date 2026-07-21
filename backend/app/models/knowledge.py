"""
KAVACH — Knowledge Base Models
Document ingestion metadata (`KnowledgeDocument`) and the semantic chunks
produced from it (`KnowledgeChunk`), each chunk carrying its own
embedding vector for similarity search — see
app/services/knowledge_base/ for the pipeline that populates these.

A document's lifecycle is `pending -> processing -> indexed | failed`,
the same async-job shape as `ScanJob`/`Report`: the upload endpoint
returns immediately with a `pending` row, and
app/tasks/knowledge_tasks.py's Celery task advances it in place as
extraction/chunking/embedding actually happen.
"""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from pgvector.sqlalchemy import Vector
from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.config import get_settings
from app.db.base import Base
from app.db.mixins import TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.user import User

settings = get_settings()

# pdf | markdown | text
DOCUMENT_TYPE_MAX_LENGTH = 16
# pending -> processing -> indexed | failed
DOCUMENT_STATUS_MAX_LENGTH = 16


class KnowledgeDocument(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "knowledge_documents"

    filename: Mapped[str] = mapped_column(String(512), nullable=False)
    document_type: Mapped[str] = mapped_column(String(DOCUMENT_TYPE_MAX_LENGTH), nullable=False)
    version: Mapped[str] = mapped_column(String(32), nullable=False, default="1")
    # Version chain (Milestone 5 — see document_manager.py's
    # `save_and_register_document`): every version of "the same document"
    # (matched by filename, case-insensitive) shares one
    # `document_group_id` — the FIRST version's own id, so the group has a
    # stable identity without a separate table. `is_latest` is true for
    # exactly one row per group; search/retrieval only ever considers
    # `is_latest=True` rows (see vector_store.similarity_search's join),
    # so a superseded version's chunks are pruned at supersession time
    # (see `supersede_previous_version`) rather than lingering in results.
    # The row itself, and its on-disk file, are kept for audit history —
    # only its chunks/embeddings are removed.
    document_group_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    is_latest: Mapped[bool] = mapped_column(nullable=False, default=True)
    # SHA-256 hex digest of the raw uploaded bytes — an exact re-upload
    # (same hash, anywhere in the table) is rejected outright as a
    # duplicate (see document_manager.py) rather than merely logged, so
    # this has no need for a uniqueness constraint of its own — the
    # rejection happens at the application layer, before a row is ever
    # created for it.
    content_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    author: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)
    tags: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)

    status: Mapped[str] = mapped_column(String(DOCUMENT_STATUS_MAX_LENGTH), nullable=False, default="pending")
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Where the original file lives on disk (settings.knowledge_base_dir) —
    # kept after indexing (not just during processing) so a document can
    # be re-chunked/re-embedded later without asking the user to re-upload.
    file_path: Mapped[str] = mapped_column(String(1024), nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    page_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    chunk_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    uploaded_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    uploaded_by: Mapped[Optional["User"]] = relationship()
    chunks: Mapped[list["KnowledgeChunk"]] = relationship(
        back_populates="document", cascade="all, delete-orphan"
    )


class KnowledgeChunk(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "knowledge_chunks"

    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("knowledge_documents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)

    # Nearest preceding heading text, and the full section breadcrumb
    # ("1 > 1.2 > 1.2.3 Access Control") — both nullable since plain-text
    # uploads and headingless PDF pages have neither.
    heading: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    section_path: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    page_number: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    token_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    embedding: Mapped[list[float]] = mapped_column(Vector(settings.knowledge_embedding_dim), nullable=False)

    document: Mapped["KnowledgeDocument"] = relationship(back_populates="chunks")


# retrieval | assistant_chat | finding_intelligence | executive_ask — one
# per RAG feature that performs a knowledge-base search.
SEARCH_ANALYTICS_FEATURE_MAX_LENGTH = 32


class SearchAnalyticsLog(UUIDPrimaryKeyMixin, Base):
    """
    Milestone 5 — persists what Milestone 1's search_service only ever
    logged transiently (structlog, never queryable). Append-only, same
    shape convention as app/models/audit_log.py: UUIDPrimaryKeyMixin
    alone (no `updated_at` — a search event never changes after it
    happened), manual `created_at`.
    """

    __tablename__ = "search_analytics_logs"

    feature: Mapped[str] = mapped_column(String(SEARCH_ANALYTICS_FEATURE_MAX_LENGTH), nullable=False, index=True)
    query: Mapped[str] = mapped_column(Text, nullable=False)
    result_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # The best (highest) similarity/confidence score among the results —
    # null when result_count is 0. A sustained low top_score for a given
    # query pattern is the signal that the knowledge base has a coverage
    # gap for that topic, which is the whole point of persisting this.
    top_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    latency_ms: Mapped[float] = mapped_column(Float, nullable=False)
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )


FEEDBACK_FEATURE_MAX_LENGTH = 32


class Feedback(UUIDPrimaryKeyMixin, Base):
    """
    Milestone 5 — user-submitted relevance/quality signal on a specific
    RAG output (a search result, a chat answer, a finding explanation, an
    executive answer). `reference_id` is deliberately a free-form string
    rather than a foreign key: it points at whichever entity the feature
    in question uses as an identity (a chunk id, a finding id, a
    client-generated chat-message id) — there is no single table every
    feature's feedback target belongs to, so a polymorphic FK would need
    one nullable column per possible target table for no real benefit
    over just storing the id as text.
    """

    __tablename__ = "feedback_entries"

    feature: Mapped[str] = mapped_column(String(FEEDBACK_FEATURE_MAX_LENGTH), nullable=False, index=True)
    reference_id: Mapped[str] = mapped_column(String(255), nullable=False)
    # +1 (helpful/thumbs-up) or -1 (unhelpful/thumbs-down) — a simple
    # binary signal rather than a 1-5 scale, since that's all any of the
    # current UI surfaces ask for.
    rating: Mapped[int] = mapped_column(Integer, nullable=False)
    comment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )

"""
KAVACH — Finding Intelligence (RAG Milestone 3)

Grounded, structured explanation for a single finding, built on top of the
Milestone 1 knowledge base and the Milestone 2 retrieve-then-rerank
pipeline (both reused unmodified — see intelligence_service.py's imports).

Two categories of output, never mixed:
  - Deterministic facts (CWE, OWASP, MITRE, PCI/RBI/SWIFT clauses, "why the
    scanner detected it") come straight from the Finding row's own
    already-computed columns (app/services/aggregation/,
    app/services/compliance/) or from the finding's literal scan data.
    These are re-presented, never generated, so they cannot be an
    "unsupported claim" — there's nothing to hallucinate.
  - Narrative sections (plain-English explanation, business/technical
    impact, remediation, verification steps, code example) are only
    generated when knowledge-base retrieval clears the same confidence
    gate app/services/assistant/ uses, and only from a closed-context
    prompt containing just the retrieved excerpts + the finding's
    sanitized (never raw scanner text — see app/services/ai/sanitizer.py)
    details. Below the gate, or with no LLM provider configured, these
    stay null rather than ever being filled with invented content.

Modules:
  prompts.py             — the closed-context system prompt.
  intelligence_service.py — the only module app/api/v1/endpoints/
                           finding_intelligence.py calls.
"""

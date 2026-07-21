# Finding Intelligence — RAG Milestone 3

Builds on the Milestone 1 knowledge base and Milestone 2 retrieve-then-rerank
pipeline (`app/services/knowledge_base/`, `app/services/assistant/rerank_manager.py`)
— both reused unmodified. Adds `GET /api/v1/findings/{finding_id}/intelligence`
and a new "AI Intelligence" section in the Finding Detail modal, shown whenever
a user opens a finding in the Finding Explorer.

## The core design decision: two kinds of output, never mixed

**Deterministic facts** — CWE ID/name, OWASP category/name, MITRE ATT&CK
technique IDs, PCI-DSS/RBI/SWIFT-CSP clauses, and "why this was flagged" — come
straight from the `Finding` row's own already-computed columns
(`app/services/aggregation/`, `app/services/compliance/`). These are
**re-presented, never generated**. There is nothing an LLM could hallucinate
here because no LLM ever touches these fields — they cannot be an "unsupported
claim" by construction, not because a model was told to be careful.

**Generated narrative** — plain-English explanation, business impact,
technical impact, recommended remediation, verification steps, code example —
only appear when knowledge-base retrieval clears the exact same confidence
gate Milestone 2's AI Assistant uses. Below the gate, every one of these
fields stays `null`. This is the same guarantee Milestone 2 makes for chat:
the LLM is never called at all unless retrieval found something to ground it in.

## Pipeline

```
finding opened
  │
  ▼
1. Deterministic facts   — read directly off the Finding row. Always
                           returned, regardless of what follows.
  │
  ▼
2. Build a retrieval query — a short, topic-focused phrase built from the
                           finding's CWE/OWASP names + package (see "A
                           real bug found and fixed" below for why this
                           is NOT a natural sentence or a field dump)
  │
  ▼
3. Retrieve + rerank      — cosine search (top 20) then cross-encoder
                           rerank (top 5) against the knowledge base —
                           the exact Milestone 1/2 code, unmodified
  │
  ▼
4. Confidence gate        — below threshold: stop here, narrative fields
                           stay null, `note` explains why
  │
  ▼
5. Generate (only if gate passed) — one non-streaming LLM call
                           (app/services/ai/gateway.py's complete(), which
                           already Redis-caches by content hash) asking
                           for a strict JSON object with the narrative
                           fields, grounded only in the retrieved excerpts
                           + the finding's SANITIZED details (see below)
```

If no LLM provider is configured (this deployment's default), step 5 can't
run — the response still returns everything from steps 1–4 (deterministic
facts + citations + confidence), with `grounded: false` and a `note`
explaining that no provider is configured. **The narrative fields are never
back-filled with anything else** — not extractive text, not a template —
because unlike Milestone 2's chat (where showing the raw excerpts as the
"answer" makes sense), semantically-typed fields like "business impact" can't
honestly be filled from an arbitrary excerpt without implying the excerpt
verified/support each area specifically.

## A real bug found and fixed: query phrasing matters more than expected

The first version of the retrieval query was a labeled field dump
(`"Category: X\nSeverity: Y\nCWE: Z..."`). Live testing against a real
finding (CWE-1104, "Use of Unmaintained Third Party Components") and a
genuinely on-topic uploaded policy document showed something important: the
embedding-based vector search found the *right* passages (cosine similarity
0.65–0.82), but the cross-encoder reranker scored every one of them
**negative** — collapsing confidence to ~0.002 and blocking the LLM call
despite a good match.

Root cause: `Xenova/ms-marco-MiniLM-L-6-v2` is trained on short web-search-style
query/passage pairs and is far more sensitive to query phrasing than the
bi-encoder used for the initial vector search. A verbose field dump — or even
a natural-language compound sentence that embedded the finding's full,
paragraph-length PCI/RBI/SWIFT clause descriptions verbatim — reads nothing
like the queries it was trained on. Measured directly against the same three
passages, three phrasing styles were compared before landing on the fix:

| Query style | Top-1 rerank score |
|---|---|
| Labeled field dump | −6.23 |
| Natural compound question + full clause text | −4.66 |
| **Short topic phrase** (`"Use of Unmaintained Third Party Components (CWE-1104), Vulnerable and Outdated Components, vulnerability remediation, patch management, and compliance requirements"`) | **+5.55** |

`build_retrieval_query()` now builds this short, comma-joined topic phrase
from just the CWE/OWASP **names** and the package — deliberately dropping the
verbose compliance-clause text and MITRE's opaque IDs from *this specific
query string* (they measurably hurt the score and add no retrieval value).
Both remain fully intact everywhere else — the deterministic response fields,
and the generation prompt's context, where an LLM handles structured/verbose
input just fine unlike the reranker.

## Retrieving OWASP/CWE/NIST/PCI/RBI/SWIFT content specifically

The retrieval mechanism is framework-agnostic — it matches whatever's actually
indexed. **KAVACH does not ship with OWASP/CWE/NIST/PCI-DSS/RBI/SWIFT-CSP
reference text pre-loaded** (bundling large/licensed standards text is out of
scope here); an admin or analyst needs to upload that material via Milestone
1's `POST /knowledge/upload` for this milestone's retrieval to have anything
framework-specific to find. Without it, every finding still gets its full
deterministic facts (the CWE/OWASP/compliance identifiers themselves come from
KAVACH's own aggregation/compliance engines, not the knowledge base) — it just
won't have a generated narrative to go with them.

## Security: the sanitizer boundary is reused, not reinvented

`app/services/ai/sanitizer.py`'s `sanitize_finding()` — the existing, enforced
"never send raw scanner-produced text to an LLM provider" boundary
(`app/services/ai/ai_engine.py` already uses it for the pre-existing
`ai_explanation` fields) — is reused unmodified for both the retrieval query
and the generation prompt. Raw `finding.title`/`finding.description` never
reach either. `why_detected` is the one exception, and deliberately so: it's
100% local/deterministic (never sent to any LLM), so the sanitizer's concern
(don't leak scan-specific text to a *third party*) doesn't apply — the user
viewing their own finding in their own dashboard already sees the same
file path/description directly elsewhere on the same page.

## Configuration

Reuses Milestone 2's assistant settings entirely
(`ASSISTANT_RETRIEVAL_CANDIDATES`, `ASSISTANT_TOP_K`, `ASSISTANT_MIN_CONFIDENCE`)
— no new settings were introduced for this milestone.

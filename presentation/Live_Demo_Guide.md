# KAVACH — Live Demo Guide

This is a practical run-sheet for the ~2–3 minute live demo that sits at Slide 19 of the deck
(`Live Demonstration Flow`). It covers what to prepare *before* you're in the room, the exact
click-path, timing, and a fallback if something breaks live.

---

## 1. Before you're in the room (setup checklist)

Do this the night before, not the morning of.

- [ ] **Bring up the full stack**: `cd backend && docker compose up --build` (Postgres+pgvector,
      Redis, API, both Celery worker pools, beat, Flower, frontend). Confirm `GET /health/ready`
      returns 200 with `postgres`, `pgvector`, and `redis` all healthy.
- [ ] **Run migrations**: `alembic upgrade head` (seeds the 7 default business modules and 7 BRS
      factor weights from migration `0004_business_risk_config`).
- [ ] **Create one demo account per role you plan to show** — at minimum an `admin` and a
      `security_engineer`/`developer` account, via `/api/v1/auth/register` then
      `PATCH /api/v1/auth/admin/users/{id}/role`. Logging in as different roles live is a strong,
      concrete way to prove RBAC isn't just a UI toggle.
- [ ] **Upload 1–2 real reference documents to the Knowledge Base** (`/knowledge`) *before* the
      demo — e.g. an OWASP Top 10 PDF or a PCI DSS excerpt. Without this, the AI Assistant and
      Finding Intelligence will correctly, deterministically refuse ("insufficient information"),
      which is honest but not a compelling demo moment. Do a dry-run query beforehand to confirm
      the confidence gate actually clears 0.5 for the questions you plan to ask live.
- [ ] **Decide your AI provider mode before you're on stage, not during**: if you don't have
      reliable venue Wi-Fi/internet, set `AI_MODE=local` with Ollama running, or accept that the
      pipeline will gracefully fall back to the deterministic rule-based templates — that's a real
      feature (a scan never blocks on AI availability), so narrate it as one if it happens rather
      than treating it as a failure.
- [ ] **Run the Flutter app** ahead of time against the same `API_BASE_URL` as your backend —
      either an Android emulator with screen mirroring, or `flutter run -d chrome` for a quick web
      preview — logged in and sitting on the Dashboard tab, ready to alt-tab to.
- [ ] **Pick your scan target now**: the built-in sandbox payloads (`POST
      /api/v1/scan/premade/{low|medium|high}`) are the reliable choice — no network dependency, no
      "will this repo actually have interesting findings" risk. Run each one once beforehand so you
      know their actual finding counts and BRS scores and aren't surprised live.
- [ ] **Pre-warm caches**: run the scan you intend to demo at least once before going live so
      Celery workers, embedding models, and the rerank model are already loaded in memory (their
      first cold call is measurably slower than subsequent ones).
- [ ] **Have a recorded screen-capture backup** of the entire flow below, trimmed to ~90 seconds,
      on a laptop with no dependency on venue Wi-Fi. If live infrastructure fails, say so plainly
      and cut to the recording — a jury respects composure over a dead terminal.

---

## 2. The click-path (maps to Slide 19)

Budget **2–3 minutes** total. Narrate what's happening technically while you click — don't demo in
silence.

| Step | Action | What to say while it loads |
|---|---|---|
| **1. Repository Upload** | On the dashboard, trigger `POST /scan/premade/high` (or upload a real small repo if you have one you trust) | "We're submitting the bundled high-risk sandbox payload — a repo with deliberately planted issues so you can see the full pipeline react." |
| **2. Scan** | Immediately switch to the Scan Queue / Scan Detail page and let the WebSocket progress update live | "Watch the per-scanner status update in real time — this is a live WebSocket feed off Redis, not a polling spinner. All nine scanners are running in parallel right now." |
| **3. Risk Score** | Once complete, open the scan's Risk tab | "There's the Banking Risk Score and its risk band — not a flat CVSS number, a blend of seven factors including which business module this landed in." |
| **4. AI** | Click into one Critical/High finding → show the automated explanation, then switch to the AI Assistant and ask a question the pre-uploaded KB document can actually answer | "This explanation was generated automatically as part of the scan. And here's the Assistant answering a question with a live citation back to the document we uploaded — if I ask something it can't ground, it will refuse rather than guess." *(Have this second question ready and pre-tested.)* |
| **5. Compliance** | Open the Compliance tab for the same scan | "This is recomputed live, right now, against the same YAML rule files — RBI, PCI DSS, SWIFT CSP — with the exact finding that failed each control." |
| **6. Executive PDF** | Trigger the Executive PDF report download | "One click, and a board-facing PDF comes out the other side — this is the same document a bank's risk committee would actually read." |
| **7. Dashboard** | Return to the main Risk/Executive dashboard | "Zoomed out — BRS trend, severity distribution, compliance posture, across everything we've scanned." |
| **8. Mobile App** | Alt-tab / switch device to the pre-logged-in Flutter app, pull to refresh the Dashboard or Scan Queue tab | "And the same scan, same backend, same RBAC — checked from the phone. Not a separate product." |

---

## 3. The two moments most likely to land

If time is short and you have to cut something, protect these two:

1. **Live WebSocket scan progress (Step 2).** It's the single clearest proof this is a real,
   working distributed system and not a static mockup.
2. **The AI Assistant refusing or grounding correctly (Step 4).** Anyone can show an AI chat
   answering a question. Showing that it *won't* answer without evidence — and then showing it
   answer correctly *with* a citation once evidence exists — is the actual differentiator, and
   worth the extra 15 seconds it takes to make the contrast explicit.

## 4. What NOT to demo live

- **Don't demo the Flutter placeholder screens** (Risk Dashboard, Finding Explorer, Compliance,
  Executive Summary, Notifications, Settings on mobile) as if they were live features — they are
  honestly-labeled placeholders (see `mobile/docs/backend_gaps.md`). If asked, say so directly;
  don't tap into them expecting real data.
- **Don't demo SAML SSO** — both routes deterministically return `503 Service Unavailable` by
  design. If a juror asks about SSO, answer with OAuth2/OIDC or LDAP instead, both of which are
  real, working flows.
- **Don't promise a live CI/CD "merge-blocking gate"** — today's real capability is webhook-
  triggered scanning plus SARIF export into existing code-scanning UIs, not an enforced branch
  check. Slide 18 already states this correctly; don't overstate it live in the excitement of a
  demo.
- **Don't rely on a live cloud LLM call over conference Wi-Fi** as your only path — always have the
  local-model or template-fallback path as your real plan, and treat the fallback as a feature to
  narrate ("a scan never blocks on AI availability") rather than something to apologize for.

## 5. Fallback plan if live infrastructure fails

1. Stay calm, say what happened in one sentence ("looks like we've lost the connection to our
   backend — let me switch to a capture of the exact same flow recorded this morning").
2. Cut to the pre-recorded ~90 second screen capture from the setup checklist.
3. Continue narrating over the recording exactly as written in the click-path table above — the
   words don't need to change, only the source of the picture.
4. Do not attempt to debug live in front of the jury. Finish the recording, move to Slide 20, and
   offer to demo it live again afterward if anyone wants to see it working in person.

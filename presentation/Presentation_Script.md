# KAVACH — PSB Hackathon 2026 Presentation Script

**Target run time: ~11.5 minutes of narration** (leaves room in a 12-minute slot for breathing
room / a stumble; pair with `Live_Demo_Guide.md` for where to break away to the live product).
Cumulative timestamps assume you start speaking as soon as Slide 1 is on screen.

Read this as a script, not a transcript to memorize verbatim — say it in your own words, but hit
the same beats and the same specific facts/numbers in the same order. Bold text = emphasize.

---

### Slide 1 — Title (0:00 – 0:30)

"Good [morning/afternoon]. We're Team Kavach from Vellore Institute of Technology, and this is
**KAVACH** — an AI-powered DevSecOps platform we built for PSB Hackathon 2026, targeting Problem
Statement 3: automated discovery of misconfigurations in open-source dependencies for banking
applications. Everything you'll see in the next ten minutes is running code, not mockups — and
where something *isn't* finished, we'll tell you that too."

### Slide 2 — About PSB Hackathon (0:30 – 0:55)

"Quick context on why we built it this way. PSB Hackathon 2026 is led by the Department of
Financial Services under the Ministry of Finance, with the Indian Banks' Association, hosted by
UCO Bank and IIT Kharagpur. The mission is explicit — strengthen cybersecurity across India's
Public Sector Banks. That's not a generic enterprise; it's banks running hybrid legacy-plus-modern
stacks under RBI, PCI DSS, and SWIFT obligations, with security teams too thin to review every
release by hand. Every design decision in KAVACH traces back to that constraint."

### Slide 3 — Problem Statement (0:55 – 1:30)

"The problem statement itself: banking apps depend on hundreds of open-source libraries. Existing
SCA tools catch **known CVEs** and stop there — they miss insecure defaults: hardcoded passwords,
weak cipher suites, insecure configuration, unsafe dependency usage. Developers miss things under
release pressure, and the attack surface grows faster than anyone reviews it. The ask is a platform
that scans code *and* dependencies, catches CVEs *and* misconfigurations, plugs into CI/CD, and
gives back a report someone can actually act on. That's the bar we built against."

### Slide 4 — Industry Challenges (1:30 – 2:05)

"And this isn't hypothetical. Open-source malware discovered in a single year is up **75%**,
per Sonatype's 2026 supply chain report. Their earlier report found something sharper: **95%** of
the time a vulnerable component gets pulled into a build, a fix already existed — this is a
patching gap, not a detection gap, which is exactly what Problem Statement 3 is calling out.
Verizon's 2025 breach report puts exploited vulnerabilities and misconfigurations at **37%** of
breaches. And in India specifically, BFSI averaged **4.1 million** attacks a month in 2025 with
248-plus confirmed bank breaches. The bottleneck isn't finding known CVEs — it's everything CVE
databases don't cover."

### Slide 5 — Our Solution (2:05 – 2:35)

"So here's KAVACH, end to end: a repository goes in, CI/CD or a webhook triggers it, nine
independent scanners run in parallel, an AI layer explains what was found, a risk engine scores
it, a compliance engine maps it to regulation, and seven report formats come out the other side.
Every one of those boxes is a real, running service — we'll open several of them up now."

### Slide 6 — Why Existing Solutions Fall Short (2:35 – 3:10)

"We want to be fair here — SonarQube, Snyk, GitHub Advanced Security, OWASP Dependency-Check, and
Semgrep are all good tools, and one of them, Semgrep, is literally running inside KAVACH. What none
of them ship is a **banking-specific business risk score** instead of flat CVSS, **automatic
mapping to RBI, PCI DSS, and SWIFT CSP clauses**, or a **grounded, citation-backed AI layer** on
top of cross-tool correlation. That's not a knock on those tools — it's just not their lane. It's
ours."

### Slide 7 — System Architecture (3:10 – 3:50)

"Here's the full system — 22 components across six layers, and this is drawn directly from our
own architecture, not an idealized diagram. Ingress: repository, webhook, gateway, auth.
Orchestration: a Redis-backed priority queue and distributed Celery workers. Nine parallel
scanners. An intelligence layer — aggregation, the Banking Risk Score, compliance, AI explanation.
A RAG knowledge layer. And delivery — reports, dashboard, notifications, storage. Every box here
is a real Python module in our backend."

### Slide 8 — Scan Pipeline (3:50 – 4:20)

"A scan can start from a manual upload, a direct URL, or a **verified GitHub webhook** — HMAC
signature-checked — and all three converge on one path. The queue dispatches all nine scanners as
a Celery *chord*: they run in parallel, each with its own timeout and retry, and the chord callback
— aggregation — fires automatically once every scanner returns, success or failure. Progress
streams live over WebSocket, backed by Redis, so what you see on the dashboard is real per-scanner
state, not a fake spinner."

### Slide 9 — Parallel Scanning Engine (4:20 – 5:00)

"Nine independent tools, not nine steps of one script. Semgrep with a custom rule pack — and a
regex fallback if the binary's missing. Joern for code-property-graph reachability from dangerous
sinks back to untrusted input. AST-Grep, structurally independent of Semgrep. A dependency scanner
that itself runs **three** independent lookups — pip-audit, OSV.dev, and a rate-limited NVD search
— because one database alone misses things. A configuration scanner for Kubernetes, Compose, and
GitHub Actions. And a dedicated secrets engine. They run on named priority queues — critical
through low — with a dedicated worker pool so an urgent scan never waits behind a backlog."

### Slide 10 — Attack Surface Exposure (5:00 – 5:35)

"One thing we want to be precise about: this is called **Attack Surface Exposure**, not
'zero-day prediction' — we changed that name ourselves, because it overclaimed what a heuristic
can support. It's a 0-to-100 index built from six capped, additive factors — dependency count,
CVE density, staleness, risky packages, config risk, code vulnerability density. It ships with a
fixed confidence of **0.55** and is explicitly labeled a prototype in the code — with a documented
path to a calibrated classifier later, not a claim that it's one today."

### Slide 11 — Business Risk Score (5:35 – 6:15)

"This is our core differentiator. A CVSS 9.8 in an internet-facing Payments module is not the same
risk as the same CVSS in an internal reporting tool nobody touches — CVSS alone can't say that. Our
**Banking Risk Score** blends seven factors — CVSS at 30%, business-module criticality at 20%,
exploitability at 15%, internet exposure, compliance impact, and asset value at 10% each, and
historical incidents at 5% — into a 0-to-100 score with calibrated, unit-tested risk bands. And
critically, every weight and every business module — Payments, Authentication, Customer Data — is
stored in Postgres and editable through our API, live, with no redeploy."

### Slide 12 — AI Intelligence Layer (6:15 – 6:50)

"AI shows up in two places. First, every finding gets an automatic explanation from a
provider-agnostic gateway — Claude, OpenAI, Gemini in the cloud, or Ollama and vLLM locally — with
a template fallback so a scan **never** blocks on AI availability. Second, an on-demand RAG layer
covering chat, per-finding deep-dives, and executive Q&A. And we enforce this structurally, not
just as policy: the AI layer only ever *reads* finding data to build a prompt. It never writes a
score. Scoring is a completely separate code path the AI never touches."

### Slide 13 — Knowledge Base / RAG (6:50 – 7:30)

"Here's why that AI layer is safe to trust. Documents get chunked and embedded locally — no
external API call — into Postgres with pgvector. A query retrieves the top 20 chunks by
similarity, a cross-encoder reranks down to the top 5, and a **sigmoid-normalized confidence score
has to clear 0.5 before the model is even called.** Below that threshold, KAVACH deterministically
refuses — it physically never invokes the LLM. Above it, the model sees *only* the retrieved
excerpts, so it can't answer from its own training data. Every answer carries real citations —
document, section, page, similarity score."

### Slide 14 — Compliance Engine (7:30 – 8:05)

"Compliance mapping — RBI IT Framework 2021, PCI DSS v4.0, SWIFT CSP — is entirely YAML-driven.
Adding a new framework is dropping a file into a folder, zero code changes. Every control has a
trigger — category, severity, source, keywords — and any matching finding fails that control with
full evidence attached. It's live-recomputed on every request, not frozen at scan time. And we say
this plainly, in the code itself: this is **our own illustrative mapping** for continuous
self-assessment — it is *not* a certified PCI QSA, RBI, or SWIFT attestation."

### Slide 15 — Role-Based Access Control (8:05 – 8:30)

"Five roles, enforced at the backend two ways — a middleware that blocks any mutating request from
a read-only-shaped role outright, and 13 fine-grained permissions checked per route. Administrator,
Security Manager, Security Analyst, Executive/Board Member, and Read Only. The web and mobile
clients read this same table, but only to hide navigation — the backend is the only real security
boundary, and every login, role change, and denial is audit-logged."

### Slide 16 — Flutter Mobile Application (8:30 – 9:00)

"We also shipped a native Flutter app against the *same* backend and the *same* RBAC — Riverpod,
a Dio client with a JWT-refresh interceptor mirroring the web app, models generated to match our
backend schemas field-for-field. Dashboard, repositories, starting a scan, and scan queue with
cancel are fully wired to real endpoints today. In the interest of not overstating anything: Risk
Dashboard, Finding Explorer, Compliance, and a few others are honestly-labeled placeholders,
because the backend doesn't expose the cross-scan endpoints they'd need yet — and we say exactly
that in our own repo documentation."

### Slide 17 — Frontend Experience (9:00 – 9:30)

"The web console is React 19 with a genuine two-palette dark mode — not default scaffolding — real
WebSocket-driven live scan progress, and thirteen-plus role-aware pages. The showcase piece is a 3D
architecture explorer built on React Three Fiber — adaptive to device tier, custom geometry per
node, glassmorphism detail panels on click — and it's public, no login required, specifically so
anyone evaluating us can explore the system design directly."

### Slide 18 — CI/CD Integration (9:30 – 9:55)

"Two separate things here. KAVACH has its own real CI/CD — GitHub Actions runs our tests, validates
our Helm chart, and deploys on merge to main. Separately, KAVACH integrates into *your* CI/CD: a
verified GitHub webhook auto-triggers a scan, and SARIF export plugs straight into GitHub or
GitLab's existing code-scanning tab. We'll say plainly — a merge-blocking gate isn't shipped yet;
that's on our future-scope slide, not oversold here."

### Slide 19 — Live Demonstration Flow (9:55 – 10:10)

"Let's make this real. [**Transition to live demo here — see `Live_Demo_Guide.md`.**] We'll walk a
repository through upload, scan, risk score, AI, compliance, an executive PDF, the dashboard, and
the same scan checked from the mobile app."

*(Live demo happens here — budget 2–3 minutes separately from this 11.5-minute script; see the
demo guide for the exact click-path and a fallback if live infrastructure isn't available on the
day.)*

### Slide 20 — Results (10:10 – 10:35)

"What does this actually deliver? Nine scanners' worth of overlapping findings collapse into one
correlated set per scan. Our own RAG benchmark shows p50 end-to-end retrieval around 100 to 200
milliseconds with no LLM call, sustaining roughly 46.6 requests a second under load. Every
completed scan produces all seven report formats automatically. We're only citing numbers we can
point at in our own repo — no invented percentage improvements."

### Slide 21 — Future Scope (10:35 – 11:00)

"We're honest about what's next in three tiers. Actively in progress: wiring the mobile app's live
scan progress to our existing WebSocket endpoint, a cross-scan rollup API, full SAML validation. On
our roadmap: a notifications inbox, a knowledge graph, root-cause intelligence, a security copilot
that *proposes* rather than silently applies a fix. And clearly labeled as vision, not started yet:
an IDE plugin and multi-bank SaaS packaging."

### Slide 22 — Thank You (11:00 – 11:15)

"Thank you. We're Team Kavach — Harshith B, Tejashwan Gangishetty, and Pratham Lal, from Vellore
Institute of Technology. Everything we've shown is in our GitHub repository, and every claim in
this deck is backed by a fact-checklist we're submitting alongside it. Happy to open any file live
if you'd like to verify something yourselves. Questions?"

---

## Timing summary

| Segment | Slides | Budget |
|---|---|---|
| Framing (hackathon, problem, industry) | 1–4 | ~2:05 |
| Solution & competitive position | 5–6 | ~1:05 |
| Architecture & pipeline | 7–9 | ~1:50 |
| Risk & AI/RAG core | 10–13 | ~2:35 |
| Compliance, RBAC, mobile, frontend, CI/CD | 14–18 | ~2:35 |
| Live demo transition | 19 | ~0:15 + live demo |
| Close | 20–22 | ~1:05 |
| **Total narration** | | **~11:30** |

If you're running long, the safest cuts are: shorten Slide 7 (skip reading every node aloud — let
the diagram speak), and compress Slides 15–17 into one breath each. Do **not** cut Slides 10, 11,
13, or 14 — those are the slides that answer the problem statement directly and are most likely to
be questioned by the jury.

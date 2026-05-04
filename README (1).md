# Counsel·Co

> Most legal AI tools are built around the AI. This one is built around the audit trail.

A governance toolkit for law firms using AI. Four modules — contract review, AI use policy drafting, vendor TOS due diligence, and arbitration research — sharing one tamper-evident audit ledger. Every AI suggestion is reviewable, every human decision is recorded.

**[Live demo →](#)** &nbsp;·&nbsp; **[90-second walkthrough →](#)**

![Counsel·Co dashboard](docs/screenshot-dashboard.png)

---

## Contents

- [What this is](#what-this-is)
- [Origin](#origin)
- [The four modules](#the-four-modules)
- [Architecture](#architecture)
- [Stack](#stack)
- [Running it](#running-it)
- [Design decisions worth noting](#design-decisions-worth-noting)
- [What's deliberately not here](#whats-deliberately-not-here)
- [Roadmap](#roadmap)
- [Disclaimer](#disclaimer)
- [License](#license)
- [About](#about)

---

## What this is

Three observations drove the build.

**Most legal AI products optimize for the AI's confidence. The actual constraint is human defensibility.** A partner reviewing an associate's work product needs to know what the AI proposed, what the human did with it, and why. Existing tools surface the suggestion. They don't capture the decision.

**The governance gap is bigger than the capability gap.** Mid-market firms (50–300 attorneys) face the same AI governance problem as BigLaw and have none of the budget. They need policies, vendor diligence, contract review, and research — with audit trails — without standing up a six-figure compliance team.

**You build the audit trail in from the start, or you don't get one.** Bolting telemetry onto an existing AI workflow is harder than building the workflow around the telemetry from day one. Counsel·Co is what happens when you do the second thing.

---

## Origin

I built this after preparing for an Innovation Manager, Applied AI role at a major law firm. I didn't get the job. So I built what I would have shipped in the first 90 days — the four AI workloads the firm explicitly identified as priority (research, policy review, vendor governance, contract analysis) and the audit infrastructure they would have needed underneath.

This is a working artifact, not a slide deck. Open it, paste a contract, watch a real audit log accumulate.

---

## The four modules

Each module is a self-contained AI workflow with its own accent color (you always know which one you're in). They share infrastructure: design system, persistent storage, audit ledger, and Claude API access.

### 1 · Redline — contract review

Paste a contract. Claude returns a structured analysis: document type, plain-English summary, ranked risks (high / medium / low), and specific suggested redlines with original text, proposed replacement, and rationale.

Each suggestion presents three actions: **Accept** (use the AI's proposal as-is), **Edit** (modify it before applying), **Reject** (keep the original). Every decision writes to the audit ledger with both the AI's proposal and the human's final language captured side by side.

The Safe Version point: AI never auto-applies anything. Suggestions are presented; humans decide.

### 2 · Policy — AI use policy generator

Parameterize by firm name, attorney count, practice areas, jurisdictions, risk tolerance (conservative / moderate / progressive), and free-text concerns. Claude generates a 9-section policy: Permitted Uses, Prohibited Uses, Approved Tools, Confidential Information & Client Data, Client Disclosure, Output Review, Training Data Restrictions, Incident Reporting, Sanctions for Violations.

Edit any section inline; every edit creates a version snapshot. The **History view** renders a timeline of changes with word-level diffs (Longest Common Subsequence algorithm, green-add / red-strike rendering). You can see exactly what changed, when, and by whom. Export as Markdown for handoff to firm management or compliance.

### 3 · Vendor — AI vendor TOS due diligence

Paste a vendor's terms of service or DPA. Claude scores seven categories: Data Rights & Training (does the vendor train models on your inputs?), Confidentiality & Security, IP Ownership, Indemnification, Jurisdiction, Termination & Portability, and Compliance Certifications. Each category gets a risk level, the specific clause cited from the source TOS, and a recommended action. Per-category decisions: **Approve**, **Negotiate**, **Block**.

### 4 · Research — arbitration corpus search

Natural-language query over a corpus of international arbitration awards. **BM25 retrieval** ranks the corpus locally; **Claude synthesizes** an answer using only the retrieved awards, with inline `[AW-XXX]` citations and **explicit confidence calibration**: `strong` / `moderate` / `weak` / `none`.

When the corpus has no relevant awards, the system says so — instead of inventing precedent. The included demo corpus contains 12 fictional-but-structurally-realistic awards covering ICSID, ICC, LCIA, PCA, SIAC, and UNCITRAL forums.

---

## Architecture

### The audit ledger is the spine

Every module emits `AuditEvent` objects to a shared ledger:

```js
{
  id: "redline-1730403291-x7k2",
  timestamp: "2025-11-01T14:14:51.000Z",
  module: "redline" | "policy" | "vendor" | "research",
  action: string,
  payload: { /* module-specific structured data */ }
}
```

The uniform shape means the cross-module Ledger view doesn't need per-module rendering logic — `humanizeAction()` and `summarizePayload()` are the only places that care about specifics, and they're contained.

Cross-module audit is the demo. Do work in any module, then click the Ledger and watch the trail accumulate across products. That's the thing BigLaw can't ship internally fast enough and mid-market firms can't build at all.

### Persistence

Three storage keys via Anthropic's `window.storage` (which persists across artifact sessions):

| Key | Contents |
|---|---|
| `counselco-ledger` | Full audit event array |
| `counselco-policies` | Saved policy library, including full version history |
| `counselco-vendors` | Saved vendor risk assessments |

Hydration on mount, persistence on every state change. If `window.storage` is unavailable, the app falls back to in-memory state — graceful degradation, not a crash.

### Single-file React, intentional

The entire app is one `.jsx` file (~2,900 lines). This is a deliberate choice for a portfolio piece:

- **Cloneable in 10 seconds.** No build pipeline to figure out. Drop it into any React environment and it runs.
- **Greppable.** Looking for the BM25 implementation? It's in this file.
- **Forkable.** A non-trivial number of legal innovation people aren't full-stack engineers. A single file is approachable.

The cost: it's not how you'd structure a production codebase. The roadmap below addresses this.

### AI integration

All Claude calls go through one helper:

```js
async function callClaude(prompt, maxTokens = 2000)
```

Each module sends a structured prompt demanding JSON output, then `parseJSON()` strips markdown fences and parses. Schema is enforced in the prompt itself — explicit field names, types, constraints. Errors fall through to user-facing error states with retry prompts.

For Research, the pipeline is two-step:

1. **BM25 retrieval** — local, deterministic, no API call
2. **LLM synthesis** — Claude reads only the retrieved awards, not its full training memory

This is what's actually meant by "grounded RAG" in legal contexts: the model is constrained to a known corpus, and the audit trail records what was retrieved.

### Why BM25, not vector search

The artifact API exposes `/v1/messages` but no embeddings endpoint, so vector search wasn't an option. But BM25 is the right call for legal text anyway — exact terminology like "FET" (Fair and Equitable Treatment), "DCF," and "manifest excess of powers" matters, and BM25 captures exact-term matching while vector search blurs it. Production legal RAG often uses BM25 + LLM rerank for exactly this reason.

### Calibrated confidence

The Research module returns one of four confidence levels based on corpus support:

| Confidence | Threshold |
|---|---|
| `strong` | 3+ awards with directly on-point holdings from comparable tribunals |
| `moderate` | 2–3 awards with on-point holdings, or strong analogies from different forums |
| `weak` | 1 award, or only loosely analogous holdings |
| `none` | No award materially addresses the query |

When BM25 retrieval returns zero scoring matches, the LLM call is **skipped entirely** — Claude doesn't get the chance to invent precedent from training memory. That's the discipline.

---

## Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | React 18, single-file | Portability, forkability |
| Styling | Tailwind core utilities + inline styles + CSS variables | No build-step dependency |
| Typography | Fraunces (display) + IBM Plex Sans/Mono | Editorial-legal aesthetic |
| Icons | lucide-react | Consistent stroke weights |
| AI | Claude Sonnet 4 via `/v1/messages` | Best instruction-following for structured JSON output |
| Retrieval | Hand-rolled BM25 (k1=1.5, b=0.75) | No external deps, deterministic, exact-term matching |
| Persistence | `window.storage` (Anthropic artifacts) | Cross-session persistence without backend |
| Diff algorithm | Custom LCS, word-level | No external diff library required |

---

## Running it

### In Claude.ai artifacts (zero setup)

The file is built for the claude.ai artifact runtime. Open it as a React artifact in any Claude conversation — Anthropic API access, font CDN, and `window.storage` persistence are all provided by the host. No API keys, no config.

### Standalone fork

To run outside artifacts:

1. Replace `fetch("https://api.anthropic.com/v1/messages")` calls with a server-side proxy that adds your `ANTHROPIC_API_KEY` (do not ship the key client-side).
2. Replace `window.storage` calls with `localStorage`, IndexedDB, or a real backend (Supabase works well).
3. Set up Tailwind with the core utility classes used in the file (the imports are at the top of the artifact's `<style>` block).
4. Google Fonts are CDN-imported inside the component — no extra setup needed.

Recommended path: drop into a Vite + React app, add `/api/claude` as a Next.js or Express route that proxies to Anthropic with auth, swap storage for Supabase or `localStorage`. Roughly two hours of work.

```bash
# Sketch
npm create vite@latest counselco -- --template react
cd counselco
npm install lucide-react
# Copy counselco.jsx into src/
# Wire up /api/claude proxy with your ANTHROPIC_API_KEY
# Replace window.storage with localStorage (or Supabase)
```

---

## Design decisions worth noting

**Calibrated confidence over confident bluffing.** Most legal AI surfaces a single answer with no uncertainty signal. Research surfaces uncertainty as a first-class output. When the corpus is thin, the system says so — instead of pretending it isn't.

**Per-module accent colors, restrained palette.** Cream + charcoal base across all modules, with one saturated accent per module: oxblood (Redline), forest (Policy), steel-blue (Vendor), deep teal (Research). The palette is unified enough to feel cohesive, distinct enough that you navigate by color before you read a header.

**No autonomous actions.** Every AI suggestion in every module requires explicit human action before anything is applied. There is no "auto-accept all," no batch processing, no agent mode. This is the philosophical opposite of the current trend in agentic AI — and it's what regulated work actually needs.

**Transparency about retrieval.** The Research module shows both *cited* awards (used in the synthesis) AND *non-cited but retrieved* awards (BM25 ranked them highly, Claude didn't lean on them). That distinction makes the system inspectable. You can see when retrieval found something the synthesis ignored.

**Sample data is fictional and obviously so.** "Republic of Andoria," "Hartwell & Associates," "ModelCo." Nobody confuses these for real entities. Demos work without privacy concerns.

**Editorial-legal aesthetic by intent.** The visual language draws from law-firm editorial design — serif display fonts, generous whitespace, paper-cream surfaces, restrained accents. The product is for lawyers; it should feel native to their world, not like consumer SaaS bolted onto a regulated industry.

---

## What's deliberately not here

A senior-engineering signal worth being explicit about — knowing what you didn't build matters as much as what you did:

- **No tests.** This is portfolio-stage code, not production-stage. Adding a Vitest harness would be the first move on a serious fork.
- **No authentication.** Single-user via `window.storage`. Multi-user requires real auth and a real backend.
- **No real PDF parsing.** Paste-only input. Adding `pdf.js` for upload is straightforward but out of scope.
- **No tamper-evident ledger primitives.** The audit trail is append-only in practice but not cryptographically chained. v2 would add hash chaining for actual non-repudiation.
- **No firm-internal corpus integration.** Research uses a fixed demo corpus. Production deployment ingests ICSID Resolved Cases, PCA Awards, and firm work product.
- **No real-time collaboration.** Single-user editing. Multi-user editing on policies would need OT/CRDT.

These aren't bugs. They're the line between a portfolio piece and a product, and I want it visible.

---

## Roadmap

### v1.1 — production hardening

- Authentication via Supabase Auth or Clerk
- Server-side proxy for all Claude API calls (no client-side keys)
- Real backend persistence (Supabase or Postgres)
- File upload for contracts (`pdf.js` for PDF parsing, `mammoth` for `.docx`)
- Whole-policy diff view (currently per-section only)
- Vitest test harness

### v1.2 — corpus integration

- Real ICSID Resolved Cases ingestion (~1,000+ public awards)
- PCA Awards Series corpus
- Firm-internal work product ingestion (BM25 by default; embeddings if available)
- Hybrid retrieval: BM25 first-pass, LLM rerank, optional vector second-pass

### v2 — multi-user and enterprise

- Team workspaces with role-based access
- Cryptographically chained audit events for genuine non-repudiation
- SOC 2 Type II path
- Slack and Teams integration for review workflows
- White-label deployment for firms

### Things I'd build if a firm asked

- Custom policy templates per practice group
- Vendor scorecard registry (cross-firm benchmarks)
- Compliance-officer dashboard (cross-firm trend analysis)
- Export adapters for major matter management systems (iManage, NetDocuments)

---

## Disclaimer

**This is not legal advice.** Counsel·Co generates AI-assisted drafts and analyses for review by qualified counsel. AI output may contain errors. Final responsibility rests with the reviewing attorney.

The included sample arbitration corpus, NDA, vendor TOS, and firm profile are fictional and not based on any real awards, agreements, or entities.

---

## License

MIT.

---

## About

Built by **Thomas Ortega** in Miami. Technology & Innovation Workforce Manager at Miami Dade College, where I run AI tooling adoption and employer partnerships for the MDC Works tech-placement program. I also build [Coral AI](#) (AI career intelligence) and [EveryMoto](#) (motorcycle social platform).

I'm sharing this publicly because the audit-trail-first approach to legal AI is undervalued, and the easiest way to argue for it is to ship it. If this perspective resonates and your team is hiring, working on something similar, or evaluating tools — I'd like to talk.

**Reach me:** [LinkedIn](#) · [cortega4@mdc.edu](mailto:cortega4@mdc.edu)

---

*Counsel·Co — v0.1 — `2025`*

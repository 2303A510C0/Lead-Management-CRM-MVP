# Gharpayy LeadOps — Full-Stack Assessment MVP

A focused Lead Management CRM MVP with three activated assessment modules, two new product ideas, and a working REST backend with persistent JSON storage.

## Activated assessment modules

1. **M-POWER CALL** — call purpose, known lead context, questions to confirm, guided script, timer, outcome capture, notes, next follow-up and automatic CRM write-back through the backend.
2. **Movement CARE** — daily result promise, prioritized 30-lead queue, one-lead-at-a-time work capture, outcome tracking, progress, day close, and WhatsApp-ready summary through the backend.
3. **Booking Flow Split** — split operator workspace with a WhatsApp-style conversation, CRM questions/answers, next step, deadline, closing promise, status and backend persistence.

**Core CRM:** **Lead Command Center / Leads** provides searchable/filterable lead management, intent score, next action visibility, add-lead flow, quick call action and quick movement action.

## Booking Flow Split

The operator sees a customer conversation on the left and the CRM decision workspace on the right. The workspace captures decision questions, concrete answers, next step, deadline and a closing promise. Saving the flow writes the operator decision back into the lead record.

## Two new ideas

### 1. NEXT-ACTION AI
After every interaction, recommend the single next action using stage, intent, budget, timeline and call notes. The MVP uses deterministic rules; an LLM can be added later.

**Success metric:** reduce time-to-next-action.

### 2. LEAKAGE GUARD
A live queue for unassigned leads, overdue follow-ups, repeated unanswered calls and stale movement, with one-click reassign/revive actions as a next iteration.

**Success metric:** reduce overdue/stale leads.


## Assessment scope — all three modules together

This submission treats the three requested surfaces as one closed-loop operator system sharing the same lead record and backend persistence:

```text
Lead Command Center
        │
        ├── 1. M-POWER CALL
        │      Context → Call → Outcome → Notes → Follow-up → CRM write-back
        │
        ├── 2. Movement CARE
        │      Daily promise → Reserve 30 → Work one-by-one → Results → Close day → WhatsApp update
        │
        └── 3. Booking Flow Split
               WhatsApp context ↔ CRM questions → Next step → Deadline → Closing promise → Ready to Book
```

A single lead can move through these workflows without losing its state. This demonstrates the core product loop: **context → action → capture → next action → conversion**.

## Acceptance checklist

- [x] M-POWER CALL is executable from a lead and writes call intelligence back to the backend.
- [x] Movement CARE reserves up to 30 leads, works them one-by-one, tracks results, and closes with a WhatsApp-ready update.
- [x] Booking Flow Split presents conversation context beside the CRM and persists questions, answers, next step, deadline, closing promise, and status.
- [x] All three modules share the same persistent lead store.
- [x] Demo contains 30 seed leads so the Movement CARE requirement is visible immediately.
- [x] No external npm dependency is required for the local demo.
- [x] Reset Demo returns the workspace to a clean interview state.

## Backend

The project includes a **Node.js REST backend** using Node's built-in `http` module, so it has **zero external npm dependencies**.

### API endpoints

- `GET /api/health` — health check
- `GET /api/leads` — list/search/filter leads
- `GET /api/leads/:id` — get one lead
- `POST /api/leads` — create a lead
- `POST /api/leads/:id/calls` — log a call, update outcome/stage/next action and persist notes
- `PATCH /api/leads/:id/movement` — move a lead through the workflow
- `GET /api/stats` — dashboard metrics
- `GET /api/movement-care/today` — today’s Movement CARE session
- `POST /api/movement-care/start` — start the daily promise + reserve up to 30 leads
- `POST /api/movement-care/today/leads/:id/complete` — save action + result for one lead
- `POST /api/movement-care/close` — close the day and persist the summary
- `GET /api/booking-flow/:id` — load WhatsApp-style context and CRM booking workspace for a lead
- `POST /api/booking-flow/:id` — save answers, next step, deadline, closing promise, status and conversation context
- `POST /api/reset` — reset demo data

Data is persisted in `backend/data/*.json` for the assessment MVP, so no external database is required.

## Run locally — easiest way

### Windows

Double-click **`START.bat`**.

### Terminal

```bash
node backend/server.js
```

Then open:

`http://localhost:3000`

Node.js 18+ is recommended. No `npm install` is required.

## Architecture

```text
Browser (index.html)
        |
        | REST / JSON
        v
Node.js HTTP Server (backend/server.js)
        |
        +--> backend/data/leads.json
        +--> backend/data/calls.json
        +--> backend/data/movements.json
        +--> backend/data/movement-care.json
        +--> backend/data/booking-flows.json
```

 

## Deployment

Deploy the project as a Node.js web service on Render, Railway, Fly.io, or another Node-compatible host. Use `node backend/server.js` as the start command. The same Node process serves both the frontend and API.

## Scope note

Phone calling, WhatsApp delivery, authentication, role permissions, and real AI are represented as integration points rather than production integrations. The assessment MVP focuses on the closed-loop CRM workflow:

**Lead → Qualify → Act → Capture → Next Action → Move/Convert**

 

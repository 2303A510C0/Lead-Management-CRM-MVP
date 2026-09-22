# Gharpayy LeadOps — Assessment Submission

## Requested modules

### 1. M-POWER CALL — Call Conversation Engine
**Route:** `/mpower`

**Operator workflow**
- Open a lead and choose M-POWER CALL.
- See why the call is happening.
- See what is already known about the lead.
- See what needs to be confirmed.
- Use a suggested call script.
- Start/end the call and capture duration.
- Select an outcome.
- Add notes and a follow-up date.
- Save and write the result back to the CRM.

**Backend:** `POST /api/leads/:id/calls`

### 2. Movement CARE — Daily Draft + Result Promise
**Route:** `/movement`

**Operator workflow**
- Start the day with a result promise.
- Reserve 30 leads in priority order.
- Take the next lead one at a time.
- Choose an action and result.
- Add a result note.
- Save the result; the next unfinished lead is loaded automatically.
- See worked/qualified progress.
- Close the day.
- Copy or open the generated WhatsApp update.

**Backend:**
- `POST /api/movement-care/start`
- `GET /api/movement-care/today`
- `POST /api/movement-care/today/leads/:id/complete`
- `POST /api/movement-care/close`

### 3. Booking Flow Split — Operator Workspace
**Route:** `/booking`

**Operator workflow**
- Select a lead.
- Read the WhatsApp-style conversation on the left.
- Capture answers to decision-critical questions on the right.
- Set the immediate next step.
- Set a concrete deadline.
- Write a closing promise.
- Save or mark the flow Ready to Book.
- Refresh and see the saved CRM state.

**Backend:**
- `GET /api/booking-flow/:id`
- `POST /api/booking-flow/:id`

## End-to-end story

A lead can move through all three modules in one session:

`Lead → M-POWER CALL → Movement CARE → Booking Flow Split → CRM write-back`

The same `lead.id` is used across the APIs, so operator actions remain connected.

## Tech stack

- Frontend: HTML, CSS, vanilla JavaScript
- Backend: Node.js built-in `http` server
- Persistence: JSON files for MVP/demo purposes
- Local run: `START.bat` or `node backend/server.js`
- External dependencies: none required

## Interview demo script

1. Open `http://localhost:3000`.
2. Go to **Leads** and open the top Hot lead.
3. Run **M-POWER CALL** and save an `Interested` outcome with a follow-up date.
4. Refresh the browser to show the write-back persisted.
5. Open **Movement CARE**, start today with a promise such as `Work 30 leads and create 2 qualified opportunities`.
6. Use **Take Next Lead**, save one or two outcomes, and point out that the next unfinished lead loads automatically.
7. Close the day and show the WhatsApp-ready update.
8. Open **Booking Flow Split**, capture answers, set `Confirm booking`, add a deadline and closing promise, then save as `Ready to Book`.
9. Refresh and show the saved booking state on the same lead.
10. Finish with **NEXT-ACTION AI** and **LEAKAGE GUARD** as the two additional product ideas.

## Scope note

Real phone calling and real WhatsApp messaging are intentionally represented as MVP operator flows and handoff points. This keeps the assessment honest while demonstrating the backend write-back and end-to-end product workflow.

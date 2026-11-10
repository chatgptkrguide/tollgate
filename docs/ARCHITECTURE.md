# Tollgate architecture

This document is the plan the code follows. When the code and this file disagree, fix one of them in the same commit.

**Build status.** Everything below is built and in `main`, and the live demo runs it on Render's free plan with Turso: visitor demo copies and their limits, PayPal invoices (create, send, cancel, quote again) with the send caps, the payment webhook and "Check payment", the live Claude scope review with its call caps, the activity panel, the Delivery panel, and the five screen languages with the client language on the invoice. A GitHub Actions job pings the demo every 10 minutes to keep it awake. The one planned item is the daily health check with an alert to the maintainer (§10).

## 1. Product in one paragraph

Freelancers agree on a scope with a client, then the client keeps adding requests in chat and email. Tollgate compares each new client message with the agreed scope, marks the phrases that add work, and proposes a change order priced from the freelancer's own hourly rate. The freelancer approves it, Tollgate sends a PayPal invoice, and a PayPal webhook marks it paid. Extra work stays locked until its change order is paid; the payment webhook unlocks it and moves the delivery date.

**Who:** solo freelancers and small studios billing clients abroad in USD. **Core loop:** paste message, review marks, send change order, get paid.

## 2. Scope of the hackathon build

| Must (MVP) | Should, once the core loop runs on the deployed app | Not doing |
|:--|:--|:--|
| One project with agreed scope items, an hourly rate and an agreed launch date | | Accounts, sign-up, teams |
| Paste a client message, Claude marks scope additions | | Multi-currency (USD only) |
| Change order lifecycle: draft, sent, paid, waived, cancelled | | Email or chat inbox integration |
| PayPal invoice per change order (create, send, read the payer link, cancel) | | Mobile app |
| Webhook confirms payment, with a "Check payment" fallback; totals update | | Live PayPal (sandbox only) |
| Activity panel: each step Claude and the app took, including what went to PayPal | | Payouts and Orders APIs |
| Delivery panel: unpaid work locked, paid work unlocked, launch moved by the paid days | | |
| Public demo: every visitor gets their own sandbox copy of the demo project | | Agent Toolkit chat assistant |
| | | Claude drafting the first scope (the agreed scope is typed in or seeded) |
| | | An invoice for the agreed scope itself |
| | | A Bryntum timeline (dropped Nov 5: the trial's terms don't fit a public demo; the Delivery panel shows the same rule) |

## 3. Principles

1. **The agent proposes, the person approves.** No invoice is created, sent, or cancelled without a click from the freelancer. Claude never sees PayPal credentials and never moves money.
2. **Prices come from the freelancer's rate, not from the model.** Claude estimates hours; the app computes `hours × hourly rate`. The reasoning shown to the user is the model's, the arithmetic is ours.
3. **Every money state change is idempotent.** A double click, a retried request, or a duplicate webhook must not create a second invoice or flip a status twice.
4. **Domain logic is plain TypeScript.** Status rules and money math live in `src/domain` with no framework or I/O, so they are unit tested.
5. **Public repo hygiene.** Secrets live only in `.env.local` / the host's env. Sample data is fictional.
6. **The browser sends ids, not amounts.** Server actions load prices and statuses from the database, so a forged request can't change what gets billed.
7. **The public demo can't hurt anyone else.** There are no accounts, so each visitor works on their own copy, only in the PayPal sandbox, with Claude calls capped.

## 4. System overview

```
 Browser (React, Next.js App Router)
    │  server actions                         ┌──────────────────────────┐
    ▼                                         │ Anthropic API (Claude)   │
 Next.js server ── src/server/ai ────────────▶│ structured scope review  │
    │                                         └──────────────────────────┘
    ├── src/domain      (pure rules, money)
    ├── src/server/db   (Drizzle + libSQL/SQLite file)
    │                                         ┌──────────────────────────┐
    ├── src/server/paypal ───────────────────▶│ PayPal REST (sandbox)    │
    │     OAuth token cache, Invoicing v2     │ invoices, webhook verify │
    │                                         └────────────┬─────────────┘
    └── POST /api/webhooks/paypal  ◀──────────────────────┘ INVOICING.INVOICE.PAID
```

## 5. Domain model

All money is stored as integer cents. Dates are ISO strings in UTC. Every project is a visitor's demo copy: `projects.created_at` is when the copy was created or last reset, and `last_seen_at` is when it was last opened.

| Entity | Key fields | Notes |
|:--|:--|:--|
| `Project` | id, client name, client email, title, hourly rate, hours per day, agreed on, due date, client locale | One per engagement. `client_locale` (`en` `ko` `ja` `es` `pt`, default `en`) is the language the PayPal invoice is written in (§12) |
| `ScopeItem` | id, project id, title, amount, position | The agreed scope, version 1 |
| `Message` | id, project id, from (`client` \| `me`), author, sent at, body | Pasted text, stored as written |
| `Finding` | id, message id, quote, quote start/end, title, estimated hours, reason | A phrase Claude marked; `quote` must be an exact substring of the body, and its offsets are stored so the screen never searches again |
| `ChangeOrder` | id, project id, finding id, title, hours, amount, extra days, status, PayPal invoice id, payer view URL, sent at, paid at, send claimed at | Created from a finding when the user reviews it. One live order per finding; after a cancel the finding can be quoted again. `send_claimed_at` marks a send in progress so a second request doesn't call PayPal; it expires after two minutes. |
| `ActivityEvent` | id (insertion order), project id, change order id, kind, actor, summary, detail (JSON), at | One line in the activity panel. Written in the same `db.batch()` as the state change it describes |
| `WebhookEvent` | PayPal event id (unique), type, invoice id, outcome, event created at, received at, processed at | Makes webhook handling idempotent. Recorded in the same `db.batch()` as the order change; a second row with the same id rolls the batch back |
| `PayPalSend` | id, change order id, at | One row per PayPal send the server allowed, for the server-wide cap. No foreign key, so a demo reset or cleanup never lowers the count; rows older than a day are pruned |
| `SandboxPayment` | id, change order id, project id, at | One row per simulated sandbox payment the server let through, for its caps per copy and per server. No foreign key, like `PayPalSend`; rows older than a day are pruned |

The database repeats the core rules as CHECK constraints (known status, known client locale, no negative amounts, `sent` needs an invoice id, billed orders need an amount above zero, `paid` needs its dates in order), so a write that skips the domain code still can't store a broken order.

### Change order status

```
            send (creates + sends PayPal invoice)        payment confirmed: PAID or MARKED_AS_PAID
  draft ───────────────────────────────────────▶ sent ──────────────────────────────────▶ paid
    │                                              │
    │ include at no charge                         │ cancel (cancels the PayPal invoice)
    ▼                                              ▼
  waived                                       cancelled
                                                   ▲
  draft ───────────────────────────────────────────┘
        the invoice under this number was already cancelled in PayPal
```

A draft that already holds an invoice id goes straight to `paid` (recorded as sent, then paid) when PayPal shows that invoice paid: the app stopped between sending and saving `sent`. `draft → cancelled` happens only when PayPal reports that the invoice for this order's number is already cancelled (or can never be paid), so the finding can be quoted again instead of getting stuck.

Allowed transitions are defined once in `src/domain/change-order.ts`; everything else is rejected.

## 6. Key flows

**Review a message.** The user pastes a client message (at most 4,000 characters). A server action receives only the text and takes the project from the cookie. It takes a place under the Claude call caps, then sends the agreed scope, the change orders already quoted, and the message to Claude (`claude-opus-5-5`, with Anthropic's server-side fallback if the model declines) and asks for findings in a fixed JSON schema (quote, title, estimated hours, reason). The system prompt says the message is someone else's text, not instructions, and tags that would open or close the prompt's sections are neutralized in the message and in earlier titles, in any spelling. The response is validated with zod; findings whose quote is not found in the message are dropped, along with any under a quarter hour or over 200 hours or without a reason. Titles and reasons are made one line (80 and 300 characters at most) and hours are kept to two decimals. There are no retries: a retry would be billed again but counted once. Curly and straight quote marks match each other, a repeated phrase maps to its next free occurrence, and when two quotes overlap the longer one wins. Each finding becomes a `draft` change order priced at `hours × rate`, rounded up to the next $10. Claude is called before anything is stored, and the message, findings, orders and activity steps then land in one `db.batch()`, so a failed review leaves no half-reviewed message and the same text can be sent again; only a `review_failed` step is recorded. `pnpm eval:review` runs the real model on six fixed messages and reports passes and cost (about half a cent a review on Nov 2, 2026).

**Send a change order.** The server action receives only the change order id and loads the amount, status, and client from the database. It checks that `draft → sent` is allowed and the amount is above zero, then marks the order as being sent with a single conditional update, so a second request for the same order stops there. If the order has no invoice id yet, it creates a draft PayPal invoice whose invoice number is derived from the change order id (`TG-` plus 22 base-36 characters). PayPal's Invoicing API ignores `PayPal-Request-Id` (checked in the sandbox on Oct 31, 2026: the same id created a new invoice each time), but it refuses a second invoice with the same number, even when both requests arrive at once. When it answers `DUPLICATE_INVOICE_NUMBER`, the app looks the invoice up by number, checks its reference and amount, and reuses it. The invoice id is saved before sending, so a retry reuses it. Sending again answers `INVOICE_ALREADY_SENT`, which counts as sent. After sending, it reads the invoice back and stores `detail.metadata.recipient_view_url` as the payer view URL, only if it is a `https://www.sandbox.paypal.com/invoice/p/` link, so the demo can open the client's view. PayPal's error names come from sandbox responses, not from the published schema, so any 422 the app doesn't recognize is treated as a rejection that changes nothing. If PayPal may already have sent the invoice but the app couldn't confirm it (the read-back failed, PayPal still showed a draft, or saving `sent` failed), the order stays a draft that holds the invoice id, the screen offers "Send again" instead of "Include at no charge", and sending again settles it. A draft that holds an invoice id, or is being sent, can't be waived. If PayPal refuses to send because the invoice is already paid, the app reads it and settles the order as paid. The whole server sends at most 10 invoices a minute and 200 a day (counted in a send log that resets and cleanups don't touch; taking a place is one conditional insert, so two requests can't both take the last one; a place is taken before PayPal is called and isn't given back if the call fails), so a public demo can't exhaust the shared sandbox account. Each copy also sends at most 20 invoices in 24 hours, counted in the same send log by project id, so one visitor can't use up the server's day for everyone else and a reset gives no new allowance; both caps are checked in the same insert. Past the copy's cap the action answers `copy_rate_limited` and the screen says it is this copy's limit; past the server's it answers `rate_limited` and says the demo server is busy for all visitors.

**Cancel a change order.** Only a `sent` order can be cancelled, after a confirmation step. The app asks PayPal to cancel the invoice; `INVOICE_CANCELED_ALREADY` counts as cancelled, and `CANNOT_CANCEL_PAID_INVOICE` leaves the order `sent` for the payment webhook or "Check payment" to settle. A cancelled order's finding can be quoted again: a new draft with a new id (so a new invoice number), priced again from the rate.

**Get paid.** PayPal posts `INVOICING.INVOICE.PAID` to `/api/webhooks/paypal`. The handler reads at most 64 KB of the raw body (larger bodies get 413; a body that doesn't arrive within 10 seconds gets 408), takes the five `paypal-*` signature headers, and verifies the event with `POST /v1/notifications/verify-webhook-signature`, putting the event back exactly as received, because re-serializing it can fail verification. PayPal sends this event for partial and pending payments too, so the handler takes only the invoice id from the event, reads the invoice back, and moves the order to `paid` only when the invoice is paid in full (`PAID`, or `MARKED_AS_PAID` when the freelancer recorded the whole payment in PayPal) and its reference, amount, and currency (USD) match the order. Recording the event id and changing the order happen in one `db.batch()`; a conflict on the event id means a duplicate. PayPal retries any non-2xx answer for three days, so the status code says whether a retry could help:

- No `PAYPAL_WEBHOOK_ID` (or no PayPal keys): 503, nothing is called.
- Missing signature headers, a bad body, or a signature PayPal doesn't confirm: 400.
- PayPal's verification call or the invoice read fails: 503, nothing is recorded, so the retry is handled.
- The order is still `draft` but holds that invoice id: recorded as sent, then paid.
- The invoice isn't paid yet (sent, unpaid, or payment pending; PayPal's event can arrive before the invoice shows it): 503 with `Retry-After`, nothing recorded, so PayPal's retry settles it. A payment pending longer than PayPal's three days of retries needs "Check payment".
- Unknown invoices, repeated events, partly paid, cancelled or refunded invoices, and other event types: 200, recorded, nothing else changes. If the order couldn't be changed (for example it was cancelled at the same moment), the event is recorded as `paid_not_applied` and logged.
- Requests are capped per sender (20 a minute, keyed by `CF-Connecting-IP`, which Render's Cloudflare layer sets) before the signature headers are checked or the body is read, and PayPal verification calls are capped for the whole server (60 a minute), so one flooding sender can't use up the app's PayPal rate limit or block PayPal's own notifications. IPv6 senders are keyed by their /64, so one host can't rotate addresses to get more. Requests with and without PayPal's signature headers are counted in separate buckets, so unsigned junk can't use up or crowd out the signed side (carrying the headers proves nothing; PayPal still verifies the signature). Each bucket remembers at most 10,000 senders, least recently seen first; when full it forgets the oldest, so a new sender (PayPal included) is never turned away for lack of room.

**Unlocking work.** Settling an order (the webhook, "Check payment", or a send PayPal refused because the invoice is already paid, all through `settleStatements` in `src/server/payments.ts`) adds a `work_unlocked` step to the same `db.batch()`, right after `payment_confirmed` and written only if that step was: "Payment unlocked “Loyalty page with customer login”; launch moves to Nov 19." The launch is the agreed launch (`projects.due_on`) plus the extra days of every paid or waived order, computed in `src/domain/delivery.ts`, with the project's orders read just before the batch; if two orders of one copy settle at the same instant, one line may leave out the other's days, while the panel always reads the orders afresh. Verification and settlement rules are unchanged.

**Check payment.** If the webhook is late, the freelancer can press "Check payment". It reads the invoice back and applies the same rule (only `PAID` marks the order paid), so a webhook and a click arriving together still change the order once. The button sits under a sent order, below the client's PayPal page link and a line saying to pay as the sandbox buyer. If PayPal doesn't show the invoice as paid in full yet, it says so calmly (a status line, not an alert) and changes nothing. While the copy has a sent order, coming back to the tab (`visibilitychange` to visible, at most once every five seconds) re-reads the page from the server, so a payment the webhook already recorded shows without a manual reload.

**Simulate the client's payment (sandbox shortcut).** A judge without a sandbox buyer login could not see the climax (Paid, the gate lifting, the Delivery panel unlocking), so a sent order also offers a secondary "Simulate the client's payment" button with a "Sandbox" tag and a one-line explanation; "Open the client's PayPal page" stays the primary way. The action (`simulateClientPayment` → `simulateOwnedPayment` in `src/server/sandbox-payment.ts`) takes only the order id, checks it belongs to the visitor's copy like Check payment and cancel, and refuses (`sandbox_only`) unless the PayPal client is the sandbox's; `recordPayment` in `src/server/paypal/invoices.ts` refuses a non-sandbox client again before any request. It reads the invoice first: if PayPal already shows it `PAID` or `MARKED_AS_PAID`, nothing is recorded and the answer is "already paid, press Check payment"; a part-paid, pending or cancelled invoice answers `not_payable`; a reference or amount that doesn't match the order answers `invoice_changed`. Otherwise it takes a place under its caps, 5 per copy and 100 across the server in any 24 hours, counted in the `sandbox_payments` table (migration 0008, a new table only), which resets and cleanups never touch, so resetting a copy gives no new allowance. Then it calls `POST /v2/invoicing/invoices/{id}/payments` with the order's whole amount in USD, method `PAYPAL`, today's UTC date and the note "Sandbox demo: recorded by Tollgate as the client's payment", and writes a `payment_recorded` activity step. A second press on the now-paid invoice gets PayPal's 422 `CANNOT_PROCESS_PAYMENTS`; the invoice is read again and the answer is "already paid", so one invoice never gets two payments. PayPal failures map and are recorded like the other PayPal steps (`paypal_failed`, step `record`).

It does **not** mark the order paid. PayPal shows the invoice `MARKED_AS_PAID` and sends its signed `INVOICING.INVOICE.PAID` webhook, which settles the order through the same verification and `settleStatements` rule as a real payment (or "Check payment" does, when the webhook is late or can't reach the server, as on localhost). So the shortcut exercises the real webhook path instead of bypassing it, and a bug in it can't mark anything paid that PayPal doesn't show as paid. After a success the ticket shows "Payment recorded in the PayPal sandbox. Waiting for PayPal's signed webhook…" and the page re-reads itself every five seconds for up to 90 seconds (stopping when the page is hidden or the ticket is paid), so the gate lifts without a reload. Sending shows a spinner with "Creating and sending the PayPal invoice…", announced politely, and the button stays `aria-disabled` until the answer comes back.

**Waive.** `draft → waived` keeps the finding visible with no charge, so the record shows what was given for free. Waiving can't be undone, so the button asks for a second confirmation first.

**Reading the workspace.** `getWorkspace(db, projectId)` in `src/server/db/queries.ts` returns the project, its scope items, its messages with their findings (each with the stored quote offsets and the live change order), every change order (by message, then quote position, then creation order: SQLite's `rowid`, so a finding quoted again lists its cancelled orders oldest first and never by their random UUIDs), the totals: agreed, with changes (agreed plus draft, sent and paid orders), paid, and not paid yet (draft and sent orders), and the delivery plan (below). Waived and cancelled orders are listed but never counted in money. The header shows "Total with changes" with a chip such as "$650 not paid yet", or "All paid" once nothing is owed; that total and the Scope panel's Total are STOP (orange-red) while anything is unpaid and GO (green) once everything is settled. One wording per status everywhere (`src/components/order-text.ts`): a draft is "Not sent yet" on its ticket and in the Scope list, a waived order is "Included at no charge" on its ticket, the Scope list and the Delivery panel. Each marked phrase becomes a toll ticket in the Tickets column, newest message first; the phrase links to its ticket and the ticket's quote links back to the phrase (see `docs/DESIGN.md`). The page goes through `openVisitorWorkspace`, which ensures the copy and reads it, trying once more if a cleanup removed the copy in between. When a new copy is refused (see Public demo), it returns `previewWorkspace` instead: the seed built in memory, with no row written, and the page renders it read-only. The screen marks quotes only at the stored offsets and never searches the text again.

**Delivery panel.** The product's promise on one card, under the tickets on a wide screen and after the conversation on a phone: the agreed launch (`projects.due_on`, Nov 15 in the demo), a road strip with one stretch per change order (work in the launch first, then a gate at the launch date, then the locked work behind it), and each change order's work as a row. Draft and sent orders read "Locked — starts when paid" with a closed lock in STOP, their stretch carries barrier stripes, and their days aren't counted; paid ones read "Unlocked" and the paid date ("Unlocked Oct 26") with an open lock in green; waived ones read "Included at no charge" with an open lock in grey (green only ever means money received) and count too (the work is done, just not billed); cancelled ones have no row. The launch is the agreed date plus the whole extra days (fractions round up) of every paid or waived order, shown as "Nov 15 → Nov 16" (the agreed date struck through) once it moved, with a line saying where paying the locked work would put it. `deliveryPlan` in `src/domain/delivery.ts` computes all of it, and the same module writes the payment's `work_unlocked` line, so the panel and the activity log can't disagree. Calendar days, not working days, to match the "+N days" on each ticket. Colour is never the only signal: each row states its state in words and the lock is decorative.

**Demo guide.** A sticky app bar (the wordmark, the project, the language switcher in `#locale-slot`, and Reset demo) tops the page, with a folding "How this demo works" guide under it: three steps and a link to the first draft or sent change order's ticket. It opens on a fresh copy and starts folded once the copy has activity; the first value is kept, so a refresh after an action never folds it under the visitor. When the server has no Claude key, step 1 says live checks are off and points to the request already marked in the seed, and pressing the disabled Check scope puts the reason in the review result line instead of doing nothing; no Claude result is ever faked.

**Activity panel.** Reviewing and sending write short steps to a log shown beside the workspace: message read, findings proposed with their quotes, price computed from the rate, invoice created and sent, payment confirmed, work unlocked. It explains what the agent did; it never triggers a PayPal call by itself. Steps are stored in `activity_events`, written in the same batch as the state change, ordered by insertion. Failed PayPal calls are recorded with their step, HTTP status, issue, and debug id, never with credentials.

**Public demo.** `src/proxy.ts` gives a visitor without a valid `tg_visitor` cookie a random 256-bit id (HttpOnly, SameSite=Lax, Secure in production, seven days, renewed on each visit) and forwards it to the same request, so the first page render already sees it. The visitor's project id is a hash of that id (`v_` + 22 characters of SHA-256), so the cookie can't be recovered from the database and the same visitor always maps to the same copy. The page creates the copy the first time it renders for that id; two requests racing to create it end with one copy, because the project id is the primary key. Creating the copy and refreshing its `last_seen_at` (at most once an hour) are the only writes allowed during rendering. New copies are limited (`src/server/demo-limit.ts`), because a bot repeating `GET /` without a cookie would otherwise add a copy (about 13 rows) per request: at most 10 per client address an hour (kept in the process's memory; the address is read like the webhook's senders in `src/server/client-address.ts`, `CF-Connecting-IP` first, then the first `X-Forwarded-For` entry, one IPv6 /64 as one address; loopback and unknown addresses only meet the daily cap) and 500 across the server in any 24 hours (counted from `projects.created_at`, so a restart doesn't reset it). Past either limit the visitor sees the seed read-only: a localized notice under the app bar, and sending, checking a message, including for free, quoting again, reset and the client language are off. Nothing is written for them and no activity is read; the reset action also answers `not_found` when the visitor's copy doesn't exist, so it can't create one past the limits. A visitor who already has a copy always opens it. Every copy and every reset gets fresh random ids for its child rows, so a change order id (later the PayPal request id) is never reused. Reset asks for a confirmation, then replaces all rows of the copy in one batch. It is refused (`invoice_open`) while the copy has a change order whose PayPal invoice the client may still pay: a sent order, a draft that holds an invoice id, or a draft being sent. Deleting that order would leave a payment the webhook can't match to anything, so the visitor cancels the invoice first. The open invoice is looked up before the batch, so the refusal never depends on how the database reports an error (Turso's remote errors can lack libSQL's extended code); the same check also sits inside the batch, so a send that starts at the same moment still wins, and a failed batch is looked up once more before it counts as a server error. Copies not opened for seven days (`last_seen_at`) are deleted whenever a new copy is created, so a judge who returns days later still finds their copy; a copy with such an invoice is kept until it is paid or cancelled. Server actions receive only ids, derive the project from the cookie, and answer `not_found` for anything outside the visitor's copy. Claude reviews are capped at 10 a day per copy and at 10 a minute and 100 a day across the server, counted in `claude_calls`, which resets and cleanups never touch, so resetting a copy gives no new allowance and the server-wide cap bounds the bill however many cookies are used. A visitor who burns the server-wide cap can stop new reviews for the rest of the day; the screen then says so.

## 7. Directory layout

```
src/
  proxy.ts                  visitor cookie
  instrumentation.ts        startup checks and migrations, before the server takes requests
  app/                      routes, layouts, server actions
    api/webhooks/paypal/    PayPal webhook route handler
    api/health/             health check (DB + PayPal token); live/ is the DB-only check Render polls
  components/               UI (client components only where state is needed)
  i18n/                     languages: locales, catalogs (messages/), t(), formatting, getLocale, setLocale, LocaleSwitcher
  domain/                   types, status rules, money math (no I/O)
  server/
    env.ts                  zod-validated environment
    visitor.ts, session.ts  visitor cookie helpers, current visitor and project
    db/                     Drizzle schema, client, demo copies, queries, change order commands
    billing.ts              sends, cancels and re-quotes change orders (database + PayPal)
    webhook.ts              webhook handling: body limit, verification, event record, settling
    client-address.ts       the client address behind Render's proxy, shared by the per-address limits
    demo-limit.ts           limits on new demo copies (per address, per day)
    payments.ts             settling a paid invoice (webhook, Check payment, send retry)
    sandbox-payment.ts      "Simulate the client's payment": records it in the sandbox, never marks paid
    health.ts               health checks
    startup.ts              startup environment checks and migrations
    paypal/                 REST client: token, invoices, webhook verification
    review.ts               reviews a message: caps, Claude, validation, pricing, storing
    ai/                     scope review prompt + Claude client
drizzle/                    SQL migrations generated by drizzle-kit
render.yaml                 Render free web service and environment (secrets entered in the dashboard)
scripts/                    db.mts: migrate and seed from the command line; eval-review.mts: real-model evaluation
test/                       test-only helpers (fake PayPal); app code may not import them
docs/                       this file
```

## 8. Configuration

| Variable | Used by | Notes |
|:--|:--|:--|
| `PAYPAL_ENV` | paypal | `sandbox` for the hackathon. On Render (`RENDER=true`) the app refuses to start unless it is exactly `sandbox`; `live` also needs both keys and the webhook id |
| `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` | paypal | REST app credentials |
| `PAYPAL_WEBHOOK_ID` | webhook route | From the app's webhook settings; letters and digits only. Without it every webhook gets 503 |
| `ANTHROPIC_API_KEY` | ai | Without it, message review is disabled and the UI says so |
| `DATABASE_URL` | db | Defaults to `file:data/tollgate.db`. On Render it must be a remote libSQL database (`libsql://…turso.io`) or a file under a disk (`file:/var/data/…`), or the app refuses to start |
| `DATABASE_AUTH_TOKEN` | db | Token for a remote libSQL database (Turso). Required on Render when `DATABASE_URL` is remote |
| `RENDER`, `RENDER_GIT_COMMIT` | startup, health | Set by Render; the health check shows the first seven characters of the commit |

## 9. Testing

- **Database writes:** statements that must land together use `db.batch()`. Interactive `db.transaction()` callbacks that await between statements are not used in request handling: libSQL's local client runs on the Node thread, so any other write during an open write transaction fails at once with `SQLITE_BUSY`, and a busy timeout only blocks the thread.
- **Unit (Vitest):** status transitions, limits on new demo copies (per address, per day, the read-only preview matching a real copy's first screen, reset refusing to create a missing copy), pricing and rounding, finding validation, database constraints, demo copies (independence, concurrent creation, reset, seven-day cleanup by last use, both leaving a copy with a payable invoice alone), the visitor cookie in `proxy.ts`, workspace queries and totals, the waive and reset actions refusing another copy's ids, PayPal token caching and the one 401 retry, invoice request bodies and error handling against recorded sandbox responses, the send and cancel commands with a fake PayPal (two sends at once create one invoice, a send interrupted after creating the invoice reuses it), activity order, PayPal client request shapes with `fetch` mocked, the webhook handler (verified, unverified, no webhook id configured, verification call failing, duplicate, unknown invoice, partial payment, draft recovery, body limit, the event passed back byte for byte), check payment racing the webhook, the simulated sandbox payment (owner check, sandbox only, caps per copy and per server, already paid or a second press recording nothing, error mapping, never marking paid, the request body with `fetch` mocked, the 90-second refresh), startup checks, health checks, and the send log surviving resets and restarts.
- **Sandbox, by hand:** send a change order, pay it as the sandbox buyer, watch the webhook arrive. Locally the webhook needs a tunnel; the deployed app receives it directly. PayPal can resend a delivered event by id, which checks duplicates on the live app. Events from PayPal's webhook simulator can't pass signature verification, so the simulator only shows the route is reachable.
- **Sandbox (`pnpm accept:sandbox`):** runs against the real PayPal sandbox with the keys in `.env.local`, outside `pnpm check`; it sends twice at once and counts the invoices for that change order with the search API, then cancels what it sent.
- **Browser (Playwright, `pnpm e2e`):** one production build, the installed Chrome, and fresh throwaway databases; most tests run on a server without PayPal or Claude keys, the PayPal tests on one with the sandbox keys from `.env.local`; each server starts on an empty database path and migrates before its first request; two browser contexts get separate copies, state survives reload, reset asks for a confirmation and restores the seed, a forged id from another copy is refused, and the Delivery panel shows the seed (gift card unlocked and counted, loyalty page locked) and moves the launch when the loyalty page is included at no charge; the demo guide points to the marked request when Claude is off and starts folded once the copy has activity, a press on the disabled Check scope states the reason, and the totals read "Total with changes" and the unpaid amount, STOP until everything is settled; each ticket shows its number and status in words, and a payment that arrives while the tab is open lifts the ticket's barrier once (never under reduced motion, where the paid state simply shows); picking 한국어 in the switcher turns the screen Korean and stays after a reload, and the client language select saves, survives a reload, leaves the screen language alone and goes back to English on reset; on the keyed server, sending shows its busy label, "Simulate the client's payment" leaves the ticket sent while PayPal shows `MARKED_AS_PAID`, a second press records nothing, and Check payment then turns the ticket Paid with its gate up.
- **Languages (unit):** every catalog has every English key with the same `{params}` and `<tags>`, nothing empty or copied from English, product names kept; `t()` filling and English fallback; plural forms per locale; the order cookie > English with an invalid cookie ignored and `Accept-Language` not consulted; `setLocale` and `setClientLocale` refusing unknown values and other copies; invoice texts per locale, with the English lines byte for byte as before; migration 0007 keeping every row with foreign keys on; the ticket's status and effort lines per locale (English as before) and the `Rich` marks.
- Every commit passes `pnpm check` (lint, typecheck, test) and `pnpm build`.

## 10. Deployment

Render web service on the free plan, with the database on Turso's free plan (remote libSQL, same client library as the local SQLite file). Neither needs a card on file. Free web services can't attach a disk and sleep after 15 idle minutes, so the next visit waits about a minute while the service starts; a GitHub Actions job (`.github/workflows/keep-awake.yml`) requests `/api/health/live` every 10 minutes to keep it awake. `src/instrumentation.ts` checks the environment and applies migrations when the server starts, before it takes requests; a failed check exits the process, so the deploy fails instead of serving errors. The paid plan with a 1 GB disk (`file:/var/data/…`) still passes the startup checks and is the fallback if the free plan proves too slow. Render polls `/api/health/live` (database only), so a slow PayPal sandbox never makes Render restart the app; `/api/health` also checks a PayPal token and is what the daily check calls. The service is defined in `render.yaml` (a Blueprint with auto sync off); it deploys the `deploy` branch with auto-deploy off, and every deploy is started by hand. Each deploy of new product code is checked on the live app and either kept or rolled back to the last passing commit; during judging (Dec 1–15, 2026) only outage fixes are deployed. A daily check (planned) calls `/api/health` and the demo page and alerts the maintainer when either fails. The demo, sandbox credentials, and Anthropic balance must all last through judging. Fallback: Vercel with a hosted libSQL database.

## 11. Decisions

| Decision | Why | Revisit if |
|:--|:--|:--|
| Webhooks are verified by posting them back to PayPal, with the raw body | Matches PayPal's docs with no certificate handling of our own; the raw body avoids re-serialization failures | Postback verification becomes slow or unreliable |
| Startup checks and migrations in `instrumentation.ts` | The server itself refuses to start misconfigured, whatever the start command | Render runs migrations before start |
| Render polls a database-only health check | A PayPal outage shouldn't make Render restart the demo | — |
| A sandbox-only "simulate the client's payment" that records the payment in PayPal but leaves settling to the webhook | Judges without a buyer login see the real end of the flow, and the payment still arrives through the signed webhook and the one settling rule | Live mode: the button and the call refuse anything but the sandbox |
| Send cap counted in its own table | Resets and cleanups delete activity rows; one conditional insert keeps the cap exact across requests and restarts | Limits need more than a count |
| Invoice number derived from the change order id is the idempotency key for PayPal, plus a send claim in the database | Invoicing ignores `PayPal-Request-Id` in the sandbox; PayPal enforces unique invoice numbers atomically | PayPal starts honoring the request id for invoices |
| Direct REST client for invoices, not the Agent Toolkit | Sending money-related documents must be deterministic and testable; the toolkit fits an assistant better than a button | We add a chat assistant (not planned for the hackathon) |
| Per-visitor demo copies instead of accounts | Judges can send and pay a real sandbox invoice without signing up, and can't touch each other's data | Abuse or Claude cost gets out of hand |
| Own small typed catalogs instead of an i18n library | Five locales and about 130 strings; `as const` English plus `satisfies` catches a missing key at compile time with no new dependency | Plural or gender rules outgrow `_one`/`_other`, or translators need a TMS format |
| Client language stored per project, screen language per visitor | The client reads the invoice; the freelancer reads the screen. They are often different people in different countries | Accounts arrive and a freelancer has several clients |
| Render free plan + Turso, not a paid plan with a disk | No card on file (decided Nov 4); the database outlives restarts on Turso | Cold starts hurt the demo: move to the paid plan with a disk |
| Claude for review, JSON schema output | Needs reasoning over two texts and an exact quote back | Cost or latency is a problem |
| SQLite through libSQL + Drizzle | Zero setup for judges running locally, one file to back up | We need concurrent writers |
| Hours from the model, price from the rate | Keeps prices explainable and stops the model inventing numbers | — |
| English by default, other screen languages one click away | Judges and the target clients are international, and the demo data is English; a browser-language guess would mix two languages on one screen | — |

## 12. Languages

Two languages are kept apart. The **screen language** is the visitor's: what the interface is written in. The **client language** belongs to the project: what the PayPal invoice the client receives is written in. Neither calls a model or costs anything; every text is written in advance.

**Locales.** `en` (default), `ko`, `ja`, `es`, `pt` (Brazilian Portuguese), in `src/i18n/locales.ts`. Numbers and dates use `en-US`, `ko-KR`, `ja-JP`, `es-ES` and `pt-BR`. Money is always USD; only how it is written changes (`$650`, `US$650`, `650 US$`). Dates stay in UTC so the server and the browser print the same day.

**Choosing the screen language.** Each request takes the `tg_locale` cookie if it names one of the five, otherwise English (`getLocale()` in `src/i18n/server.ts`). `Accept-Language` is not consulted: the demo conversation and scope are English, so a first visit in another browser language would mix the two; the picker is one click away. The `setLocale(locale)` server action checks the value and sets the cookie for a year, `SameSite=Lax`, path `/`, `Secure` in production; it isn't HttpOnly because it says nothing secret. `LocaleSwitcher` (a native `<select>`, each language written in itself) calls it and then `router.refresh()`. The root layout stays a static shell under Cache Components, so `<html lang>` ships as `en` and a small component rendered in a `<Suspense>` in the layout sets it to the request's language as soon as it streams in.

**Catalogs.** `src/i18n/messages/en.ts` is the source of keys (`group.key`, grouped by component); `ko`, `ja`, `es` and `pt` must have the same keys (`satisfies Catalog`) and the same `{params}` and `<b>`/`<link>`/`<nowrap>`/`<sr>` marks (unit test). `t(locale, key, params)` fills `{name}` and falls back to English; its params are typed from the English text. `tCount` picks `_one`/`_other` with `Intl.PluralRules`; `tRich` splits the marks into parts for the component to style. Product names are never translated. Data is never translated: the seeded conversation, client and project names, scope and change order titles, Claude's reasons, the sample client message, and activity summaries stay as written. `page.tsx` reads the locale once and passes it to every component; `Rich` draws `tRich` parts (bold, the guide's link, a no-wrap span, screen-reader-only text). Korean text breaks between words (`word-break: keep-all`) and Japanese between phrases (`auto-phrase`, Chrome).

**On the screen.** The language switcher is a native `<select>` in the app bar's `#locale-slot`, each language written in itself, with a globe glyph from 640 px up. The client language is a second native `<select>` under the project title ("Client's language"), with the line "New PayPal invoices are written in this language."; it calls `setClientLocale` and says so when saving fails. Ticket stamps and gate captions are translated (they are drawn in the stub and hidden from screen readers; the status line says the same).

**The invoice.** `projects.client_locale` (migration 0007, a hand-written `ALTER TABLE … ADD` with a column CHECK, because drizzle-kit's table rebuild would have dropped `projects` and cascaded to every copy's rows) is read with the order when the invoice is created. `server/billing.ts` writes the item description and the note from the catalog's `invoice` group in that language (`src/i18n/invoice.ts`); the item name (the change order's title), the amount, the currency, the invoice number and the reference are the same in every language. In English the lines are byte for byte what was sent before, so the recorded sandbox responses still match. `setClientLocale(projectId, locale)` changes it, with the same checks as reset: a demo copy id, a known locale, and the visitor's own copy (another copy answers `not_found`). An invoice PayPal already has keeps its words; a reset puts the copy back on English.

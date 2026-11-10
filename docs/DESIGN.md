# Tollgate design: "Toll ticket"

Each extra-work change order is a toll ticket, and the client's payment lifts a toll-gate barrier. The shell is a bright, plain SaaS workspace so the product still reads as a professional freelancer tool; the ticket and its barrier are the one place it gets expressive. This file is the visual contract the components follow. When the code and this file disagree, fix one of them in the same commit.

## Type

| Role | Family | Where | Why |
|:--|:--|:--|:--|
| Display | Overpass (700–800) | Wordmark, headings, labels, buttons, status lines, big money figures | Overpass is derived from Highway Gothic, the lettering on US road signs, so the toll-road idea is carried by the type itself. |
| Data | Overpass Mono | Ticket numbers, dates, hours and days, the Scope ledger, the delivery road labels | Same skeleton as Overpass, so numbers sit in the same voice; fixed width keeps columns and ticket numbers steady. |
| Reading | Public Sans | Message bodies, help text, reasons, the demo guide | Messages are paragraphs. Public Sans (from the US Web Design System) reads better than Overpass at 15–16 px for long lines and keeps the civic, signage tone. |

Big money figures (the header total, ticket amounts, the agreed amount) use Overpass with tabular figures, not Overpass Mono: at 30–44 px the mono comma takes a full cell and "$3,300" reads as "$3 , 300". Smaller amounts in the Scope ledger stay mono.

All sizes are 13 px or more; body text is 15–16 px and the composer textarea 16 px (no zoom on iOS).

## Colour

| Token | Value | Use |
|:--|:--|:--|
| `canvas` | `#F5F6F8` | Page background, client bubbles, the demo guide band |
| `surface` | `#FFFFFF` | App bar, header, cards, tickets |
| `line` | `#E3E6EB` | Borders, dividers, the perforation |
| `field` | `#7B8494` | Input borders (3.8:1 on white) |
| `ink` | `#12161F` | Text, primary buttons, your own bubbles, barrier stripes |
| `ink-2` | `#4A5262` | Secondary text: 7.3:1 on canvas, 7.9:1 on surface |
| `stop` | `#D9480F` | Unpaid or locked: lamps, mark underlines, the header total (large text, 4.3:1) |
| `stop-ink` | `#B23C0A` | Small STOP text: 5.9:1 on white, 5.1:1 on `stop-wash` |
| `stop-wash` | `#FDEBE3` | Unpaid chip and mark background |
| `go` | `#12805C` | Paid or unlocked: lamps, segments, text (4.9:1 on white) |
| `go-ink` | `#0E6A4C` | Small GO text on `go-wash` (5.8:1) |
| `go-wash` | `#E3F3EC` | Paid chip and mark background |
| `idle` | `#8A93A3` | Included at no charge or cancelled: lamps, segments (non-text, 3.1:1) |

Only STOP and GO carry meaning, and green only ever means money received; work included at no charge is grey. No PayPal blue, and no gradients except the barrier stripes (ink and white at −45°). The only shadow is on tickets: `0 1px 2px rgba(18,22,31,.06), 0 4px 12px rgba(18,22,31,.06)`. Radii: 8 px for buttons and inputs, 10 px for cards and tickets, full for chips and lamps. Light mode only for the hackathon build.

Every state is written out: a lamp, a stripe or a colour is always next to words that say the same ("Not sent yet", "Locked — starts when paid", "All paid").

## Layout

**Wide screens (≥1024 px).** A sticky app bar: the barrier glyph and "Tollgate", the client and project, the language switcher in `<div id="locale-slot">`, and Reset demo. Under it the folding demo guide, then the project header with the client, the project, the "Client's language" select with its one-line hint ("New PayPal invoices are written in this language."), and the big "Total with changes" figure with its chip ("$650 not paid yet" in STOP, or "All paid" in GO). The main grid has the conversation on the left (it sticks under the app bar and scrolls on its own, opening at the latest message, with the composer at its foot) and a 420 px right column: Tickets, then Delivery, Scope and Activity.

**Phones (390 px).** App bar (the switcher drops its globe and Reset demo its padding so the bar stays one line in every language), guide, header and total, then the tickets as a horizontal scroll-snap row (the next ticket peeks in), the conversation and composer, then Delivery, Scope and Activity. Every control is at least 44 px tall and there is no horizontal page scroll.

**Languages.** Both language controls are native `<select>`s styled as `.select`: Overpass 700 at 16 px (no iOS zoom), 44 px tall, an 8 px radius, a `field` border (`line` for the quieter app-bar one) that turns `ink` on hover, an ink chevron and the usual 2 px focus ring. Each language is written in itself. Every text on the screen follows the visitor's language; money stays USD in the locale's way of writing it ("US$650", "650 US$"), and the client's messages, titles and Claude's reasons stay as written.

## The ticket

Top to bottom:

1. `TICKET` (チケット, 티켓 in Japanese and Korean) and the PayPal invoice number the order will carry (`TG-` + 22 characters, the same number the client sees on the PayPal page), in mono.
2. The status line: a round lamp (STOP for draft and sent, GO for paid, grey for included or cancelled) and the status in words. It is the `role="status"` element that takes focus after an action.
3. The title, the amount (struck through when included or cancelled), and "≈ 13 h · +3 days".
4. Who asked and when, with the quoted phrase as a link back to the message. Drafts add "Not in the agreed scope." and Claude's reason.
5. A perforation: a dashed tear line with a half-circle notch cut into each side.
6. The stub's lane: a post with its lamp, the striped arm resting on a fork, a caption ("Work locked until paid", "Work unlocked"), and a stamp ("Sent · PayPal", "Paid · Nov 5", "No charge", "Void"), both in the screen language. The arm is down while the work is locked and up (−80°) once it is paid or included. The lane is 96 px tall with the gate down and 168 px with it up, so about 140 px of the raised arm shows above the post (it runs on past the tear line, where the lane clips it) and the stamp moves to mid-lane, clear of the arm.
7. The actions for that status: Send change order / Include at no charge, the client's PayPal page / Check payment / Cancel invoice, or Quote again.

Pointing at or focusing a ticket outlines its phrase in the message, and the other way round; the phrase is a link to its ticket, and the ticket's quote is a link to the phrase. Both outline when they are the URL's target.

Tickets are listed newest message first, under a dark "slot" bar they print out of.

## Delivery road

A strip from the agreed launch: one stretch per change order, as wide as its days. Work already in the launch comes first (paid in GO, included in grey), then a gate post at the launch date (its lamp STOP while anything is locked, GO otherwise), then the locked stretches with barrier stripes. Labels: the launch date over the gate, the agreed date at the start and the date if everything is paid at the end. The panel header shows the launch, with the agreed date struck through once it moved. The rows below repeat everything in words.

## Motion

Functional feedback everywhere, one expressive moment (the gate lift). Only `transform`, `opacity`, colour and `clip-path` are animated; there are no animation libraries. Under `prefers-reduced-motion: reduce` nothing moves: `MotionDirector` marks nothing and the CSS turns the remaining animations off (pseudo-elements included), so the new state simply shows, the lamps already in the status colour.

| # | What | How |
|:--|:--|:--|
| 1 | **Gate lift** when a ticket turns paid | The arm rotates up around its post in 700 ms with a slight overshoot (to −87°, settling at −80°) inside the taller raised-gate lane; the lamps switch STOP → GO in one step at about 300 ms; the "Paid" stamp lands at about 500–700 ms; the header total settles from STOP to GO and its chip pops in; the delivery stretch loses its stripes; the launch date flips. Including an order at no charge opens the gate the same way, in grey. |
| 2 | Ticket printing | A new draft slides 48 px down out of the slot in 420 ms (`clip-path` keeps it hidden above the slot). |
| 3 | Mark draw-in | A draft's phrase underlines left to right in 500 ms when it appears. |
| 4 | Checking scope | While Claude reads, a 2 px STOP line sweeps the textarea and the button shows "Checking…" with a running bar along its bottom edge. |
| 5 | Send | Buttons press down 1 px; busy buttons say what they are doing ("Sending…") with the running bar; the sent ticket gets its "Sent · PayPal" stamp and the payer link. |
| 6 | Activity | New steps fade and slide in, 60 ms apart. |
| 7 | Hover and focus | Every control has a hover shade and a 2 px ink focus ring; nothing changes size, so nothing shifts. |

**How a payment is detected.** A payment arrives through a server refresh (the webhook, then `RefreshOnReturn` or Check payment), so the browser can't be told directly. `src/components/motion-events.ts` compares what the server just rendered (order statuses, the newest activity id, the launch date) with what this tab drew last, kept in `sessionStorage` per project. A known order that went from draft or sent to paid plays the lift once; a new draft prints; nothing plays on a tab's first look. `MotionDirector` runs in a layout effect, so the first painted frame of the refreshed screen is already the start of the animation, then sets `data-fx` on the elements the CSS animates and removes it when they finish.

## Files

- `src/app/globals.css`: tokens, buttons, selects, per-language line breaking, lamp, chip, ticket, perforation, lane, stamp, road, all keyframes and the reduced-motion rules.
- `src/components/Ticket.tsx`, `Conversation.tsx`, `DeliveryPanel.tsx`, `ScopePanel.tsx`, `ActivityPanel.tsx`, `Workspace.tsx`: server components.
- `MotionDirector.tsx`, `LinkHighlighter.tsx`, `CountingAmount.tsx`, `ThreadScroll.tsx`, `ClientLocaleSelect.tsx` and `src/i18n/LocaleSwitcher.tsx`: small client components, no state shared through React.
- `Rich.tsx`: draws a translated text's marks (bold, link, no-wrap, screen-reader-only).
- `src/app/icon.svg` and `BarrierGlyph.tsx`: the barrier glyph.

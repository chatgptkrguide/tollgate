# Languages: wiring guide

The language infrastructure is in place; the components in `src/components/` still print English literals. This page
says how to switch them over. The design is in `docs/ARCHITECTURE.md` §12.

## Files

| File | What it gives you |
|:--|:--|
| `locales.ts` | `LOCALES`, `Locale`, `isLocale`, `LOCALE_NAMES`, `INTL_TAGS`, `resolveLocale` (pure; safe anywhere) |
| `messages/en.ts` | The English catalog, the source of every key. `ko.ts`, `ja.ts`, `es.ts`, `pt.ts` mirror it |
| `t.ts` | `t(locale, key, params)`, `tCount(locale, base, count, params)`, `tRich(locale, key, params)` |
| `format.ts` | `formatMoney(locale, cents)`, `formatNumber(locale, n)`, `formatDate(locale, iso)`; in `en` they print exactly what `formatUsd` and `formatShortDate` print |
| `server.ts` | `getLocale()`: cookie `tg_locale`, else `Accept-Language`, else `en` (server only; reads the request, so call it inside a `<Suspense>`) |
| `actions.ts` | `setLocale(locale)` server action: validates and sets the cookie for a year |
| `LocaleSwitcher.tsx` | `<LocaleSwitcher locale={locale} label={t(locale, "localeSwitcher.label")} />` |
| `invoice.ts` | `invoiceTexts(locale, …)`: the PayPal invoice description and note (already used by `server/billing.ts`) |

Client language actions live with the other actions: `setClientLocale(projectId, locale)` in `src/app/actions.ts`
returns `ActionResult` and refreshes the page. `data.project.clientLocale` already reaches `Workspace`.

## How a component gets the locale and calls t()

1. `page.tsx` reads it once, inside the existing `<Suspense>` (in `VisitorWorkspace`): `const locale = await getLocale();`
   and passes `locale` to `<Workspace locale={locale} …>`. Pass the blocked reasons translated:
   `t(locale, "page.sendBlocked")`, `t(locale, "page.reviewBlocked")`. `MissingVisitorNotice` and `WorkspaceSkeleton`
   can't wait for data, so give them `locale` from `getLocale()` too (the skeleton is the Suspense fallback: either read
   the locale in `Home` inside its own small Suspense, or leave the loading line English).
2. Every component takes a `locale: Locale` prop and passes it down. Server components and client components call
   `t()` the same way; a client component that imports `t.ts` carries all five catalogs (a few tens of kB). If that
   matters, a server parent can pass ready strings instead.
3. Plain text: `t(locale, "scope.title")`. With values: `t(locale, "composer.label", { client })` — the params are typed
   from the English text, so a missing or extra one is a compile error.
4. Counts: `tCount(locale, "delivery.days", row.days)` instead of `` `${days} ${days === 1 ? "day" : "days"}` ``.
   Keep a leading `+` outside the text (`` `+${tCount(…)}` ``).
5. Bold, links and no-wrap spans: `tRich(locale, "guide.step1Target", { author, sentOn })` returns
   `{ tag, text }[]`; map `tag === "b"` to `<b>`, `"link"` to the `<a>`, `"nowrap"` to
   `<span className="whitespace-nowrap">`, `null` to plain text. Key the parts by index-free values (for example
   `` `${tag}-${offset}` ``), as `MarkedBody` does.
6. Money and dates: `formatMoney(locale, cents)` for `formatUsd(cents)`, `formatDate(locale, iso)` for
   `formatShortDate(iso)`. Values that go to PayPal stay on the server's own formatting (already done).
7. `toLocaleString("en-US")` in Composer's `too_long`: use `formatNumber(locale, MAX_REVIEW_MESSAGE_CHARS)`.
8. Error maps (`Record<ActionError | …, string>`) become key lookups: the groups are keyed by the error codes, so
   `` t(locale, `changeOrderErrors.${state.error}`, { max: COPY_SEND_MAX }) `` type-checks (a union key takes the
   params any of its texts uses). For the cancel and check overrides, look in `cancelErrors` / `checkErrors` first
   when the code is one of theirs, then fall back to `changeOrderErrors`.

Do not translate data: message bodies and authors from the seed (except that a `from: "me"` author can show
`t(locale, "workspace.you")`), the client name, project title, scope item and change order titles, finding quotes and
reasons, `SAMPLE_MESSAGE` in Composer (a client's message, and Claude compares it with an English scope), and activity
summaries (stored English text written by the server). Product names (Tollgate, PayPal, Claude, Devpost) stay as they are.

## Checklist

| Where | Strings now | Keys |
|:--|:--|:--|
| `app/layout.tsx` | metadata description | `meta.description` (needs `generateMetadata` reading the locale; optional) |
| `app/page.tsx` | `SEND_BLOCKED_REASON`, `REVIEW_BLOCKED_REASON`, "Reload the page to start your demo." | `page.*` |
| `WorkspaceSkeleton` | "Loading your demo copy…" | `skeleton.loading` |
| `Workspace` | header totals, "not paid yet", sr-only conversation title, margin note status and "Not in the agreed scope", sr-only quote, "about N more days", `statusText` | `workspace.*` |
| `Workspace` › `ScopePanel` | "Scope", "Version 1, agreed …", "Change orders", totals labels | `scope.*` |
| `Workspace` › `ActivityPanel` | "Activity", lead, empty text (actor names stay) | `activity.*` |
| `ChangeOrderActions` | button labels and busy labels, confirmation and resend help, payer page link and its sr-only "(opens in a new tab)", sandbox note | `changeOrder.*` |
| `ChangeOrderActions` | `errorText`, `cancelErrorText`, `checkErrorText` | `changeOrderErrors.*`, `cancelErrors.*`, `checkErrors.*` |
| `Composer` | label, placeholder, help, buttons, reading line, result lines (plural) | `composer.*` |
| `Composer` | `errorText` | `composerErrors.*` |
| `DeliveryPanel` | title, lead, "Launch", sr-only moved text, empty text, "moves the launch to …", state texts, day counts | `delivery.*` |
| `DemoGuide` | summary, Show/Hide, the three steps (rich), "Go to the change order", footer (rich) | `guide.*` |
| `ResetDemo` | buttons, confirmation help, "Demo reset.", `errorText` | `reset.*`, `resetErrors.*` |
| new: header | `LocaleSwitcher` next to Reset demo | `localeSwitcher.label` |
| new: project header or Scope panel | a client language `<select>` calling `setClientLocale(project.id, value)`, with its label and help, and `clientLocale.saveFailed` on a failed answer | `clientLocale.*` |

When the components are switched over, the browser tests still read English (the default for a browser without a
`tg_locale` cookie whose `Accept-Language` is English), so they keep passing. Add one that picks 한국어 in the switcher
and sees `범위 확인`, and one that sets the client language and checks the invoice body in the PayPal run.

## Adding or changing a text

Add the key to `messages/en.ts` first, then to the four other catalogs; `pnpm typecheck` lists every catalog that is
missing it, and `messages.test.ts` checks the `{params}` and `<tags>` match. Keep the English invoice lines unchanged:
the recorded sandbox responses and `invoice.test.ts` compare them byte for byte.

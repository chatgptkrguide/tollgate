// The English catalog: the source of every key. Other locales must have the same keys and the same {params}
// (checked by `satisfies Catalog` at compile time and by messages.test.ts at run time).
//
// Conventions
// - {name} is filled by t(); a value that isn't given stays as written.
// - Keys ending in _one / _other are plural forms, picked by tCount() with Intl.PluralRules. Every locale has both,
//   even where the language doesn't inflect (ko, ja): there they read the same.
// - <b>…</b>, <link>…</link>, <nowrap>…</nowrap> and <sr>…</sr> mark parts the component styles (bold, an in-page link,
//   a span that mustn't wrap, text only screen readers read); tRich() splits them out. Translations move the tags
//   with the words they wrap.
// - Product names (Tollgate, PayPal, Claude) are never translated.
// - Not here on purpose, because they are data rather than interface: the seeded demo conversation (client and
//   "You" messages, the client and project names, scope item and change order titles, finding reasons), the
//   Composer's sample client message, and the activity summaries the server stores. They stay in the language they
//   were written in.
export const en = {
  meta: {
    description: "Catch scope creep in client messages and bill it with PayPal before you do the extra work.",
  },
  page: {
    sendBlocked: "PayPal sandbox keys aren't set on this server, so nothing can be sent.",
    reviewBlocked: "Claude isn't set up on this server, so messages can't be checked.",
    previewOnly: "Too many new demos were started recently, so this one is view-only and nothing is saved. Try again later.",
    missingVisitor: "Reload the page to start your demo.",
  },
  skeleton: {
    loading: "Loading your demo copy…",
  },
  localeSwitcher: {
    label: "Language",
  },
  clientLocale: {
    label: "Client's language",
    help: "New PayPal invoices are written in this language.",
    saveFailed: "The client's language couldn't be saved. Try again.",
  },
  workspace: {
    previewLabel: "View-only demo", // names the region around the page.previewOnly notice
    agreed: "Agreed",
    totalWithChanges: "Total with changes",
    notPaidYet: "{amount} not paid yet",
    you: "You",
    statusDraft: "Not sent yet",
    statusSent: "Sent to client, not paid yet",
    statusPaid: "Paid",
    statusPaidOn: "Paid {date}",
    statusWaived: "Included at no charge",
    statusCancelled: "Cancelled",
    agreedOn: "agreed {date}",
    allPaid: "All paid",
  },
  conversation: {
    title: "Conversation<sr> with {client}</sr>",
    ticketsFromMessage_one: "{count} ticket from this message",
    ticketsFromMessage_other: "{count} tickets from this message",
  },
  tickets: {
    title: "Tickets",
    count_one: "{count} ticket",
    count_other: "{count} tickets",
    open_one: "{count} open",
    open_other: "{count} open",
    empty: "No tickets yet. When Claude finds a request outside the agreed scope, it prints a ticket here.",
  },
  ticket: {
    label: "TICKET",
    hours: "≈ {hours} h",
    asked: "{author}, {date}:",
    showInMessage: "Show in the message: ",
    notInScope: "Not in the agreed scope.",
    gateLocked: "Work locked until paid",
    gateUnlocked: "Work unlocked",
    gateWaived: "Work unlocked, not billed",
    gateCancelled: "Work called off",
    stampSent: "Sent · PayPal",
    stampPaid: "Paid",
    stampPaidOn: "Paid · {date}",
    stampWaived: "No charge",
    stampVoid: "Void",
  },
  scope: {
    title: "Scope",
    version: "Version 1, agreed {date}",
    changeOrders: "Change orders",
    agreed: "Agreed",
    changeOrdersTotal: "Change orders",
    total: "Total",
    none: "None yet.",
  },
  activity: {
    title: "Activity",
    lead: "Claude proposes. Nothing reaches PayPal until you press a button.",
    empty: "Nothing yet. Check a message or send a change order, and each step shows up here.",
    steps_one: "{count} step",
    steps_other: "{count} steps",
    earlier_one: "{count} earlier step",
    earlier_other: "{count} earlier steps",
  },
  changeOrder: {
    send: "Send change order",
    sendAgain: "Send again",
    sending: "Sending…",
    includeFree: "Include at no charge",
    keepCharge: "Keep the charge",
    confirmWaive: "Confirm: include at no charge",
    waiveConfirmHelp: "The client won't be billed for this, and it can't be undone.",
    resendHelp:
      "PayPal already has this invoice from an earlier try, and the client may have it. Send it again to finish; you can cancel it afterwards.",
    openPayerPage: "Open the client's PayPal page",
    opensNewTab: "(opens in a new tab)",
    payAsClient:
      "Pay it as the client with the sandbox buyer account from the Devpost testing notes. This page turns green when PayPal confirms.",
    checkPayment: "Check payment",
    checking: "Checking…",
    cancelInvoice: "Cancel invoice",
    keepInvoice: "Keep the invoice",
    confirmCancel: "Confirm: cancel the invoice",
    cancelling: "Cancelling…",
    cancelConfirmHelp: "PayPal will cancel the invoice and the client can no longer pay it. You can quote this again afterwards.",
    quoteAgain: "Quote again",
    quoting: "Quoting…",
  },
  changeOrderErrors: {
    invalid_input: "This change order isn't in your demo copy. Reload the page.",
    not_found: "This change order isn't in your demo copy. Reload the page.",
    invalid_state: "This change order was already updated. Reload to see it.",
    server_error: "This couldn't be saved just now. Nothing changed; try again.",
    in_progress: "This invoice is already being sent. Wait a moment, then reload.",
    paypal_unavailable: "PayPal didn't respond. Try again; the client won't get a second invoice.",
    paypal_rejected: "PayPal refused this request, so nothing was sent.",
    already_paid: "The client already paid this invoice, so it can't be cancelled.",
    not_configured: "PayPal isn't set up on this server, so nothing was sent.",
    invoice_exists:
      "PayPal already has an invoice for this, so it can't be included at no charge. Send it again; you can cancel it afterwards.",
    paypal_unconfirmed:
      "PayPal may have sent it, but this page couldn't confirm it. Press Send again to check; the client won't get a second invoice.",
    invoice_void: "PayPal can't use this invoice any more, so it's marked cancelled here. Quote it again to send a new one.",
    rate_limited:
      "The demo server has sent as many PayPal invoices as it may for now, across all visitors, so nothing was sent. Try again later.",
    copy_rate_limited:
      "Your demo copy has used its {max} PayPal sends for the last 24 hours, so nothing was sent; resetting it doesn't change that.",
    not_paid_yet: "PayPal doesn't show this invoice as fully paid yet. Check again after the client pays.",
    invoice_changed: "PayPal shows a different amount for this invoice, so it wasn't marked paid. Check it in PayPal.",
  },
  cancelErrors: {
    paypal_unavailable: "PayPal didn't respond, so the invoice may still be open. Try again.",
    paypal_rejected: "PayPal refused to cancel it, so the invoice is still open.",
    paypal_unconfirmed:
      "PayPal cancelled the invoice, but this page couldn't save that. Cancel it again to bring the page up to date.",
    not_configured: "PayPal isn't set up on this server, so the invoice wasn't cancelled.",
  },
  checkErrors: {
    paypal_unavailable: "PayPal didn't respond, so the payment couldn't be checked. Try again.",
    paypal_rejected: "PayPal refused to show this invoice, so the payment couldn't be checked.",
    not_configured: "PayPal isn't set up on this server, so the payment couldn't be checked.",
  },
  composer: {
    label: "New message from {client}",
    placeholder: "Paste their latest email or chat message",
    help: "Claude compares it with scope version 1. This is a public demo: the text goes to Claude and stays in your copy, so paste nothing private.",
    useSample: "Use a sample message",
    check: "Check scope",
    checking: "Checking…",
    reading: "Claude is reading the message. This can take up to a minute.",
    nothingFound: "Claude found nothing outside the agreed scope.",
    marked_one: "Claude marked {count} request in the message above. Review it before anything is sent.",
    marked_other: "Claude marked {count} requests in the message above. Review them before anything is sent.",
  },
  composerErrors: {
    invalid_input: "Paste a message first.",
    not_found: "Your demo copy couldn't be found. Reload the page.",
    invalid_state: "This couldn't be checked just now. Try again.",
    server_error: "This couldn't be saved just now. Nothing changed; try again.",
    too_long: "That's longer than this demo checks ({max} characters). Paste the part with the requests.",
    not_configured: "Claude isn't set up on this server, so the message wasn't checked.",
    rate_limited: "This demo has checked as many messages as it may for now, so Claude wasn't called. Try again later.",
    claude_unavailable: "Claude couldn't review this just now. Nothing was saved, so you can try again.",
    claude_refused: "Claude declined to review this message. Nothing was saved.",
  },
  delivery: {
    title: "Delivery",
    lead: "Extra work stays locked until it's paid.",
    launch: "Launch",
    movedForScreenReaders: "agreed {agreed}, now {launch}",
    noOrders: "No change orders yet, so the launch is as agreed.",
    launchIfPaid: "Paying the locked work moves the launch to <nowrap>{date}.</nowrap>",
    locked: "Locked — starts when paid",
    unlocked: "Unlocked",
    unlockedOn: "Unlocked {date}",
    included: "Included at no charge",
    days_one: "{count} day",
    days_other: "{count} days",
    roadLaunch: "<b>{date}</b> launch",
    roadAgreed: "{date} agreed",
    roadIfPaid: "{date} if paid",
  },
  guide: {
    summaryTitle: "How this demo works.",
    summaryText: "Tollgate finds the extra work hiding in a client's message and bills it through PayPal before you build it.",
    show: "Show",
    hide: "Hide",
    step1Live: "Paste a new message from {client}, or press <b>Use a sample message</b>, then <b>Check scope</b>.",
    step1Target:
      "Live Claude checks are off on this public demo. {author}'s {sentOn} message already has a <link>marked request</link> — start at step 3.",
    step1NoTarget:
      "Live Claude checks are off on this public demo. The requests already marked in {client}'s messages show what a check finds; <b>Reset demo</b> brings back one to send.",
    step2:
      "Claude marks what the agreed scope doesn't cover and estimates the hours. The price is your hourly rate times those hours. Nothing is sent yet.",
    step3:
      "Press <b>Send change order</b> to send a PayPal sandbox invoice. When the client pays it, the work unlocks, the launch moves, and the total turns green.",
    goToOrder: "Go to the change order",
    footer: "This copy is yours alone; <b>Reset demo</b> puts it back. PayPal runs in sandbox mode, so no real money moves.",
  },
  reset: {
    reset: "Reset demo",
    keep: "Keep my changes",
    confirm: "Confirm: reset demo",
    resetting: "Resetting…",
    confirmHelp: "This deletes every change you made to this demo and starts it over.",
    done: "Demo reset.",
  },
  resetErrors: {
    invalid_input: "This isn't your demo copy. Reload the page.",
    not_found: "This isn't your demo copy. Reload the page.",
    invalid_state: "The demo changed while resetting. Reload the page.",
    server_error: "The demo couldn't be reset just now. Nothing changed; try again.",
    invoice_open:
      "A change order has a PayPal invoice the client can still pay, so the demo wasn't reset. Cancel that invoice first (a draft marked Send again: send it, then cancel it), then reset.",
  },
  // What PayPal shows the client, in the project's client language (server/billing.ts). The English lines are the
  // ones every recorded PayPal answer was made with; keep them byte for byte.
  invoice: {
    description: "Estimated {hours} h at {rate}/h",
    descriptionRounded: "Estimated {hours} h at {rate}/h, rounded up to the next {step}",
    note: "Change order for {project}. Not part of the agreed scope.",
  },
} as const;

type En = typeof en;

// The shape every other locale fills: the same groups and keys, any text.
export type Catalog = { readonly [G in keyof En]: { readonly [K in keyof En[G]]: string } };

import { existsSync } from "node:fs";
import { createClient } from "@libsql/client";
import { expect, test, type Page } from "@playwright/test";

if (existsSync(".env.local")) process.loadEnvFile(".env.local"); // the test process reads the invoice from PayPal directly

const DB_URL = "file:data/e2e-paypal.db"; // the keyed server's database (playwright.config.ts)
const API = "https://api-m.sandbox.paypal.com";

const draft = (page: Page) => page.locator('aside[data-status="draft"][data-change-order-id]').first();
const note = (page: Page, id: string) => page.locator(`aside[data-change-order-id="${id}"]`);

async function invoiceStatus(invoiceId: string): Promise<string> {
  const basic = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString("base64");
  const tokenRes = await fetch(`${API}/v1/oauth2/token`, { method: "POST", headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials" });
  const { access_token } = (await tokenRes.json()) as { access_token: string };
  const res = await fetch(`${API}/v2/invoicing/invoices/${invoiceId}`, { headers: { Authorization: `Bearer ${access_token}` } });
  return ((await res.json()) as { status: string }).status;
}

async function invoiceIdOf(orderId: string): Promise<string> {
  const db = createClient({ url: DB_URL });
  try {
    await db.execute("PRAGMA busy_timeout = 5000");
    const { rows } = await db.execute({ sql: "SELECT paypal_invoice_id FROM change_orders WHERE id = ?", args: [orderId] });
    return String(rows[0].paypal_invoice_id);
  } finally {
    db.close();
  }
}

// The judge's shortcut on the keyed server: send, simulate the client's payment, then Check payment settles it. Webhooks
// can't reach this local server, so Check payment reads PayPal's MARKED_AS_PAID; on the live demo the webhook does it.
test.describe("결제 시뮬레이션 (키 있는 서버)", () => {
  test.setTimeout(150_000);

  test("보낸 견적에서 결제를 시뮬레이션하면 PayPal이 MARKED_AS_PAID가 되고, 결제 확인으로 Paid가 되며 차단기가 올라간다", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.goto("/");
    const orderId = (await draft(page).getAttribute("data-change-order-id"))!;
    const ticket = note(page, orderId);

    // Send: the button says what is happening while PayPal works, and can't be pressed again
    const send = ticket.getByRole("button", { name: "Send change order" });
    await send.click();
    await expect(ticket.getByRole("button", { name: /Creating and sending the PayPal invoice/ })).toHaveAttribute("aria-disabled", "true");
    await expect(ticket).toHaveAttribute("data-status", "sent", { timeout: 40_000 });

    // The real path stays first; the shortcut is a secondary, explained sandbox button
    await expect(ticket.getByRole("link", { name: /client's PayPal page/ })).toBeVisible();
    const simulate = ticket.getByRole("button", { name: /Simulate the client's payment/ });
    await expect(simulate).toHaveAccessibleDescription(/Sandbox shortcut/);
    await simulate.click();
    await expect(ticket.getByTestId("simulate-status")).toContainText("Payment recorded in the PayPal sandbox", { timeout: 40_000 });
    await expect(ticket).toHaveAttribute("data-status", "sent"); // not marked paid by the app itself
    await expect(page.getByTestId("activity-panel").locator('[data-kind="payment_recorded"]')).toContainText("as if the client paid");
    expect(await invoiceStatus(await invoiceIdOf(orderId))).toBe("MARKED_AS_PAID");

    // Pressing again records nothing more
    await simulate.click();
    await expect(ticket.getByRole("alert")).toContainText("already shows this invoice as paid", { timeout: 40_000 });

    await ticket.getByRole("button", { name: "Check payment" }).click();
    await expect(ticket).toHaveAttribute("data-status", "paid", { timeout: 40_000 });
    await expect(ticket).toHaveAttribute("data-gate", "up");
    await context.close();
  });
});

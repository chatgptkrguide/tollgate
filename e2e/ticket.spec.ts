import { createClient } from "@libsql/client";
import { expect, test, type Browser, type Page } from "@playwright/test";

// The "Toll ticket" screen on the server without PayPal or Claude keys. Sent and paid states are written straight
// into this server's throwaway database (nothing here can call PayPal), then the tab is brought back the way a
// visitor returning from the PayPal tab does: RefreshOnReturn re-reads the page on visibilitychange.
const DB_URL = "file:data/e2e.db"; // the no-paypal server's database (playwright.config.ts)

const ticket = (page: Page, id: string) => page.locator(`aside.ticket[data-change-order-id="${id}"]`);
const draftId = async (page: Page) => (await page.locator("aside.ticket[data-status='draft']").first().getAttribute("data-change-order-id")) ?? "";

async function setOrder(id: string, sql: string, args: (string | null)[] = []) {
  const db = createClient({ url: DB_URL });
  await db.execute("PRAGMA busy_timeout = 5000"); // the server may be writing the same file (SQLITE_BUSY otherwise)
  await db.execute({ sql: `UPDATE change_orders SET ${sql} WHERE id = ?`, args: [...args, id] });
  db.close();
}

// Draft → sent (as PayPal would leave it), then the page is read again so the tab has seen it sent.
async function sendInDatabase(page: Page, id: string) {
  await setOrder(id, "status = 'sent', sent_at = ?, paypal_invoice_id = ?, payer_view_url = ?", [
    new Date().toISOString(),
    `INV2-E2E-${id.slice(0, 8)}`,
    "https://www.sandbox.paypal.com/invoice/p/#INV2E2E",
  ]);
  await page.reload({ waitUntil: "networkidle" });
  await expect(ticket(page, id)).toHaveAttribute("data-status", "sent");
}

async function payAndComeBack(page: Page, id: string) {
  await setOrder(id, "status = 'paid', paid_at = ?", [new Date().toISOString()]);
  // The listener attaches once the page has hydrated, and refreshes at most every five seconds, so try again after that.
  await expect(async () => {
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await expect(ticket(page, id)).toHaveAttribute("data-status", "paid", { timeout: 2000 });
  }).toPass({ intervals: [5500], timeout: 20_000 });
}

async function openWith(browser: Browser, reducedMotion: "reduce" | "no-preference") {
  const context = await browser.newContext({ reducedMotion });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.getByTestId("workspace")).toBeVisible();
  return { context, page };
}

test.describe("Toll ticket 화면", () => {
  test("티켓은 TICKET 번호와 상태 글자를 보여 주고, 색 램프는 글자 옆 장식일 뿐이다", async ({ page }) => {
    await page.goto("/");
    const id = await draftId(page);
    const draft = ticket(page, id);

    await expect(draft).toContainText("TICKET");
    await expect(draft).toContainText(/TG-[0-9A-Z]{22}/);
    await expect(draft.getByRole("status")).toHaveText("Not sent yet");
    await expect(draft.locator(".lamp")).toHaveAttribute("aria-hidden", "true");
    await expect(draft).toHaveAttribute("data-gate", "down");
    await expect(draft).toContainText("$650");

    const paid = page.locator("aside.ticket[data-status='paid']");
    await expect(paid.getByRole("status")).toHaveText("Paid Oct 26");
    await expect(paid).toHaveAttribute("data-gate", "up");
  });

  test("새 티켓이 위에 오도록 가장 최근 메시지의 티켓이 먼저 나온다", async ({ page }) => {
    await page.goto("/");

    const titles = await page.locator("aside.ticket h3").allInnerTexts();

    expect(titles).toEqual(["Loyalty page with customer login", "Gift card page"]);
  });

  test("티켓에 마우스를 올리면 그 문구도 강조되고, 문구를 누르면 그 티켓으로 간다", async ({ page }) => {
    await page.goto("/");
    const id = await draftId(page);
    const findingLink = await ticket(page, id).getAttribute("data-link");
    const mark = page.locator(`mark[data-link="${findingLink}"]`);

    await ticket(page, id).locator("h3").hover();
    await expect(mark).toHaveAttribute("data-linked", "");
    await page.mouse.move(0, 0);
    await expect(mark).not.toHaveAttribute("data-linked");

    await mark.getByRole("link").click();
    await expect(page).toHaveURL(new RegExp(`#note-${id}$`));
    // By keyboard: the quote wraps over two lines, so the middle of its box can fall between them.
    await ticket(page, id).getByRole("link", { name: /Show in the message/ }).press("Enter");
    await expect(page).toHaveURL(new RegExp(`#quote-${findingLink}$`));
  });

  test("움직임 줄이기에서는 결제가 들어오면 애니메이션 표시 없이 결제 상태가 바로 보인다", async ({ browser }) => {
    const { context, page } = await openWith(browser, "reduce");
    const id = await draftId(page);
    await sendInDatabase(page, id);

    await payAndComeBack(page, id);

    await expect(ticket(page, id).getByRole("status")).toContainText("Paid");
    await expect(ticket(page, id)).toHaveAttribute("data-gate", "up");
    await expect(page.getByTestId("header-total")).toContainText("All paid");
    await expect(page.getByTestId("delivery-panel").locator(`li[data-change-order-id="${id}"]`)).toHaveAttribute("data-delivery-state", "unlocked");
    await expect(page.locator("[data-fx]")).toHaveCount(0);
    await context.close();
  });

  test("보낸 견적이 결제되면 차단기 올림 효과가 한 번 재생되고 끝나면 표시가 사라진다", async ({ browser }) => {
    const { context, page } = await openWith(browser, "no-preference");
    const id = await draftId(page);
    await sendInDatabase(page, id);
    await expect(ticket(page, id).getByRole("status")).toHaveText("Sent to client, not paid yet");

    await payAndComeBack(page, id);

    await expect(ticket(page, id)).toHaveAttribute("data-fx", "lift");
    await expect(page.getByTestId("header-total")).toHaveAttribute("data-fx", "settle");
    await expect(page.getByTestId("delivery-launch")).toHaveAttribute("data-fx", "flip");
    await expect(ticket(page, id)).not.toHaveAttribute("data-fx", { timeout: 3000 });
    await page.reload();
    await expect(ticket(page, id)).toHaveAttribute("data-gate", "up");
    await expect(page.locator("[data-fx]")).toHaveCount(0); // 이미 본 결제는 다시 재생하지 않는다
    await context.close();
  });
});

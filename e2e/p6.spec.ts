import { expect, test, type Page } from "@playwright/test";

const delivery = (page: Page) => page.getByTestId("delivery-panel");
const row = (page: Page, title: string) => delivery(page).getByRole("listitem").filter({ hasText: title });

test.describe("P6 납품 일정", () => {
  test("시드 상태에서 결제된 기프트카드는 풀려 출시일에 들어가고, 초안 로열티는 잠겨 있다", async ({ page }) => {
    await page.goto("/");

    await expect(delivery(page).getByRole("heading", { name: "Delivery" })).toBeVisible();
    await expect(page.getByTestId("delivery-launch")).toContainText("agreed Nov 15, now Nov 16");
    await expect(page.getByTestId("delivery-launch").locator("[aria-hidden=true]")).toHaveText(/Nov 15\s*→\s*Nov 16/);

    const gift = row(page, "Gift card page");
    await expect(gift).toHaveAttribute("data-delivery-state", "unlocked");
    await expect(gift).toContainText("Unlocked Oct 26");
    await expect(gift).toContainText("+1 day");

    const loyalty = row(page, "Loyalty page with customer login");
    await expect(loyalty).toHaveAttribute("data-delivery-state", "locked");
    await expect(loyalty).toContainText("Locked — starts when paid");
    await expect(loyalty).toContainText("3 days");
    await expect(loyalty).not.toContainText("+3");

    await expect(delivery(page)).toContainText("Paying the locked work moves the launch to Nov 19.");
  });

  test("로열티를 무료 처리하면 포함으로 풀려 출시일이 Nov 19로 옮겨진다", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.goto("/");

    await page.getByRole("button", { name: "Include at no charge", exact: true }).click();
    await page.getByRole("button", { name: "Confirm: include at no charge", exact: true }).click();

    const loyalty = row(page, "Loyalty page with customer login");
    await expect(loyalty).toHaveAttribute("data-delivery-state", "included");
    await expect(loyalty).toContainText("Included, no charge");
    await expect(page.getByTestId("delivery-launch")).toContainText("agreed Nov 15, now Nov 19");
    await expect(delivery(page)).not.toContainText("Paying the locked work");
    await context.close();
  });
});

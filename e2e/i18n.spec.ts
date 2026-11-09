import { expect, test, type Page } from "@playwright/test";

// The screen language (the visitor's tg_locale cookie) and the client language (the project's client_locale, what
// new PayPal invoices are written in) on the server without PayPal or Claude keys. Chrome asks for English, so every
// page opens in English until the visitor picks another language.

// The client language after a reload, rendered by the server from the database. (Reading data/e2e.db from the
// test while the server writes it made the server's write fail with "database is locked".)
async function storedClientLocale(page: Page): Promise<string> {
  await page.reload();
  return page.getByRole("combobox", { name: "Client's language" }).inputValue();
}

test.describe("화면 언어", () => {
  test("처음에는 영어이고, 언어 선택은 앱 막대에 각 언어 자기 이름으로 있다", async ({ page }) => {
    await page.goto("/");

    const switcher = page.getByRole("combobox", { name: "Language", exact: true });
    await expect(switcher).toHaveValue("en");
    await expect(page.locator("#locale-slot").getByRole("combobox")).toHaveCount(1);
    await expect(switcher.locator("option")).toHaveText(["English", "한국어", "日本語", "Español", "Português"]);
    await expect(page.getByRole("button", { name: "Check scope" })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "en-US");
  });

  test("한국어를 고르면 버튼·티켓 머리·상태가 한국어로 바뀌고, 새로고침해도 그대로다", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("combobox", { name: "Language", exact: true }).selectOption("ko");

    await expect(page.getByRole("button", { name: "범위 확인" })).toBeVisible();
    const draft = page.locator("aside.ticket[data-status='draft']").first();
    await expect(draft).toContainText("티켓");
    await expect(draft.getByRole("status")).toHaveText("아직 안 보냄");
    await expect(page.getByRole("heading", { name: "티켓", exact: true })).toBeVisible();
    await expect(page.getByTestId("header-total")).toContainText("추가 포함 합계");
    await expect(page.locator("html")).toHaveAttribute("lang", "ko-KR");

    await page.reload();

    await expect(page.getByRole("button", { name: "범위 확인" })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "언어 (Language)" })).toHaveValue("ko");
    await expect(page.getByRole("button", { name: "Check scope" })).toHaveCount(0);
  });

  test("한국어 화면에서도 대화 내용과 변경 주문 제목은 쓴 그대로다", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("combobox", { name: "Language", exact: true }).selectOption("ko");

    await expect(page.getByRole("button", { name: "범위 확인" })).toBeVisible();
    await expect(page.locator("aside.ticket").first()).toContainText("Loyalty page with customer login");
    await expect(page.getByText("Quick one: could we")).toBeVisible();
  });
});

test.describe("클라이언트 언어", () => {
  test("고르면 저장되어 새로고침해도 남고, 화면 언어는 바뀌지 않는다", async ({ page }) => {
    await page.goto("/");
    const select = page.getByRole("combobox", { name: "Client's language" });
    await expect(select).toHaveValue("en");
    await expect(page.getByText("New PayPal invoices are written in this language.")).toBeVisible();

    await select.selectOption("ja");

    await expect.poll(() => storedClientLocale(page)).toBe("ja");
    await expect(page.getByRole("combobox", { name: "Language", exact: true })).toHaveValue("en");
    await expect(page.getByRole("button", { name: "Check scope" })).toBeVisible();
  });

  test("데모를 초기화하면 클라이언트 언어는 영어로 돌아간다", async ({ page }) => {
    await page.goto("/");
    const select = page.getByRole("combobox", { name: "Client's language" });
    await select.selectOption("es");
    await expect.poll(() => storedClientLocale(page)).toBe("es");

    await page.getByRole("button", { name: "Reset demo" }).click();
    await page.getByRole("button", { name: "Confirm: reset demo" }).click();

    await expect(page.getByRole("combobox", { name: "Client's language" })).toHaveValue("en");
  });
});

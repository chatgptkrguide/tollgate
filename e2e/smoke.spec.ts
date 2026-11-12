import { expect, test } from "@playwright/test";

test("첫 화면이 열리고 제품 이름이 보인다", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("Tollgate", { exact: true })).toBeVisible();
});

const SECURITY_HEADERS = {
  "content-security-policy": "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'",
  "strict-transport-security": "max-age=31536000; includeSubDomains",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=()",
};

test("페이지·웹훅·정적 파일 응답 모두 보안 헤더를 싣고, X-Powered-By는 없다", async ({ request }) => {
  const page = await request.get("/");
  const webhook = await request.post("/api/webhooks/paypal", { data: {} }); // refused (no keys, no signature), still with headers
  const health = await request.get("/api/health/live");
  const icon = await request.get("/icon.svg");

  expect(page.status()).toBe(200);
  for (const response of [page, webhook, health, icon]) {
    const headers = response.headers();
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) expect(headers[name], `${response.url()} ${name}`).toBe(value);
    expect(headers["x-powered-by"], response.url()).toBeUndefined();
  }
});

test("보안 헤더 아래에서도 글꼴 미리 불러오기가 남고, 화면이 CSP에 막히는 것 없이 움직인다", async ({ page }) => {
  const refused: string[] = [];
  page.on("console", (message) => {
    if (/Content Security Policy|Refused to/i.test(message.text())) refused.push(message.text());
  });

  const response = await page.goto("/");

  expect(response?.headers()["link"]).toContain('as="font"');
  await page.getByRole("button", { name: "Show details" }).click(); // only answers once React has hydrated
  await expect(page.getByTestId("guide-steps")).toBeVisible();
  expect(await page.evaluate(async () => (await document.fonts.ready).status)).toBe("loaded");
  expect(refused).toEqual([]);
});

test("브랜드 아이콘·링크 미리보기 그림·매니페스트가 열리고, 첫 화면 head가 그것들을 가리킨다", async ({ page, request }) => {
  for (const [path, type] of [
    ["/favicon.ico", "image/x-icon"],
    ["/icon.svg", "image/svg+xml"],
    ["/apple-icon.png", "image/png"],
    ["/opengraph-image.png", "image/png"],
    ["/manifest.webmanifest", "application/manifest+json"],
  ] as const) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
    expect(response.headers()["content-type"], path).toContain(type);
  }

  await page.goto("/");
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
  await expect(page.locator('link[rel="manifest"]')).toHaveCount(1);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /\/opengraph-image\.png/);
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#12161f");
});

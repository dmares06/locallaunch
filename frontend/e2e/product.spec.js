import { test, expect } from "@playwright/test";

test("a new owner can publish, take a booking, manage it, and unpublish", async ({
  page,
}) => {
  const email = `browser-${Date.now()}@example.com`;
  const password = "Browser-test-password-123!";
  await page.goto("/");
  await page.getByRole("link", { name: "Get started", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Your name", exact: true })
    .fill("Browser Owner");
  await page
    .getByRole("textbox", { name: "Email address", exact: true })
    .fill(email);
  await page
    .getByRole("textbox", { name: "Password", exact: true })
    .fill(password);
  await page
    .getByRole("button", { name: "Create my account", exact: true })
    .click();
  await expect(page).toHaveURL(/\/onboarding$/);
  const name = `Browser Studio ${Date.now()}`;
  await page
    .getByRole("textbox", { name: "Business name", exact: true })
    .fill(name);
  await page
    .getByRole("textbox", { name: "City and state", exact: true })
    .fill("Brooklyn, NY");
  await page
    .getByRole("button", { name: "Next: add your services", exact: true })
    .click();
  await expect(page).toHaveURL(/\/dashboard\/services$/);
  await page
    .getByRole("textbox", { name: "Service name", exact: true })
    .fill("Signature appointment");
  await page.getByRole("button", { name: "Add service", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Signature appointment", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Availability", exact: true }).click();
  await page
    .getByRole("button", { name: "Save opening hours", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Your regular hours are saved.",
  );
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await page
    .getByRole("button", { name: "Publish your page", exact: true })
    .click();
  const publicLink = page.getByRole("link", {
    name: "View business page",
    exact: true,
  });
  await expect(publicLink).toBeVisible();
  const publicPath = await publicLink.getAttribute("href");
  await publicLink.click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  const minimum = await page.locator("#booking-date").getAttribute("min");
  const target = new Date(minimum + "T12:00:00Z");
  target.setUTCDate(target.getUTCDate() + 2);
  while ([0, 6].includes(target.getUTCDay()))
    target.setUTCDate(target.getUTCDate() + 1);
  await page.locator("#booking-date").fill(target.toISOString().slice(0, 10));
  await expect(page.locator(".date-chip.selected")).toContainText(
    String(target.getUTCDate()),
  );
  await expect(page.locator(".time-slot").first()).toBeVisible();
  await page.route("**/availability?**", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    await route.continue();
  });
  target.setUTCDate(target.getUTCDate() + 1);
  while ([0, 6].includes(target.getUTCDay()))
    target.setUTCDate(target.getUTCDate() + 1);
  await page.locator("#booking-date").fill(target.toISOString().slice(0, 10));
  await expect(page.locator(".time-slot").first()).toBeDisabled();
  await expect(
    page.getByRole("button", {
      name: "A good time. Let’s book it.",
      exact: true,
    }),
  ).toBeDisabled();
  await expect(page.locator(".date-chip.selected")).toContainText(
    String(target.getUTCDate()),
  );
  await expect(page.locator(".time-slot").first()).toBeEnabled();
  await page.locator(".time-slot").first().click();
  await page
    .getByRole("button", { name: "A good time. Let’s book it.", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Your name", exact: true })
    .fill("Browser Customer");
  await page
    .getByRole("textbox", { name: "Email address", exact: true })
    .fill("customer@example.com");
  await page
    .getByRole("button", { name: "Confirm booking", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "See you soon.", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "My workspace", exact: true }).click();
  await page.reload();
  const detail = page.getByRole("button", {
    name: "View booking for Browser Customer",
    exact: true,
  });
  await expect(detail).toBeVisible();
  await expect(
    page.locator(".metric-card").filter({ hasText: "Booked value" }),
  ).toContainText("$45.00");
  await detail.click();
  await expect(page.getByRole("dialog")).toContainText("customer@example.com");
  await page
    .getByRole("button", { name: "Mark completed", exact: true })
    .click();
  await page.getByRole("link", { name: "Bookings", exact: true }).click();
  await page.getByRole("button", { name: "Completed", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "View booking for Browser Customer",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Business page", exact: true }).click();
  const priorSlug = await page.locator("#business-slug").inputValue();
  await page
    .getByRole("textbox", { name: "Business name", exact: true })
    .fill(name + " Updated");
  await expect(page.locator("#business-slug")).toHaveValue(priorSlug);
  await page
    .getByRole("button", { name: "Unpublish page", exact: true })
    .click();
  await expect(
    page.getByText("Your page is a draft", { exact: true }),
  ).toBeVisible();
  const response = await page.request.get(
    "/api/businesses/" + publicPath.split("/").pop(),
  );
  expect(response.status()).toBe(404);
  // Desktop keeps logout in the sidebar, narrow layouts expose it in the top bar.
  await page
    .getByRole("button", { name: "Log out", exact: true })
    .filter({ visible: true })
    .click();
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
});

test("sample pages and the workspace stay usable at phone and desktop widths", async ({
  page,
}) => {
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ["/", "/demo", "/discover", "/b/the-sunday-standard"]) {
      await page.goto(path);
      await expect(
        page.getByRole("heading", { level: 1 }).first(),
      ).toBeVisible();
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        )
        .toBe(true);
    }
  }
  await page.goto("/demo");
  await expect(page.locator(".demo-banner")).toContainText("sample customers");
  await page.getByRole("link", { name: "Services", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Make it yours", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add service", exact: true }),
  ).toHaveCount(0);
});

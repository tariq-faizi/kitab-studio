import { test, expect } from "@playwright/test";
async function create(page: any, title: string) {
  await page
    .getByRole("button", { name: "New book", exact: true })
    .first()
    .click();
  await page.getByLabel("title", { exact: true }).fill(title);
  for (let i = 0; i < 5; i++)
    await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByRole("button", { name: "Create book", exact: true })
    .last()
    .click();
}
test("Offline creation, manual breaks, page management, contents, revision, and asset library", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.getByLabel("Application language").selectOption("en");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await create(page, "Offline from the beginning");
  const editor = page.getByRole("textbox", { name: "Book page editor" });
  await editor.fill("First half. Second half.");
  await editor.press("Home");
  await editor.press("Control+Home");
  for (let i = 0; i < 12; i++) await editor.press("ArrowRight");
  await page.getByLabel("Insert content block").selectOption("break");
  await expect(page.locator(".outline-page")).toHaveCount(2);
  await expect(editor).toContainText("Second half.");
  await page.getByRole("button", { name: "Previous page" }).click();
  await expect(editor).toContainText("First half.");
  await page.getByRole("button", { name: "Page actions" }).click();
  await page.getByRole("button", { name: "Duplicate", exact: true }).click();
  await expect(page.locator(".outline-page")).toHaveCount(3);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.locator(".outline-page")).toHaveCount(2);
  await page.getByRole("button", { name: "Undo book change" }).click();
  await expect(page.locator(".outline-page")).toHaveCount(3);
  await page.getByRole("button", { name: "Redo book change" }).click();
  await expect(page.locator(".outline-page")).toHaveCount(2);
  await page
    .getByRole("button", { name: "Images & assets", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .locator("input[type=file]")
    .setInputFiles("public/icons/icon-192.png");
  await expect(page.locator(".asset-grid img")).toHaveCount(1);
  await page.getByRole("button", { name: "Insert", exact: true }).click();
  await expect(page.locator(".tiptap img")).toHaveCount(1);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page
    .getByRole("button", { name: "Table of contents", exact: true })
    .click();
  await expect(editor).toContainText("Table of contents");
  await expect(editor).toContainText("Chapter 1");
  await page.getByRole("button", { name: "Edit chapter Chapter 1" }).click();
  await page.getByRole("dialog").locator("input").fill("Renamed chapter");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await expect(editor).toContainText("Renamed chapter");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page
    .getByRole("button", { name: "Revision history", exact: true })
    .click();
  await expect(page.locator(".revision-row")).not.toHaveCount(0);
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Back to library" }).click();
  await expect(page.locator(".book-card")).toHaveCount(1);
});

test("Custom templates, language directions, settings, and accessible mobile navigation", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Application language").selectOption("en");
  await page
    .getByRole("button", { name: "Template gallery", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Custom template", exact: true })
    .click();
  await page
    .getByText("Template name", { exact: true })
    .locator("..")
    .locator("input")
    .fill("QA custom style");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".template-card")).toHaveCount(20);
  await page.reload();
  await page
    .getByRole("button", { name: "Template gallery", exact: true })
    .click();
  await expect(page.locator(".template-card")).toHaveCount(20);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page
    .getByText("Appearance", { exact: true })
    .last()
    .locator("..")
    .locator("select")
    .selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.screenshot({ path: "qa/11-dark-settings.png", fullPage: true });
  for (const lang of ["ps", "fa", "ar", "ur", "en"]) {
    await page.getByLabel("Application language").selectOption(lang);
    await expect(page.locator("html")).toHaveAttribute("lang", lang);
    await expect(page.locator("html")).toHaveAttribute(
      "dir",
      lang === "en" ? "ltr" : "rtl",
    );
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(page.locator(".sidebar")).toHaveClass(/open/);
  await page
    .getByRole("button", { name: "Template gallery", exact: true })
    .click();
  await expect(page.locator(".sidebar")).not.toHaveClass(/open/);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});

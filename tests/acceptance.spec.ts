import { test, expect } from "@playwright/test";
import fs from "node:fs";
import JSZip from "jszip";
const ps = "زه د پښتو ژبې یو کتاب لیکم. دا زما د کتاب لومړی مخ دی.";
fs.mkdirSync("qa/exports", { recursive: true });
test("Offline publishing workflow, exports, restore, and responsive layouts", async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto("/");
  await expect(page.locator(".brand").first()).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "ps");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await page.getByLabel("Application language").selectOption("en");
  await page
    .getByRole("button", { name: "New book", exact: true })
    .first()
    .click();
  await page.getByLabel("title", { exact: true }).fill("د رڼا سفر");
  await page.getByLabel("author", { exact: true }).fill("احمد — Ahmad");
  await page
    .getByRole("dialog")
    .getByText("Language", { exact: true })
    .locator("..")
    .locator("select")
    .selectOption("ps");
  for (let i = 0; i < 2; i++)
    await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button").filter({ hasText: "Pashto Poetry" }).click();
  for (let i = 0; i < 3; i++)
    await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByRole("button", { name: "Create book", exact: true })
    .last()
    .click();
  await expect(
    page.getByRole("textbox", { name: "Book page editor" }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Book page editor" })
    .fill(ps + "\nKitab Studio — English and پښتو together.");
  await expect(
    page.getByRole("textbox", { name: "Book page editor" }),
  ).toHaveAttribute("dir", "rtl");
  await page
    .getByLabel("Font family", { exact: true })
    .selectOption("Noto Sans Arabic");
  await page.getByLabel("Font size", { exact: true }).fill("15");
  await page.getByLabel("Text color", { exact: true }).fill("#315847");
  await page.getByLabel("Top", { exact: true }).fill("22");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.waitForTimeout(500);
  for (const title of ["دوهم څپرکی", "دریم څپرکی"]) {
    await page
      .getByRole("button", { name: "Add chapter", exact: true })
      .click();
    await page.getByLabel("Chapter title").fill(title);
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Add", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "Book page editor" })
      .press("Control+End");
    await page
      .getByRole("textbox", { name: "Book page editor" })
      .press("Enter");
    await page
      .getByRole("textbox", { name: "Book page editor" })
      .pressSequentially("A new chapter.");
  }
  await page.getByRole("button", { name: "Add page", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Book page editor" })
    .fill(ps + "\nAn offline-ready manuscript.");
  await page.getByLabel("Insert content block").selectOption("table");
  await expect(page.locator(".tiptap table")).toBeVisible();
  await page.locator(".tiptap td").first().click();
  await page.keyboard.type("Notes");
  await page
    .locator(".format-toolbar input[type=file]")
    .setInputFiles("public/icons/icon-192.png");
  await expect(page.locator(".tiptap img")).toBeVisible();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: "Cover studio", exact: true }).click();
  await page.getByRole("button", { name: "Back cover", exact: true }).click();
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page
    .getByText("Text", { exact: true })
    .locator("..")
    .locator("textarea")
    .fill("د کتاب لنډه پېژندنه");
  await page.getByRole("button", { name: "Full cover preview" }).click();
  await page.screenshot({ path: "qa/03-cover-designer.png", fullPage: true });
  await page.getByRole("button", { name: "Writing", exact: true }).click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("button", { name: "Back to library" }).click();
  await expect(page.locator(".book-card")).toHaveCount(1);
  await page.screenshot({
    path: "qa/04-dashboard-english.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Template gallery", exact: true })
    .first()
    .click();
  await expect(page.locator(".template-card")).toHaveCount(19);
  await page.screenshot({ path: "qa/05-template-gallery.png", fullPage: true });
  await page.getByRole("button", { name: "My books", exact: true }).click();
  await page.reload();
  await expect(page.locator(".book-card")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Continue writing د رڼا سفر" })
    .click();
  await context.setOffline(true);
  await expect(page.locator(".editor-connect")).toContainText("Offline Mode");
  await page
    .getByRole("textbox", { name: "Book page editor" })
    .fill(ps + "\nEdited while offline.");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("button", { name: "Back to library" }).click();
  await page.reload();
  await expect(page.locator(".offline-banner")).toContainText("Offline Mode");
  await page
    .getByRole("button", { name: "Continue writing د رڼا سفر" })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Book page editor" }),
  ).toContainText(ps);
  // Verify all chapters and image survive reload using local IndexedDB.
  const stored = await page.evaluate(
    async () =>
      new Promise<any>((resolve, reject) => {
        const r = indexedDB.open("kitab-studio-v1");
        r.onsuccess = () => {
          const tx = r.result.transaction("books"),
            q = tx.objectStore("books").getAll();
          q.onsuccess = () => resolve(q.result[0]);
          q.onerror = reject;
        };
        r.onerror = reject;
      }),
  );
  expect(stored.chapters).toHaveLength(3);
  expect(stored.pages.length).toBeGreaterThanOrEqual(4);
  expect(stored.pages.some((p: any) => p.html.includes("<img"))).toBeTruthy();
  await page.getByRole("button", { name: "Export", exact: true }).click();
  let dl = page.waitForEvent("download");
  await page.getByRole("button", { name: "Editable Word document" }).click();
  const docx = await dl;
  await docx.saveAs("qa/exports/acceptance.docx");
  const zip = await JSZip.loadAsync(
    fs.readFileSync("qa/exports/acceptance.docx"),
  );
  const xml = await zip.file("word/document.xml")!.async("string");
  expect(xml).toContain("زه د پښتو");
  expect(xml).toContain("w:bidi");
  expect(
    Object.keys(zip.files).some((k) => k.startsWith("word/media/")),
  ).toBeTruthy();
  dl = page.waitForEvent("download");
  await page.getByRole("button", { name: "Complete project archive" }).click();
  const backup = await dl;
  await backup.saveAs("qa/exports/acceptance.kitab.zip");
  const bk = await JSZip.loadAsync(
    fs.readFileSync("qa/exports/acceptance.kitab.zip"),
  );
  expect(bk.file("book.json")).toBeTruthy();
  expect(
    Object.keys(bk.files).some(
      (k) => k.startsWith("fonts/") && k.endsWith(".woff2"),
    ),
  ).toBeTruthy();
  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Print / Save as PDF" }).click();
  const popup = await popupPromise;
  await popup.waitForFunction(
    () => document.querySelectorAll(".page").length > 0,
  );
  await popup.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      Array.from(document.images).map((i) => i.decode().catch(() => {})),
    );
  });
  await expect(popup.locator("body")).toContainText(ps);
  await popup.pdf({
    path: "qa/exports/acceptance.pdf",
    printBackground: true,
    preferCSSPageSize: true,
  });
  await popup.screenshot({ path: "qa/06-print-preview.png", fullPage: true });
  await popup.close();
  dl = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download self-contained print-ready HTML" })
    .click();
  await (await dl).saveAs("qa/exports/acceptance.print.html");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Back to library" }).click();
  await page
    .getByRole("button", { name: "Backup & restore", exact: true })
    .click();
  await page
    .locator(".upload-zone input")
    .setInputFiles("qa/exports/acceptance.kitab.zip");
  await expect(page.locator(".editor-book-title strong")).toContainText(
    "(restored)",
  );
  await page.getByRole("button", { name: "Back to library" }).click();
  await page.getByRole("button", { name: "My books", exact: true }).click();
  await expect(page.locator(".book-card")).toHaveCount(2);
  // Invalid import must preserve both books.
  fs.writeFileSync("qa/exports/invalid.zip", "invalid");
  await page
    .getByRole("button", { name: "Backup & restore", exact: true })
    .click();
  await page
    .locator(".upload-zone input")
    .setInputFiles("qa/exports/invalid.zip");
  await expect(page.getByRole("alert")).toBeVisible();
  await page.getByRole("button", { name: "My books", exact: true }).click();
  await expect(page.locator(".book-card")).toHaveCount(2);
  await page.getByRole("button", { name: "Dismiss notification" }).click();
  // Changing template retains original paragraph content.
  await page
    .getByRole("button", { name: "Continue writing د رڼا سفر", exact: true })
    .click();
  const before = await page
    .getByRole("textbox", { name: "Book page editor" })
    .innerHTML();
  await page
    .getByRole("button", { name: "Template gallery", exact: true })
    .click();
  await page.getByRole("dialog").locator(".template-art-button").nth(1).click();
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  expect(
    await page.getByRole("textbox", { name: "Book page editor" }).innerHTML(),
  ).toBe(before);
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(page.locator(".preview-item")).toHaveCount(stored.pages.length);
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.screenshot({ path: "qa/07-editor-offline.png", fullPage: true });
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.screenshot({ path: "qa/08-tablet-editor.png", fullPage: true });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "qa/09-mobile-editor.png", fullPage: true });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.getByRole("button", { name: "Toggle outline" }).click();
  await expect(page.locator(".outline-panel")).toBeVisible();
  await page.getByRole("button", { name: "Close outline" }).click();
  await page.getByRole("button", { name: "Toggle page settings" }).click();
  await expect(page.locator(".properties-panel")).toBeVisible();
  await page.getByRole("button", { name: "Close page settings" }).click();
  await page.getByRole("button", { name: "Back to library" }).click();
  await page.screenshot({ path: "qa/10-mobile-dashboard.png", fullPage: true });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await context.setOffline(false);
  const manifest = await (await page.request.get("/manifest.json")).json();
  expect(manifest.display).toBe("standalone");
  expect(manifest.icons).toHaveLength(3);
  expect(errors).toEqual([]);
});

test("Automatic forward text flow preserves every character and formatting", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Application language").selectOption("en");
  await page
    .getByRole("button", { name: "New book", exact: true })
    .first()
    .click();
  await page.getByLabel("title", { exact: true }).fill("Flow integrity");
  for (let i = 0; i < 5; i++)
    await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByRole("button", { name: "Create book", exact: true })
    .last()
    .click();
  const text = (ps + " A mixed-language paragraph. ").repeat(70);
  await page.getByRole("textbox", { name: "Book page editor" }).fill(text);
  await page.waitForTimeout(2500);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const result = await page.evaluate(
    async () =>
      new Promise<any>((resolve) => {
        const r = indexedDB.open("kitab-studio-v1");
        r.onsuccess = () => {
          const q = r.result.transaction("books").objectStore("books").getAll();
          q.onsuccess = () => resolve(q.result[0]);
        };
      }),
  );
  const combined = await page.evaluate(
    (pages: any[]) =>
      pages
        .map((p: any) => {
          const d = document.createElement("div");
          d.innerHTML = p.html;
          return d.textContent;
        })
        .join(""),
    result.pages,
  );
  expect(combined).toBe(text);
  expect(result.pages.length).toBeGreaterThan(2);
});

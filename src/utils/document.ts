import DOMPurify from "dompurify";
import type { Book, Layout, Page } from "../types";
export const clean = (html: string) =>
  DOMPurify.sanitize(html, {
    ADD_ATTR: ["dir", "data-type", "data-text-align"],
    FORBID_TAGS: [
      "script",
      "iframe",
      "object",
      "embed",
      "form",
      "input",
      "video",
      "audio",
    ],
    FORBID_ATTR: ["srcset"],
    ALLOW_DATA_ATTR: true,
  });
export function safeImage(src: string) {
  return /^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=\s]+$/i.test(src);
}
export function normalizeHTML(html: string) {
  const d = document.createElement("div");
  d.innerHTML = clean(html);
  d.querySelectorAll("img").forEach((x) => {
    if (!safeImage(x.src)) x.remove();
  });
  d.querySelectorAll("[style]").forEach((x) => {
    if (/url\s*\(|expression\s*\(/i.test(x.getAttribute("style") || ""))
      x.removeAttribute("style");
  });
  d.querySelectorAll("a").forEach((a) => a.removeAttribute("href"));
  return d.innerHTML;
}
export function plain(html: string) {
  const d = document.createElement("div");
  d.innerHTML = clean(html);
  return d.textContent || "";
}
export const escapeHTML = (x: string) =>
  x.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function effective(book: Book, page: Page): Layout {
  return { ...book.layout, ...page.layout };
}
export function layoutCSS(l: Layout, index = 0) {
  const insideLeft = l.direction === "ltr" ? index % 2 === 0 : index % 2 !== 0;
  const left = insideLeft ? l.inside + l.gutter : l.outside;
  const right = insideLeft ? l.outside : l.inside + l.gutter;
  return {
    width: `${l.width}mm`,
    minHeight: `${l.height}mm`,
    padding: `${l.top}mm ${right}mm ${l.bottom}mm ${left}mm`,
    fontFamily: l.font,
    fontSize: `${l.size}pt`,
    lineHeight: l.line,
    color: l.color,
    background: l.background,
    direction: l.direction,
    textAlign: l.align,
    "--paragraph-space": `${l.spacing}pt`,
    "--indent": `${l.indent}mm`,
    letterSpacing: `${l.tracking}px`,
  } as React.CSSProperties;
}
export function pageNumber(book: Book, index: number) {
  const p = book.pages[index],
    l = effective(book, p);
  if (l.numbering === "none") return "";
  const matter = book.chapters.find((c) => c.id === p.chapterId)?.matter;
  const start =
    matter === "main"
      ? book.pages.findIndex(
          (p) =>
            book.chapters.find((c) => c.id === p.chapterId)?.matter === "main",
        )
      : 0;
  const n = index - start + 1;
  if (l.numbering !== "roman") return String(n);
  let v = n,
    s = "";
  for (const [k, t] of [
    [1000, "m"],
    [900, "cm"],
    [500, "d"],
    [400, "cd"],
    [100, "c"],
    [90, "xc"],
    [50, "l"],
    [40, "xl"],
    [10, "x"],
    [9, "ix"],
    [5, "v"],
    [4, "iv"],
    [1, "i"],
  ] as const) {
    while (v >= k) {
      s += t;
      v -= k;
    }
  }
  return s;
}
export function readImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
      file.size > 8 * 1024 * 1024
    )
      return reject(
        Error("Choose a PNG, JPEG, or WebP image smaller than 8 MB."),
      );
    const r = new FileReader();
    r.onerror = () => reject(Error("The image could not be read."));
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        if (img.width > 12000 || img.height > 12000)
          return reject(Error("Image dimensions exceed 12,000 pixels."));
        resolve(String(r.result));
      };
      img.onerror = () => reject(Error("Invalid image file."));
      img.src = String(r.result);
    };
    r.readAsDataURL(file);
  });
}
export const download = (data: Blob, name: string) => {
  const a = document.createElement("a"),
    url = URL.createObjectURL(data);
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
};
export function validLayout(l: unknown) {
  if (!l || typeof l !== "object") return false;
  const x = l as Layout;
  return (
    [
      "width",
      "height",
      "top",
      "bottom",
      "inside",
      "outside",
      "gutter",
      "size",
      "line",
      "spacing",
      "indent",
      "tracking",
    ].every((k) =>
      Number.isFinite((x as unknown as Record<string, number>)[k]),
    ) &&
    x.width >= 60 &&
    x.width <= 420 &&
    x.height >= 60 &&
    x.height <= 594 &&
    x.top >= 5 &&
    x.bottom >= 5 &&
    x.inside >= 5 &&
    x.outside >= 5 &&
    x.top + x.bottom < x.height - 20 &&
    x.inside + x.outside + x.gutter < x.width - 20 &&
    x.size >= 6 &&
    x.size <= 72 &&
    x.line >= 1 &&
    x.line <= 4 &&
    x.gutter >= 0 &&
    x.spacing >= 0 &&
    x.indent >= 0 &&
    ["right", "left", "center", "justify"].includes(x.align) &&
    ["rtl", "ltr"].includes(x.direction) &&
    ["arabic", "roman", "none"].includes(x.numbering) &&
    ["Noto Naskh Arabic", "Noto Sans Arabic", "Georgia", "Arial"].includes(
      x.font,
    ) &&
    /^#[a-f0-9]{6}$/i.test(x.background) &&
    /^#[a-f0-9]{6}$/i.test(x.color) &&
    typeof x.header === "string" &&
    typeof x.footer === "string"
  );
}

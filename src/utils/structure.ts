import type { Book, Page } from "../types";
import { uid } from "../types";
import { escapeHTML, pageNumber } from "./document";
/** Deterministic layout normalization. Manuscript blocks are never replaced. */
export function refreshStructure(input: Book): Book {
  const book = {
    ...input,
    pages: input.pages.filter((p) => !p.autoBlank).map((p) => ({ ...p })),
  };
  const pages: Page[] = [],
    seen = new Set<string>();
  for (const p of book.pages) {
    const chapter = book.chapters.find((c) => c.id === p.chapterId);
    if (chapter && !seen.has(chapter.id)) {
      seen.add(chapter.id);
      if (
        chapter.start !== "next" &&
        (pages.length + 1) % 2 !== (chapter.start === "odd" ? 1 : 0)
      ) {
        pages.push({
          id: `blank-${chapter.id}`,
          chapterId: pages.at(-1)?.chapterId || chapter.id,
          html: "<p></p>",
          layout: { numbering: "none" },
          autoBlank: true,
        });
      }
    }
    pages.push(p);
  }
  book.pages = pages;
  for (const toc of pages.filter((p) => p.toc)) {
    const chapter = book.chapters.find((c) => c.id === toc.chapterId);
    const entries: string[] = [];
    for (const c of book.chapters.filter((c) => c.matter === "main")) {
      const idx = pages.findIndex((p) => p.chapterId === c.id && !p.autoBlank);
      if (idx < 0) continue;
      entries.push(
        `<p><strong>${escapeHTML(c.title)}</strong> … ${pageNumber(book, idx)}</p>`,
      );
      for (const p of pages.filter((p) => p.chapterId === c.id)) {
        const div = document.createElement("div");
        div.innerHTML = p.html;
        for (const h of Array.from(div.querySelectorAll("h2,h3"))) {
          entries.push(
            `<p style="margin-inline-start:1em">${escapeHTML(h.textContent || "")} … ${pageNumber(book, pages.indexOf(p))}</p>`,
          );
        }
      }
    }
    toc.html =
      `<h1>${escapeHTML(chapter?.title || "Contents")}</h1>` + entries.join("");
  }
  return book;
}

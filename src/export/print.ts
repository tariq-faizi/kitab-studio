import type { Book, CoverSide } from "../types";
import {
  effective,
  escapeHTML,
  normalizeHTML,
  pageNumber,
  download,
} from "../utils/document";
async function encodedFont(url: string) {
  const b = await (await fetch(url)).blob();
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(b);
  });
}
export function coverHTML(s: CoverSide) {
  return `<div class="cover" style="background:${s.gradient ? `linear-gradient(145deg,${s.background},${s.gradient})` : s.background}">${s.elements.map((e) => `<div style="position:absolute;left:${e.x}%;top:${e.y}%;width:${e.width}%;height:${e.height}%;font-family:'${e.font}';font-size:${e.size}pt;color:${e.color};text-align:${e.align};${e.kind === "shape" ? `background:${e.color};border-radius:50%;` : ""}">${e.kind === "image" ? `<img alt="Cover image" src="${e.text}" style="width:100%;height:100%;object-fit:contain"/>` : e.kind === "barcode" ? '<div style="height:60%;background:repeating-linear-gradient(90deg,#111 0 2px,#fff 2px 4px,#111 4px 5px,#fff 5px 8px)"></div><small style="background:white;color:black">BARCODE PLACEHOLDER</small>' : escapeHTML(e.text)}</div>`).join("")}</div>`;
}
export async function printHTML(book: Book) {
  let fonts = "";
  for (const font of ["noto-naskh-arabic", "noto-sans-arabic"])
    for (const weight of [400, 700])
      for (const subset of ["arabic", "latin"]) {
        const data = await encodedFont(
          `/fonts/${font}-${subset}-${weight}-normal.woff2`,
        );
        fonts += `@font-face{font-family:'${font === "noto-naskh-arabic" ? "Noto Naskh Arabic" : "Noto Sans Arabic"}';font-weight:${weight};src:url('${data}') format('woff2');${subset === "arabic" ? "unicode-range:U+0600-06FF,U+0750-077F,U+0870-089F,U+08A0-08FF,U+200C-200E,U+2010-2011,U+204F,U+2E41,U+FB50-FDFF,U+FE70-FEFF;" : "unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD;"}}`;
      }
  const sections = book.pages
    .map((p, i) => {
      const l = effective(book, p);
      const insideLeft = l.direction === "ltr" ? i % 2 === 0 : i % 2 !== 0;
      const left = insideLeft ? l.inside + l.gutter : l.outside,
        right = insideLeft ? l.outside : l.inside + l.gutter;
      return `<section class="page" style="padding:${l.top}mm ${right}mm ${l.bottom}mm ${left}mm;background:${l.background};color:${l.color};direction:${l.direction};text-align:${l.align};font-family:'${l.font}';font-size:${l.size}pt;line-height:${l.line};--space:${l.spacing}pt;--indent:${l.indent}mm;letter-spacing:${l.tracking}px"><header>${escapeHTML(l.header || book.title)}</header><article>${normalizeHTML(p.html)}</article><footer><span>${escapeHTML(l.footer)}</span><b>${pageNumber(book, i)}</b></footer></section>`;
    })
    .join("");
  return `<!doctype html><html lang="${book.language}" dir="${book.language === "en" ? "ltr" : "rtl"}"><head><meta charset="utf-8"><title>${escapeHTML(book.title)}</title><style>${fonts}*{box-sizing:border-box}body{margin:0;background:#ddd} .page,.cover{position:relative;width:${book.layout.width}mm;min-height:${book.layout.height}mm;margin:10mm auto;break-after:page;background:white;overflow:visible}.cover{height:${book.layout.height}mm}header,footer{position:absolute;font:10pt 'Noto Naskh Arabic';left:15mm;right:15mm}header{top:7mm;opacity:.6}footer{bottom:7mm;display:flex;justify-content:space-between}article p{margin:0 0 var(--space);text-indent:var(--indent);white-space:pre-wrap;overflow-wrap:anywhere}article h1,article h2,article h3{margin:0 0 1em;line-height:1.4}blockquote{border-inline-start:2px solid;margin:1em 0;padding-inline-start:1em}img{max-width:100%;height:auto}table{width:100%;border-collapse:collapse;table-layout:fixed}td,th{border:1px solid #aaa;padding:5px;overflow-wrap:anywhere}tr{break-inside:avoid}.print-tools{padding:20px;text-align:center;background:#173f35;color:white;font:16px sans-serif}.print-tools button{padding:10px 20px;cursor:pointer}@page{size:${book.layout.width}mm ${book.layout.height}mm;margin:0}@media print{body{background:white}.page,.cover{margin:0;box-shadow:none;print-color-adjust:exact;-webkit-print-color-adjust:exact}.print-tools{display:none}}</style></head><body><div class="print-tools">Print-ready edition · Verify font shaping, page fit, and printer specifications. <button onclick="window.print()">Print / Save as PDF</button></div>${coverHTML(book.cover.front)}${sections}${coverHTML(book.cover.back)}</body></html>`;
}
export async function openPrint(book: Book, htmlOnly = false) {
  const win = htmlOnly ? null : window.open("about:blank", "_blank");
  try {
    const html = await printHTML(book);
    if (htmlOnly) {
      download(
        new Blob([html], { type: "text/html" }),
        `${book.title}.print.html`,
      );
      return;
    }
    if (!win)
      throw Error(
        "Popup blocked. Allow popups or download the print-ready HTML instead.",
      );
    win.document.open();
    win.document.write(html);
    win.document.close();
    await win.document.fonts.ready;
    win.focus();
  } catch (e) {
    win?.close();
    throw e;
  }
}

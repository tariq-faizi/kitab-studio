import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  ImageRun,
  Table,
  TableRow,
  TableCell,
  Header,
  Footer,
  PageNumber,
  AlignmentType,
  HeadingLevel,
  NumberFormat,
  LevelFormat,
  BorderStyle,
  type IRunOptions,
  type FileChild,
} from "docx";
import type { Book, Layout } from "../types";
import {
  effective,
  normalizeHTML,
  download,
  safeImage,
} from "../utils/document";
const tw = (mm: number) => Math.round(mm * 56.6929);
function runs(
  node: Node,
  l: Layout,
  style: IRunOptions = {},
): Array<TextRun | ImageRun> {
  if (node.nodeType === 3)
    return [
      new TextRun({
        text: node.textContent || "",
        font: l.font,
        size: l.size * 2,
        rightToLeft: l.direction === "rtl",
        ...style,
      }),
    ];
  if (!(node instanceof HTMLElement)) return [];
  const s = { ...style };
  if (["B", "STRONG"].includes(node.tagName)) s.bold = true;
  if (["I", "EM"].includes(node.tagName)) s.italics = true;
  if (node.tagName === "U") s.underline = {};
  if (node.tagName === "S") s.strike = true;
  if (node.tagName === "SUP") s.superScript = true;
  if (node.style.color) {
    const c = document.createElement("canvas").getContext("2d")!;
    c.fillStyle = node.style.color;
    s.color = c.fillStyle.replace("#", "");
  }
  if (node.style.fontSize) s.size = parseFloat(node.style.fontSize) * 2;
  if (node.style.fontFamily) s.font = node.style.fontFamily.replaceAll('"', "");
  if (node.tagName === "MARK") s.highlight = "yellow";
  if (node.tagName === "BR") return [new TextRun({ break: 1 })];
  if (node.tagName === "IMG" && safeImage((node as HTMLImageElement).src)) {
    const src = (node as HTMLImageElement).src,
      type = src.startsWith("data:image/jpeg") ? "jpg" : "png";
    const bytes = Uint8Array.from(atob(src.split(",")[1]), (c) =>
      c.charCodeAt(0),
    );
    const im = node as HTMLImageElement;
    const w = Math.min(
      im.width || 300,
      (l.width - l.inside - l.outside - l.gutter) * 3.78,
    );
    return [
      new ImageRun({
        data: bytes,
        type,
        transformation: {
          width: w,
          height: (w * (im.height || 200)) / (im.width || 300),
        },
      }),
    ];
  }
  return Array.from(node.childNodes).flatMap((n) => runs(n, l, s));
}
function paragraphs(container: HTMLElement, l: Layout): FileChild[] {
  const output: FileChild[] = [];
  for (const el of Array.from(container.children) as HTMLElement[]) {
    if (el.tagName === "TABLE") {
      const rows = Array.from(el.querySelectorAll("tr")).map(
        (row) =>
          new TableRow({
            children: Array.from(row.children).map(
              (cell) =>
                new TableCell({
                  children: [
                    new Paragraph({
                      children: runs(cell, l),
                      bidirectional: l.direction === "rtl",
                    }),
                  ],
                }),
            ),
          }),
      );
      if (rows.length)
        output.push(
          new Table({
            rows,
            width: { size: 100, type: "pct" },
            visuallyRightToLeft: l.direction === "rtl",
          }),
        );
      continue;
    }
    if (["UL", "OL"].includes(el.tagName)) {
      Array.from(el.children).forEach((li) =>
        output.push(
          new Paragraph({
            children: runs(li, l),
            bidirectional: l.direction === "rtl",
            numbering: {
              reference: el.tagName === "UL" ? "bullets" : "numbers",
              level: 0,
            },
            spacing: { after: l.spacing * 20, line: Math.round(l.line * 240) },
          }),
        ),
      );
      continue;
    }
    const align = (el.style.textAlign || l.align) as keyof typeof AlignmentType;
    const heading =
      el.tagName === "H1"
        ? HeadingLevel.HEADING_1
        : el.tagName === "H2"
          ? HeadingLevel.HEADING_2
          : el.tagName === "H3"
            ? HeadingLevel.HEADING_3
            : undefined;
    output.push(
      new Paragraph({
        children:
          el.tagName === "HR" ? [new TextRun("────────────")] : runs(el, l),
        heading,
        bidirectional: el.dir ? el.dir === "rtl" : l.direction === "rtl",
        alignment:
          (
            {
              right: AlignmentType.RIGHT,
              left: AlignmentType.LEFT,
              center: AlignmentType.CENTER,
              justify: AlignmentType.JUSTIFIED,
            } as Record<
              string,
              (typeof AlignmentType)[keyof typeof AlignmentType]
            >
          )[align] || AlignmentType.RIGHT,
        spacing: { after: l.spacing * 20, line: Math.round(l.line * 240) },
        indent: { firstLine: tw(l.indent) },
        border:
          el.tagName === "BLOCKQUOTE"
            ? {
                bottom: {
                  color: l.color.replace("#", ""),
                  style: BorderStyle.SINGLE,
                  size: 4,
                },
              }
            : undefined,
      }),
    );
  }
  if (!output.length) output.push(new Paragraph(""));
  return output;
}
export async function exportDocx(book: Book) {
  book = structuredClone(book);
  for (const p of book.pages) {
    const d = document.createElement("div");
    d.innerHTML = normalizeHTML(p.html);
    for (const img of Array.from(d.querySelectorAll("img"))) {
      if (img.src.startsWith("data:image/webp")) {
        const im = new window.Image();
        im.src = img.src;
        await im.decode();
        const canvas = document.createElement("canvas");
        canvas.width = im.naturalWidth;
        canvas.height = im.naturalHeight;
        canvas.getContext("2d")!.drawImage(im, 0, 0);
        img.src = canvas.toDataURL("image/png");
      }
    }
    p.html = d.innerHTML;
  }
  const section = (
    content: FileChild[],
    l: Layout,
    i: number,
    numbered = true,
  ) => ({
    properties: {
      page: {
        size: { width: tw(l.width), height: tw(l.height) },
        margin: {
          top: tw(l.top),
          bottom: tw(l.bottom),
          left: tw(
            (l.direction === "ltr" ? i % 2 === 0 : i % 2 !== 0)
              ? l.inside + l.gutter
              : l.outside,
          ),
          right: tw(
            (l.direction === "ltr" ? i % 2 === 0 : i % 2 !== 0)
              ? l.outside
              : l.inside + l.gutter,
          ),
        },
        pageNumbers: {
          ...(i === 0 ||
          i ===
            book.pages.findIndex(
              (p) =>
                book.chapters.find((c) => c.id === p.chapterId)?.matter ===
                "main",
            )
            ? { start: 1 }
            : {}),
          formatType:
            l.numbering === "roman"
              ? NumberFormat.LOWER_ROMAN
              : NumberFormat.DECIMAL,
        },
      },
    },
    headers: {
      default: new Header({
        children: [
          new Paragraph({
            text: l.header || book.title,
            bidirectional: l.direction === "rtl",
            alignment: AlignmentType.CENTER,
          }),
        ],
      }),
    },
    footers: {
      default: new Footer({
        children: [
          new Paragraph({
            children: [
              new TextRun(l.footer + " "),
              ...(numbered && l.numbering !== "none"
                ? [new TextRun({ children: [PageNumber.CURRENT] })]
                : []),
            ],
            alignment: AlignmentType.CENTER,
            bidirectional: l.direction === "rtl",
          }),
        ],
      }),
    },
    children: content,
  });
  const cover = (side: Book["cover"]["front"]) =>
    side.elements
      .filter((e) => e.kind === "text")
      .map(
        (e) =>
          new Paragraph({
            children: [
              new TextRun({
                text: e.text,
                font: e.font,
                size: e.size * 2,
                color: side.background.replace("#", ""),
              }),
            ],
            alignment: AlignmentType.CENTER,
            bidirectional: book.language !== "en",
            spacing: { before: e.y * 35, after: 240 },
          }),
      );
  const sections = [
    section(cover(book.cover.front), book.layout, 0, false),
    ...book.pages.map((p, i) => {
      const d = document.createElement("div");
      d.innerHTML = normalizeHTML(p.html);
      return section(paragraphs(d, effective(book, p)), effective(book, p), i);
    }),
    section(cover(book.cover.back), book.layout, 0, false),
  ];
  const doc = new Document({
    creator: book.author,
    title: book.title,
    description: book.description,
    styles: {
      default: {
        document: {
          run: { font: book.layout.font, size: book.layout.size * 2 },
        },
      },
    },
    numbering: {
      config: [
        {
          reference: "numbers",
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: "%1.",
              alignment: AlignmentType.START,
            },
          ],
        },
        {
          reference: "bullets",
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: "•",
              alignment: AlignmentType.START,
            },
          ],
        },
      ],
    },
    sections,
  });
  download(await Packer.toBlob(doc), `${book.title}.docx`);
}

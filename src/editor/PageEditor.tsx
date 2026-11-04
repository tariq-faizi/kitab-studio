import { useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import {
  TextStyle,
  Color,
  FontFamily,
  FontSize,
} from "@tiptap/extension-text-style";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import {
  Table,
  TableRow,
  TableCell,
  TableHeader,
} from "@tiptap/extension-table";
import { Extension } from "@tiptap/core";
import { DOMSerializer } from "@tiptap/pm/model";
import {
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Highlighter,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import type { Book, Page } from "../types";
import {
  effective,
  layoutCSS,
  pageNumber,
  readImage,
  normalizeHTML,
} from "../utils/document";
import { tr } from "../localization";
import type { Lang } from "../types";
const Direction = Extension.create({
  name: "direction",
  addGlobalAttributes() {
    return [
      {
        types: ["paragraph", "heading", "blockquote"],
        attributes: {
          dir: {
            default: null,
            parseHTML: (e) => e.getAttribute("dir"),
            renderHTML: (a) => (a.dir ? { dir: a.dir } : {}),
          },
        },
      },
    ];
  },
});
export function PageEditor({
  book,
  page,
  index,
  lang,
  onChange,
  onFlow,
  onBreak,
  onSelection,
  onError,
  zoom,
}: {
  book: Book;
  page: Page;
  index: number;
  lang: Lang;
  onChange: (html: string) => void;
  onFlow: (htmls: string[]) => void;
  onBreak: (before: string, after: string) => void;
  onSelection: (text: string) => void;
  onError: (e: unknown) => void;
  zoom: number;
}) {
  const t = tr(lang),
    l = effective(book, page),
    host = useRef<HTMLDivElement>(null),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const changing = useRef(false);
  const callbacks = useRef({ onChange, onFlow, onSelection });
  callbacks.current = { onChange, onFlow, onSelection };
  const editor = useEditor(
    {
      extensions: [
        StarterKit,
        TextAlign.configure({ types: ["heading", "paragraph"] }),
        TextStyle,
        Color,
        FontFamily,
        FontSize,
        Highlight.configure({ multicolor: true }),
        Image.configure({ allowBase64: true }),
        Table.configure({ resizable: false }),
        TableRow,
        TableHeader,
        TableCell,
        Direction,
      ],
      content: page.html,
      editorProps: {
        attributes: {
          "aria-label": "Book page editor",
          spellcheck: "true",
          dir: l.direction,
        },
        handlePaste: (_view, event) => {
          const data = event.clipboardData?.getData("text/html");
          if (!data) return false;
          event.preventDefault();
          editor?.commands.insertContent(normalizeHTML(data));
          return true;
        },
      },
      onUpdate: ({ editor }) => {
        if (changing.current) return;
        callbacks.current.onChange(editor.getHTML());
        clearTimeout(timer.current);
        timer.current = setTimeout(() => flow(editor.getHTML()), 750);
      },
      onSelectionUpdate: ({ editor }) => {
        const { from, to } = editor.state.selection;
        callbacks.current.onSelection(
          editor.state.doc.textBetween(from, to, "\n"),
        );
      },
    },
    [page.id],
  );
  useEffect(() => () => clearTimeout(timer.current), [page.id]);
  useEffect(() => {
    if (editor && editor.getHTML() !== page.html) {
      changing.current = true;
      const pos = editor.state.selection.from;
      editor.commands.setContent(page.html, { emitUpdate: false });
      editor.commands.setTextSelection(
        Math.min(pos, editor.state.doc.content.size),
      );
      changing.current = false;
    }
  }, [editor, page.html]);
  useEffect(() => {
    editor?.setOptions({
      editorProps: {
        attributes: {
          "aria-label": "Book page editor",
          dir: l.direction,
          spellcheck: "true",
        },
      },
    });
  }, [editor, l.direction]);
  function flow(html: string) {
    const root = host.current;
    if (!root || !editor || editor.isDestroyed) return;
    const measure = document.createElement("div");
    const content = root.querySelector(".tiptap");
    if (!content) return;
    measure.className = "tiptap measure";
    const computed = getComputedStyle(content);
    measure.style.cssText = `position:fixed;left:-20000px;top:0;visibility:hidden;width:${content.getBoundingClientRect().width / (zoom / 100)}px;font-family:${l.font};font-size:${l.size}pt;line-height:${l.line};direction:${l.direction};text-align:${l.align};--paragraph-space:${l.spacing}pt;--indent:${l.indent}mm;letter-spacing:${l.tracking}px;`;
    measure.style.boxSizing = computed.boxSizing;
    document.body.append(measure);
    const max = ((l.height - l.top - l.bottom) * 96) / 25.4;
    const source = document.createElement("div");
    source.innerHTML = html;
    const queue = Array.from(source.childNodes);
    const pages: string[] = [];
    let safety = 0;
    while (queue.length && safety++ < 5000) {
      const n = queue.shift()!;
      measure.append(n.cloneNode(true));
      if (measure.scrollHeight <= max + 1) continue;
      measure.lastChild?.remove();
      if (measure.innerHTML.trim()) {
        pages.push(measure.innerHTML);
        measure.innerHTML = "";
        queue.unshift(n);
        continue;
      }
      // Split oversized textual blocks with DOM ranges to preserve inline formatting.
      if (
        n instanceof HTMLElement &&
        ["P", "H1", "H2", "H3", "BLOCKQUOTE"].includes(n.tagName) &&
        (n.textContent?.length || 0) > 1
      ) {
        let low = 1,
          high = n.textContent!.length - 1,
          best = 0;
        const at = (count: number) => {
          const walker = document.createTreeWalker(n, NodeFilter.SHOW_TEXT);
          let node = walker.nextNode(),
            remaining = count;
          while (node && remaining > (node.textContent?.length || 0)) {
            remaining -= node.textContent?.length || 0;
            node = walker.nextNode();
          }
          return { node, offset: remaining };
        };
        while (low <= high) {
          const mid = Math.floor((low + high) / 2),
            point = at(mid);
          if (!point.node) break;
          const r = document.createRange();
          r.setStart(n, 0);
          r.setEnd(point.node, point.offset);
          const test = n.cloneNode(false) as HTMLElement;
          test.append(r.cloneContents());
          measure.replaceChildren(test);
          if (measure.scrollHeight <= max) {
            best = mid;
            low = mid + 1;
          } else high = mid - 1;
        }
        if (best > 0) {
          const text = n.textContent!,
            space = text.lastIndexOf(" ", best);
          if (space > best * 0.65) best = space + 1;
          const point = at(best),
            a = document.createRange(),
            b = document.createRange();
          a.setStart(n, 0);
          a.setEnd(point.node!, point.offset);
          b.setStart(point.node!, point.offset);
          b.setEnd(n, n.childNodes.length);
          const left = n.cloneNode(false) as HTMLElement,
            right = n.cloneNode(false) as HTMLElement;
          left.append(a.cloneContents());
          right.append(b.cloneContents());
          pages.push(left.outerHTML);
          measure.innerHTML = "";
          queue.unshift(right);
          continue;
        }
      }
      // Large images are scaled to fit; tables remain visible and are flagged for manual layout.
      measure.replaceChildren(n.cloneNode(true));
      const img = measure.querySelector("img");
      if (img) {
        img.style.maxHeight = `${max - 2}px`;
        img.style.objectFit = "contain";
      }
      if (measure.scrollHeight > max + 2)
        onError(
          Error(
            "This table or block is taller than a page. Split it manually or reduce font size. Content is preserved, not clipped.",
          ),
        );
      pages.push(measure.innerHTML);
      measure.innerHTML = "";
    }
    if (measure.innerHTML.trim()) pages.push(measure.innerHTML);
    measure.remove();
    if (pages.length > 1) callbacks.current.onFlow(pages);
  }
  useEffect(() => {
    const id = setTimeout(() => {
      if (editor) flow(editor.getHTML());
    }, 600);
    return () => clearTimeout(id);
  }, [
    l.width,
    l.height,
    l.size,
    l.line,
    l.top,
    l.bottom,
    l.inside,
    l.outside,
    l.gutter,
    l.font,
  ]);
  if (!editor) return null;
  const command = (run: () => unknown) => {
    run();
    editor.commands.focus();
  };
  const insert = (kind: string) => {
    const content: Record<string, string> = {
      paragraph: "<p></p>",
      section: "<h2>Section heading</h2>",
      poetry: '<p style="text-align:center">Poetry stanza<br>Second line</p>',
      quote: "<blockquote><p>Quotation</p></blockquote>",
      caption: "<p><em>Caption</em></p>",
      footnote: "<p><sup>1</sup> Footnote — </p>",
      bibliography: "<h2>References</h2><p>Author. Title. Publisher, Year.</p>",
      divider: "<hr>",
    };
    if (kind === "table")
      editor
        .chain()
        .focus()
        .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
        .run();
    else if (kind === "break") {
      const from = editor.state.selection.from,
        doc = editor.state.doc;
      const serialize = (start: number, end: number) => {
        const host = document.createElement("div");
        host.append(
          DOMSerializer.fromSchema(editor.schema).serializeFragment(
            doc.cut(start, end).content,
          ),
        );
        return host.innerHTML || "<p></p>";
      };
      onBreak(serialize(0, from), serialize(from, doc.content.size));
    } else
      editor
        .chain()
        .focus()
        .insertContent(content[kind] || "<p></p>")
        .run();
  };
  const moveBlock = (delta: number) => {
    const { $from } = editor.state.selection;
    if ($from.depth < 1) return;
    const pos = $from.before(1),
      node = $from.node(1),
      siblings = editor.state.doc;
    let idx = $from.index(0);
    if (idx + delta < 0 || idx + delta >= siblings.childCount) return;
    const blocks = [];
    for (let i = 0; i < siblings.childCount; i++)
      blocks.push(siblings.child(i).toJSON());
    [blocks[idx], blocks[idx + delta]] = [blocks[idx + delta], blocks[idx]];
    editor.commands.setContent({ type: "doc", content: blocks });
    editor.commands.focus();
    void pos;
    void node;
  };
  return (
    <>
      <div
        className="format-toolbar"
        role="toolbar"
        aria-label="Text formatting"
      >
        <select
          aria-label="Block type"
          value={
            editor.isActive("heading", { level: 1 })
              ? "h1"
              : editor.isActive("heading", { level: 2 })
                ? "h2"
                : "p"
          }
          onChange={(e) =>
            command(() =>
              e.target.value === "p"
                ? editor.chain().focus().setParagraph().run()
                : editor
                    .chain()
                    .focus()
                    .toggleHeading({ level: e.target.value === "h1" ? 1 : 2 })
                    .run(),
            )
          }
        >
          <option value="p">{t("paragraph")}</option>
          <option value="h1">Heading 1</option>
          <option value="h2">Heading 2</option>
        </select>
        <span className="toolbar-divider" />
        {[
          [
            Bold,
            "Bold",
            () => editor.chain().focus().toggleBold().run(),
            "bold",
          ],
          [
            Italic,
            "Italic",
            () => editor.chain().focus().toggleItalic().run(),
            "italic",
          ],
          [
            Underline,
            "Underline",
            () => editor.chain().focus().toggleUnderline().run(),
            "underline",
          ],
          [
            Highlighter,
            "Highlight",
            () => editor.chain().focus().toggleHighlight().run(),
            "highlight",
          ],
        ].map(([Icon, label, fn, key]) => {
          const I = Icon as typeof Bold;
          return (
            <button
              key={String(label)}
              title={String(label)}
              aria-label={String(label)}
              className={`icon-btn ${editor.isActive(String(key)) ? "active" : ""}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={fn as () => void}
            >
              <I size={17} />
            </button>
          );
        })}
        <input
          className="toolbar-color"
          type="color"
          aria-label="Selected text color"
          onChange={(e) =>
            editor.chain().focus().setColor(e.target.value).run()
          }
        />
        <span className="toolbar-divider" />
        {[
          [AlignLeft, "left"],
          [AlignCenter, "center"],
          [AlignRight, "right"],
          [AlignJustify, "justify"],
        ].map(([Icon, key]) => {
          const I = Icon as typeof AlignLeft;
          return (
            <button
              key={String(key)}
              className="icon-btn"
              aria-label={`Align ${key}`}
              title={`Align ${key}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() =>
                editor.chain().focus().setTextAlign(String(key)).run()
              }
            >
              <I size={17} />
            </button>
          );
        })}
        <button
          aria-label="Bulleted list"
          className="icon-btn"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List size={17} />
        </button>
        <button
          aria-label="Numbered list"
          className="icon-btn"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered size={17} />
        </button>
        <button
          aria-label="Block RTL"
          className="mini-btn"
          onClick={() =>
            editor
              .chain()
              .focus()
              .updateAttributes(
                editor.isActive("heading") ? "heading" : "paragraph",
                { dir: "rtl" },
              )
              .run()
          }
        >
          RTL
        </button>
        <button
          aria-label="Block LTR"
          className="mini-btn"
          onClick={() =>
            editor
              .chain()
              .focus()
              .updateAttributes(
                editor.isActive("heading") ? "heading" : "paragraph",
                { dir: "ltr" },
              )
              .run()
          }
        >
          LTR
        </button>
        <button
          aria-label="Move block up"
          className="icon-btn"
          onClick={() => moveBlock(-1)}
        >
          <ArrowUp size={16} />
        </button>
        <button
          aria-label="Move block down"
          className="icon-btn"
          onClick={() => moveBlock(1)}
        >
          <ArrowDown size={16} />
        </button>
        <select
          aria-label="Insert content block"
          value=""
          onChange={(e) => insert(e.target.value)}
        >
          <option value="">+ {t("add")}</option>
          {[
            "paragraph",
            "section",
            "poetry",
            "quote",
            "caption",
            "footnote",
            "bibliography",
            "divider",
            "table",
          ].map((k) => (
            <option key={k} value={k}>
              {t(k as "paragraph")}
            </option>
          ))}
          <option value="break">{t("manualBreak")}</option>
        </select>
        <label className="mini-btn">
          {t("image")}
          <input
            hidden
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={async (e) => {
              try {
                const file = e.target.files?.[0];
                if (file)
                  editor
                    .chain()
                    .focus()
                    .setImage({ src: await readImage(file), alt: file.name })
                    .run();
              } catch (err) {
                onError(err);
              }
              e.target.value = "";
            }}
          />
        </label>
        {editor.isActive("table") && (
          <>
            <button
              className="mini-btn"
              onClick={() => editor.chain().focus().addRowAfter().run()}
            >
              + row
            </button>
            <button
              className="mini-btn"
              onClick={() => editor.chain().focus().addColumnAfter().run()}
            >
              + column
            </button>
            <button
              className="mini-btn"
              onClick={() => editor.chain().focus().deleteRow().run()}
            >
              − row
            </button>
            <button
              className="mini-btn"
              onClick={() => editor.chain().focus().deleteTable().run()}
            >
              − table
            </button>
          </>
        )}
      </div>
      <div className="page-stage">
        <div
          className="paper-wrapper"
          style={{
            width: (((l.width * 96) / 25.4) * zoom) / 100,
            minHeight: (((l.height * 96) / 25.4) * zoom) / 100,
          }}
        >
          <div
            className="book-paper"
            ref={host}
            style={{
              ...layoutCSS(l, index),
              transform: `scale(${zoom / 100})`,
              transformOrigin: "top left",
            }}
          >
            <div className="running-header">{l.header || book.title}</div>
            <EditorContent editor={editor} />
            <div className="running-footer">
              <span>{l.footer}</span>
              <span>{pageNumber(book, index)}</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

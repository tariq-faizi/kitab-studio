import { useState, useEffect, useRef } from "react";
import {
  ArrowLeft,
  Plus,
  Save,
  Undo2,
  Redo2,
  Eye,
  Download,
  PanelLeftClose,
  SlidersHorizontal,
  Settings,
  BookOpen,
  FileText,
  ChevronUp,
  ChevronDown,
  Copy,
  Trash2,
  MoreHorizontal,
  Image,
  History,
  LayoutTemplate,
  ListTree,
} from "lucide-react";
import { PageEditor } from "./PageEditor";
import { AssetLibrary } from "./AssetLibrary";
import { LayoutFields } from "../components/LayoutFields";
import { CoverDesigner } from "../cover-designer/CoverDesigner";
import { Field, Modal } from "../components/ui";
import {
  uid,
  languageNames,
  type Book,
  type Lang,
  type Template,
  type Layout,
  type Matter,
} from "../types";
import { tr } from "../localization";
import {
  effective,
  escapeHTML,
  validLayout,
  readImage,
  pageNumber,
} from "../utils/document";
import { countWords } from "../components/ui";
export function BookEditor({
  book,
  lang,
  templates,
  onChange,
  onSave,
  onClose,
  onExport,
  onPreview,
  onRevisions,
  onTemplate,
  onAI,
  onError,
  saveStatus,
  lastSaved,
}: {
  book: Book;
  lang: Lang;
  templates: Template[];
  onChange: (b: Book) => void;
  onSave: () => Promise<void>;
  onClose: () => Promise<void>;
  onExport: () => void;
  onPreview: () => void;
  onRevisions: () => void;
  onTemplate: () => void;
  onAI: (text: string) => void;
  onError: (e: unknown) => void;
  saveStatus: string;
  lastSaved: number;
}) {
  const t = tr(lang),
    [pageId, setPageId] = useState(book.pages[0].id),
    [zoom, setZoom] = useState(() =>
      innerWidth < 760
        ? Math.max(
            30,
            Math.min(
              80,
              Math.floor(
                ((innerWidth - 32) / ((book.layout.width * 96) / 25.4)) * 100,
              ),
            ),
          )
        : 80,
    ),
    [tab, setTab] = useState<"writing" | "cover">("writing"),
    [left, setLeft] = useState(false),
    [right, setRight] = useState(false),
    [scope, setScope] = useState("page"),
    [selectedText, setSelectedText] = useState(""),
    [chapterEdit, setChapterEdit] = useState(""),
    [addDialog, setAddDialog] = useState(false),
    [addTitle, setAddTitle] = useState(""),
    [addMatter, setAddMatter] = useState<Matter>("main"),
    [pageTools, setPageTools] = useState(false),
    [assetOpen, setAssetOpen] = useState(false),
    [settingsOpen, setSettingsOpen] = useState(false);
  const undo = useRef<Book[]>([]),
    redo = useRef<Book[]>([]),
    lastHistory = useRef(0),
    current = useRef(book);
  current.current = book;
  const page = book.pages.find((p) => p.id === pageId) || book.pages[0],
    index = book.pages.indexOf(page),
    chapter = book.chapters.find((c) => c.id === page.chapterId)!;
  const l = effective(book, page);
  const change = (b: Book, group = false) => {
    if (!group || Date.now() - lastHistory.current > 1200) {
      undo.current.push(structuredClone(current.current));
      if (undo.current.length > 80) undo.current.shift();
      lastHistory.current = Date.now();
    }
    redo.current = [];
    onChange(b);
  };
  useEffect(() => {
    const resize = () => {
      if (innerWidth < 760)
        setZoom(
          Math.max(
            30,
            Math.min(
              80,
              Math.floor(
                ((innerWidth - 32) / ((book.layout.width * 96) / 25.4)) * 100,
              ),
            ),
          ),
        );
    };
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [book.layout.width]);
  const patchHTML = (html: string) =>
    change(
      {
        ...current.current,
        pages: current.current.pages.map((p) =>
          p.id === page.id ? { ...p, html } : p,
        ),
      },
      true,
    );
  const addPage = () => {
    const b = current.current,
      p = {
        id: uid(),
        chapterId: page.chapterId,
        html: "<p></p>",
        layout: { ...page.layout },
      };
    const pages = [...b.pages];
    pages.splice(index + 1, 0, p);
    change({ ...b, pages });
    setPageId(p.id);
  };
  const deletePage = () => {
    if (book.pages.length < 2)
      return onError(Error("A book must contain at least one page."));
    if (
      !confirm(
        "Delete this page and its content? This can be undone in this session.",
      )
    )
      return;
    const pages = book.pages.filter((p) => p.id !== page.id);
    change({ ...book, pages });
    setPageId(pages[Math.max(0, index - 1)].id);
  };
  const duplicatePage = () => {
    const copy = { ...structuredClone(page), id: uid() },
      pages = [...book.pages];
    pages.splice(index + 1, 0, copy);
    change({ ...book, pages });
    setPageId(copy.id);
  };
  const reorder = (delta: number) => {
    const pages = [...book.pages],
      to = index + delta;
    if (to < 0 || to >= pages.length) return;
    [pages[index], pages[to]] = [pages[to], pages[index]];
    change({ ...book, pages });
  };
  const updateLayout = (p: Partial<Layout>) => {
    if ("width" in p || "height" in p) {
      const layout = { ...book.layout, ...p };
      if (!validLayout(layout))
        return onError(
          Error(
            "These dimensions leave too little writing space. Reduce margins first.",
          ),
        );
      return change({ ...book, layout });
    }
    if (!validLayout({ ...l, ...p }))
      return onError(
        Error("Margins must leave at least 20 mm of content area."),
      );
    change({
      ...book,
      ...(scope === "book" ? { layout: { ...book.layout, ...p } } : {}),
      pages: book.pages.map((pg) =>
        scope === "book"
          ? { ...pg, layout: { ...pg.layout, ...p } }
          : pg.id === page.id ||
              (scope === "chapter" && pg.chapterId === chapter.id)
            ? { ...pg, layout: { ...pg.layout, ...p } }
            : pg,
      ),
    });
  };
  const addChapter = () => {
    if (!addTitle.trim()) return;
    const id = uid(),
      p = {
        id: uid(),
        chapterId: id,
        html: `<h1>${escapeHTML(addTitle)}</h1><p></p>`,
        layout: addMatter === "front" ? { numbering: "roman" as const } : {},
      };
    change({
      ...book,
      chapters: [
        ...book.chapters,
        { id, title: addTitle, matter: addMatter, start: "next" },
      ],
      pages: [...book.pages, p],
    });
    setPageId(p.id);
    setAddDialog(false);
    setAddTitle("");
  };
  const toc = () => {
    const html =
      `<h1>${t("contents")}</h1>` +
      book.chapters
        .filter((c) => c.matter === "main")
        .map((c) => {
          const i = book.pages.findIndex((p) => p.chapterId === c.id);
          return `<p>${escapeHTML(c.title)} … ${pageNumber(book, Math.max(0, i))}</p>`;
        })
        .join("");
    const existing = book.chapters.find((c) => c.title === t("contents"));
    if (existing) {
      change({
        ...book,
        pages: book.pages.map((p) =>
          p.chapterId === existing.id ? { ...p, html } : p,
        ),
      });
      return;
    }
    const id = uid(),
      p = {
        id: uid(),
        chapterId: id,
        html,
        layout: { numbering: "roman" as const },
        toc: true,
      };
    change({
      ...book,
      chapters: [
        { id, title: t("contents"), matter: "front", start: "next" },
        ...book.chapters,
      ],
      pages: [p, ...book.pages],
    });
    setPageId(p.id);
  };
  function doUndo() {
    const b = undo.current.pop();
    if (b) {
      redo.current.push(structuredClone(current.current));
      onChange(b);
    }
  }
  function doRedo() {
    const b = redo.current.pop();
    if (b) {
      undo.current.push(structuredClone(current.current));
      onChange(b);
    }
  }
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void onSave().catch(onError);
      }
      if ((e.metaKey || e.ctrlKey) && e.altKey && e.key === "z") {
        e.preventDefault();
        doUndo();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  const editChapter = book.chapters.find((c) => c.id === chapterEdit);
  return (
    <div className="editor-shell">
      <header className="editor-header">
        <button
          className="icon-btn"
          aria-label={t("closeBook")}
          onClick={() => void onClose()}
        >
          <ArrowLeft size={20} />
        </button>
        <div className="editor-book-title">
          <strong dir="auto">{book.title}</strong>
          <small>
            {saveStatus === "saved"
              ? `${t("status")} · ${new Date(lastSaved).toLocaleTimeString()}`
              : saveStatus === "saving"
                ? t("saving")
                : t("saveError")}
          </small>
        </div>
        <div className="editor-actions">
          <button
            className="icon-btn"
            aria-label="Book settings"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings size={17} />
          </button>
          <button
            className="icon-btn"
            aria-label="Undo book change"
            disabled={!undo.current.length}
            onClick={doUndo}
          >
            <Undo2 size={18} />
          </button>
          <button
            className="icon-btn"
            aria-label="Redo book change"
            disabled={!redo.current.length}
            onClick={doRedo}
          >
            <Redo2 size={18} />
          </button>
          <button
            className="btn subtle"
            onClick={() => void onSave().catch(onError)}
          >
            <Save size={16} />
            <span>{t("save")}</span>
          </button>
          <button className="btn subtle" onClick={onPreview}>
            <Eye size={16} />
            <span>{t("preview")}</span>
          </button>
          <button className="btn primary" onClick={onExport}>
            <Download size={16} />
            <span>{t("export")}</span>
          </button>
        </div>
      </header>
      <div className="editor-subhead">
        <div className="segmented">
          <button
            className={tab === "writing" ? "active" : ""}
            onClick={() => setTab("writing")}
          >
            <FileText size={15} />
            {t("writing")}
          </button>
          <button
            className={tab === "cover" ? "active" : ""}
            onClick={() => setTab("cover")}
          >
            <BookOpen size={15} />
            {t("cover")}
          </button>
        </div>
        <div className="subhead-actions">
          <button
            className="icon-btn"
            aria-label="Toggle outline"
            onClick={() => setLeft(!left)}
          >
            <ListTree size={18} />
          </button>
          <button className="text-button" onClick={onTemplate}>
            <LayoutTemplate size={15} />
            {t("templates")}
          </button>
          <button className="text-button" onClick={onRevisions}>
            <History size={15} />
            {t("revisions")}
          </button>
          <button
            className="icon-btn"
            aria-label="Toggle page settings"
            onClick={() => setRight(!right)}
          >
            <SlidersHorizontal size={18} />
          </button>
        </div>
      </div>
      {tab === "cover" ? (
        <CoverDesigner
          book={book}
          lang={lang}
          onError={onError}
          onChange={(cover) => change({ ...book, cover })}
        />
      ) : (
        <div className="editor-layout">
          <aside className={`outline-panel ${left ? "mobile-open" : ""}`}>
            <div className="panel-heading">
              <span>{t("outline")}</span>
              <button
                className="icon-btn mobile-only"
                aria-label="Close outline"
                onClick={() => setLeft(false)}
              >
                <PanelLeftClose size={16} />
              </button>
            </div>
            <div className="outline-add">
              <button
                className="btn subtle"
                onClick={() => {
                  setAddTitle("");
                  setAddDialog(true);
                }}
              >
                <Plus size={15} />
                {t("addChapter")}
              </button>
              <button className="btn subtle" onClick={addPage}>
                <Plus size={15} />
                {t("addPage")}
              </button>
            </div>
            {(["front", "main", "back"] as const).map((matter) => (
              <div className="outline-group" key={matter}>
                <h5>
                  {t(
                    matter === "front"
                      ? "frontMatter"
                      : matter === "main"
                        ? "mainMatter"
                        : "backMatter",
                  )}
                </h5>
                {book.chapters
                  .filter((c) => c.matter === matter)
                  .map((c) => (
                    <div key={c.id} className="outline-chapter">
                      <div className="chapter-row">
                        <button
                          className={c.id === chapter.id ? "selected" : ""}
                          onClick={() => {
                            const p = book.pages.find(
                              (p) => p.chapterId === c.id,
                            );
                            if (p) setPageId(p.id);
                            setLeft(false);
                          }}
                        >
                          <BookOpen size={14} />
                          <span>{c.title}</span>
                        </button>
                        <button
                          className="icon-btn"
                          aria-label={`Edit chapter ${c.title}`}
                          onClick={() => setChapterEdit(c.id)}
                        >
                          <MoreHorizontal size={14} />
                        </button>
                      </div>
                      {book.pages
                        .filter((p) => p.chapterId === c.id)
                        .map((p) => (
                          <button
                            key={p.id}
                            draggable
                            onDragStart={(e) =>
                              e.dataTransfer.setData("text/plain", p.id)
                            }
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                              e.preventDefault();
                              const id = e.dataTransfer.getData("text/plain"),
                                pages = book.pages.filter((x) => x.id !== id),
                                moving = book.pages.find((x) => x.id === id);
                              if (moving) {
                                pages.splice(
                                  pages.findIndex((x) => x.id === p.id),
                                  0,
                                  { ...moving, chapterId: p.chapterId },
                                );
                                change({ ...book, pages });
                              }
                            }}
                            className={`outline-page ${p.id === page.id ? "active" : ""}`}
                            onClick={() => {
                              setPageId(p.id);
                              setLeft(false);
                            }}
                          >
                            <FileText size={13} />
                            {t("page")} {book.pages.indexOf(p) + 1}
                            <small>
                              {p.html
                                .replace(/<[^>]*>/g, " ")
                                .trim()
                                .slice(0, 17)}
                            </small>
                          </button>
                        ))}
                    </div>
                  ))}
              </div>
            ))}
            <div className="outline-bottom">
              <button className="btn subtle" onClick={toc}>
                <ListTree size={15} />
                {t("contents")}
              </button>
              <button className="btn subtle" onClick={() => onAI(selectedText)}>
                <span>✧</span>
                {t("assistant")}
              </button>
              <button className="btn subtle" onClick={() => setAssetOpen(true)}>
                <Image size={15} />
                {t("assets")}
              </button>
            </div>
          </aside>
          <main className="editor-center">
            <div className="canvas-info">
              <span>
                {chapter.title}{" "}
                <span className="muted">
                  / {t("page")} {index + 1}
                </span>
              </span>
              <div>
                <button
                  className="icon-btn"
                  aria-label="Page actions"
                  onClick={() => setPageTools(!pageTools)}
                >
                  <MoreHorizontal size={18} />
                </button>
                <select
                  aria-label="Zoom"
                  value={zoom}
                  onChange={(e) => setZoom(+e.target.value)}
                >
                  {Array.from(
                    new Set([zoom, 30, 40, 50, 60, 70, 80, 90, 100, 125]),
                  )
                    .sort((a, b) => a - b)
                    .map((z) => (
                      <option key={z} value={z}>
                        {z}%
                      </option>
                    ))}
                </select>
              </div>
            </div>
            {pageTools && (
              <div className="page-actions">
                <button className="btn subtle" onClick={duplicatePage}>
                  <Copy size={14} />
                  {t("duplicate")}
                </button>
                <button className="btn subtle" onClick={() => reorder(-1)}>
                  <ChevronUp size={14} />
                </button>
                <button className="btn subtle" onClick={() => reorder(1)}>
                  <ChevronDown size={14} />
                </button>
                <button className="btn danger" onClick={deletePage}>
                  <Trash2 size={14} />
                  {t("delete")}
                </button>
                <select
                  aria-label="Move page to chapter"
                  value={page.chapterId}
                  onChange={(e) =>
                    change({
                      ...book,
                      pages: book.pages.map((p) =>
                        p.id === page.id
                          ? { ...p, chapterId: e.target.value }
                          : p,
                      ),
                    })
                  }
                >
                  {book.chapters.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <PageEditor
              key={page.id}
              book={book}
              page={page}
              index={index}
              zoom={zoom}
              lang={lang}
              onChange={patchHTML}
              onFlow={(htmls) => {
                const b = current.current,
                  idx = b.pages.findIndex((p) => p.id === page.id);
                if (idx < 0) return;
                const pages = [...b.pages];
                pages[idx] = { ...pages[idx], html: htmls[0] };
                for (let k = 1; k < htmls.length; k++)
                  pages.splice(idx + k, 0, {
                    id: uid(),
                    chapterId: page.chapterId,
                    html: htmls[k],
                    layout: { ...page.layout },
                  });
                change({ ...b, pages }, true);
              }}
              onBreak={(before, after) => {
                const b = current.current,
                  pages = [...b.pages],
                  newPage = {
                    id: uid(),
                    chapterId: page.chapterId,
                    html: after,
                    layout: { ...page.layout },
                  };
                pages[index] = { ...page, html: before };
                pages.splice(index + 1, 0, newPage);
                change({ ...b, pages });
                setPageId(newPage.id);
              }}
              onSelection={setSelectedText}
              onError={onError}
            />
            <footer className="canvas-footer">
              <span>
                {countWords(book).toLocaleString()} {t("words")} ·{" "}
                {book.pages.length} {t("pages")}
              </span>
              <div>
                <button
                  className="mini-btn"
                  aria-label="Previous page"
                  disabled={!index}
                  onClick={() => setPageId(book.pages[index - 1].id)}
                >
                  ‹
                </button>
                <span>
                  {index + 1} / {book.pages.length}
                </span>
                <button
                  className="mini-btn"
                  aria-label="Next page"
                  disabled={index === book.pages.length - 1}
                  onClick={() => setPageId(book.pages[index + 1].id)}
                >
                  ›
                </button>
              </div>
              <span>
                {l.width} × {l.height} mm
              </span>
            </footer>
          </main>
          <aside className={`properties-panel ${right ? "mobile-open" : ""}`}>
            <div className="panel-heading">
              {t("layout")}
              <button
                className="icon-btn mobile-only"
                aria-label="Close page settings"
                onClick={() => setRight(false)}
              >
                <SlidersHorizontal size={17} />
              </button>
            </div>
            <div className="properties-body">
              <Field label={t("scope")}>
                <select
                  aria-label="Settings scope"
                  value={scope}
                  onChange={(e) => setScope(e.target.value)}
                >
                  <option value="page">{t("current")}</option>
                  <option value="chapter">{t("chapter")}</option>
                  <option value="book">{t("book")}</option>
                </select>
              </Field>
              <LayoutFields
                lang={lang}
                layout={l}
                format
                onChange={updateLayout}
              />
            </div>
          </aside>
        </div>
      )}
      {settingsOpen && (
        <Modal title={t("settings")} onClose={() => setSettingsOpen(false)}>
          <div className="modal-body">
            {(
              [
                "title",
                "subtitle",
                "author",
                "publisher",
                "description",
                "year",
                "genre",
                "folder",
              ] as const
            ).map((k) => (
              <Field key={k} label={t(k)}>
                {k === "description" ? (
                  <textarea
                    value={book[k]}
                    onChange={(e) =>
                      change({ ...book, [k]: e.target.value }, true)
                    }
                  />
                ) : (
                  <input
                    aria-label={"Book " + k}
                    value={book[k]}
                    onChange={(e) =>
                      change({ ...book, [k]: e.target.value }, true)
                    }
                  />
                )}
              </Field>
            ))}
            <Field label={t("language")}>
              <select
                value={book.language}
                onChange={(e) =>
                  change({ ...book, language: e.target.value as Lang })
                }
              >
                {Object.entries(languageNames).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            <p className="muted small-text">
              Page typography and direction are configured in the layout panel.
              Cover text is edited independently so custom covers are never
              overwritten.
            </p>
            <button
              className="btn primary"
              onClick={() => setSettingsOpen(false)}
            >
              {t("close")}
            </button>
          </div>
        </Modal>
      )}
      {assetOpen && (
        <AssetLibrary
          book={book}
          onClose={() => setAssetOpen(false)}
          onError={onError}
          onInsert={(src, name) =>
            patchHTML(
              page.html +
                '<p><img src="' +
                src +
                '" alt="' +
                escapeHTML(name) +
                '"></p>',
            )
          }
        />
      )}
      {addDialog && (
        <Modal title={t("addChapter")} onClose={() => setAddDialog(false)}>
          <div className="modal-body">
            <Field label={t("title")}>
              <input
                autoFocus
                aria-label="Chapter title"
                value={addTitle}
                onChange={(e) => setAddTitle(e.target.value)}
              />
            </Field>
            <Field label="Book section">
              <select
                value={addMatter}
                onChange={(e) => setAddMatter(e.target.value as Matter)}
              >
                <option value="front">{t("frontMatter")}</option>
                <option value="main">{t("mainMatter")}</option>
                <option value="back">{t("backMatter")}</option>
              </select>
            </Field>
            <div className="chip-list">
              {(addMatter === "front"
                ? [
                    "Title page",
                    "Copyright",
                    "Dedication",
                    "Acknowledgements",
                    "Foreword",
                    "Preface",
                  ]
                : addMatter === "back"
                  ? [
                      "Conclusion",
                      "Bibliography",
                      "References",
                      "Glossary",
                      "Author biography",
                    ]
                  : ["Chapter"]
              ).map((x) => (
                <button
                  className="mini-btn"
                  key={x}
                  onClick={() => setAddTitle(x)}
                >
                  {x}
                </button>
              ))}
            </div>
            <button
              className="btn primary"
              disabled={!addTitle.trim()}
              onClick={addChapter}
            >
              {t("add")}
            </button>
          </div>
        </Modal>
      )}
      {editChapter && (
        <Modal title={editChapter.title} onClose={() => setChapterEdit("")}>
          <div className="modal-body">
            <Field label={t("title")}>
              <input
                value={editChapter.title}
                onChange={(e) =>
                  change(
                    {
                      ...book,
                      chapters: book.chapters.map((c) =>
                        c.id === editChapter.id
                          ? { ...c, title: e.target.value }
                          : c,
                      ),
                    },
                    true,
                  )
                }
              />
            </Field>
            <Field label={t("startOn")}>
              <select
                value={editChapter.start}
                onChange={(e) => {
                  const start = e.target.value as "next" | "odd" | "even";
                  const pages = [...book.pages];
                  let idx = pages.findIndex(
                    (p) => p.chapterId === editChapter.id,
                  );
                  if (
                    idx >= 0 &&
                    start !== "next" &&
                    (idx + 1) % 2 !== (start === "odd" ? 1 : 0)
                  ) {
                    const prev = pages[Math.max(0, idx - 1)];
                    pages.splice(idx, 0, {
                      id: uid(),
                      chapterId: prev.chapterId,
                      html: "<p></p>",
                      layout: {},
                    });
                  }
                  change({
                    ...book,
                    pages,
                    chapters: book.chapters.map((c) =>
                      c.id === editChapter.id ? { ...c, start } : c,
                    ),
                  });
                }}
              >
                <option value="next">{t("nextPage")}</option>
                <option value="odd">{t("odd")}</option>
                <option value="even">{t("even")}</option>
              </select>
            </Field>
            <div className="button-row">
              <button
                className="btn subtle"
                onClick={() => {
                  const chapters = [...book.chapters],
                    idx = chapters.findIndex((c) => c.id === editChapter.id);
                  if (idx > 0) {
                    [chapters[idx], chapters[idx - 1]] = [
                      chapters[idx - 1],
                      chapters[idx],
                    ];
                    change({
                      ...book,
                      chapters,
                      pages: chapters.flatMap((c) =>
                        book.pages.filter((p) => p.chapterId === c.id),
                      ),
                    });
                  }
                }}
              >
                ↑ Move section
              </button>
              <button
                className="btn subtle"
                onClick={() => {
                  const chapters = [...book.chapters],
                    idx = chapters.findIndex((c) => c.id === editChapter.id);
                  if (idx < chapters.length - 1) {
                    [chapters[idx], chapters[idx + 1]] = [
                      chapters[idx + 1],
                      chapters[idx],
                    ];
                    change({
                      ...book,
                      chapters,
                      pages: chapters.flatMap((c) =>
                        book.pages.filter((p) => p.chapterId === c.id),
                      ),
                    });
                  }
                }}
              >
                ↓ Move section
              </button>
            </div>
            <button
              className="btn danger"
              disabled={book.chapters.length === 1}
              onClick={() => {
                if (confirm("Delete section and every page in it?")) {
                  const chapters = book.chapters.filter(
                      (c) => c.id !== editChapter.id,
                    ),
                    pages = book.pages.filter(
                      (p) => p.chapterId !== editChapter.id,
                    );
                  if (!pages.length)
                    pages.push({
                      id: uid(),
                      chapterId: chapters[0].id,
                      html: "<p></p>",
                      layout: {},
                    });
                  change({ ...book, chapters, pages });
                  setChapterEdit("");
                }
              }}
            >
              {t("delete")}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

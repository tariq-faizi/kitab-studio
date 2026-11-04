import { useEffect, useRef, useState } from "react";
import {
  BookOpen,
  LayoutGrid,
  LayoutTemplate,
  Plus,
  Search,
  ArrowUpRight,
  ArrowRight,
  ChevronDown,
  Settings,
  CloudOff,
  Wifi,
  ShieldCheck,
  Download,
  Upload,
  Sparkles,
  Menu,
  X,
  Moon,
  Sun,
  HardDrive,
  MoreHorizontal,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Feather,
  FileText,
  Archive,
  Clock,
  Copy,
  Trash2,
  Pencil,
  Folder,
} from "lucide-react";
import {
  Brand,
  CoverArt,
  Empty,
  Field,
  Modal,
  CoverCanvas,
  countWords,
} from "../components/ui";
import { LayoutFields } from "../components/LayoutFields";
import { Wizard } from "../pages/Wizard";
import { BookEditor } from "../editor/BookEditor";
import { templates as builtins } from "../templates";
import { db, deleteBook, journal, loadBook, saveBook } from "../storage";
import {
  defaultLayout,
  languageNames,
  uid,
  type Book,
  type Lang,
  type Template,
  type Layout,
  type Revision,
} from "../types";
import { tr } from "../localization";
import { refreshStructure } from "../utils/structure";
import {
  download,
  effective,
  layoutCSS,
  normalizeHTML,
  pageNumber,
  plain,
  validLayout,
} from "../utils/document";
import { exportBackup, importBackup } from "../export/backup";
import { exportDocx } from "../export/docx";
import { openPrint } from "../export/print";
type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};
interface Preferences {
  language: Lang;
  theme: "light" | "dark" | "system";
  auto: number;
  defaults: Layout;
}
const defaultPrefs: Preferences = {
  language: "ps",
  theme: "light",
  auto: 1,
  defaults: defaultLayout,
};
function getPrefs() {
  try {
    return {
      ...defaultPrefs,
      ...JSON.parse(localStorage.getItem("kitab-preferences") || "{}"),
    };
  } catch {
    return defaultPrefs;
  }
}
export default function App() {
  const [prefs, setPrefs] = useState<Preferences>(getPrefs),
    [view, setView] = useState("home"),
    [books, setBooks] = useState<Book[]>([]),
    [custom, setCustom] = useState<Template[]>([]),
    [book, setBook] = useState<Book | null>(null),
    [ready, setReady] = useState(false),
    [online, setOnline] = useState(navigator.onLine),
    [nav, setNav] = useState(false),
    [search, setSearch] = useState(""),
    [category, setCategory] = useState("All"),
    [collection, setCollection] = useState("All"),
    [sort, setSort] = useState("recent"),
    [wizard, setWizard] = useState(false),
    [initial, setInitial] = useState<Template | undefined>(),
    [modal, setModal] = useState(""),
    [toast, setToast] = useState<{ text: string; error: boolean } | null>(null),
    [busy, setBusy] = useState(false),
    [saveStatus, setSaveStatus] = useState("saved"),
    [lastSaved, setLastSaved] = useState(Date.now()),
    [install, setInstall] = useState<InstallEvent | null>(null),
    [storage, setStorage] = useState<{ usage?: number; quota?: number }>({}),
    [revisions, setRevisions] = useState<Revision[]>([]),
    [templateTarget, setTemplateTarget] = useState<Template | null>(null),
    [templateScope, setTemplateScope] = useState("book"),
    [editTemplate, setEditTemplate] = useState<Template | null>(null),
    [aiText, setAiText] = useState(""),
    [aiPrompt, setAiPrompt] = useState(
      "Proofread this text while preserving its language and voice.",
    ),
    [aiResult, setAiResult] = useState(""),
    [aiConsent, setAiConsent] = useState(false),
    [aiEndpoint, setAiEndpoint] = useState(
      () => localStorage.getItem("kitab-ai-endpoint") || "",
    ),
    [updateReady, setUpdateReady] = useState(false);
  const lang = prefs.language,
    t = tr(lang),
    templates = [...builtins, ...custom],
    latest = useRef<Book | null>(book),
    savedVersion = useRef(0),
    saveQueue = useRef(Promise.resolve()),
    toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  latest.current = book;
  function notify(text: string, error = false) {
    clearTimeout(toastTimer.current);
    setToast({ text, error });
    toastTimer.current = setTimeout(() => setToast(null), error ? 10000 : 4500);
  }
  const fail = (e: unknown) =>
    notify(e instanceof Error ? e.message : String(e), true);
  async function refresh() {
    setBooks(await db.books.orderBy("updated").reverse().toArray());
    setCustom(await db.templates.toArray());
  }
  useEffect(() => {
    (async () => {
      try {
        await db.open();
        await refresh();
        if (navigator.storage?.estimate)
          setStorage(await navigator.storage.estimate());
      } catch (e) {
        fail(e);
      } finally {
        setReady(true);
      }
    })();
    const on = () => setOnline(navigator.onLine);
    const prompt = (e: Event) => {
      e.preventDefault();
      setInstall(e as InstallEvent);
    };
    window.addEventListener("online", on);
    window.addEventListener("pageshow", on);
    window.addEventListener("offline", on);
    window.addEventListener("beforeinstallprompt", prompt);
    const updated = () => setUpdateReady(true);
    window.addEventListener("kitab-update-ready", updated);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("pageshow", on);
      window.removeEventListener("offline", on);
      window.removeEventListener("beforeinstallprompt", prompt);
      window.removeEventListener("kitab-update-ready", updated);
    };
  }, []);
  useEffect(() => {
    localStorage.setItem("kitab-preferences", JSON.stringify(prefs));
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "en" ? "ltr" : "rtl";
    document.documentElement.dataset.theme =
      prefs.theme === "system"
        ? matchMedia("(prefers-color-scheme:dark)").matches
          ? "dark"
          : "light"
        : prefs.theme;
  }, [prefs]);
  function change(b: Book) {
    b = refreshStructure(b);
    const next = {
      ...b,
      updated: Math.max(Date.now(), (latest.current?.updated || 0) + 1),
    };
    latest.current = next;
    journal(next);
    setBook(next);
    setSaveStatus("saving");
  }
  function save(revision = false): Promise<void> {
    const snapshot = latest.current;
    if (!snapshot) return Promise.resolve();
    const task = saveQueue.current
      .catch(() => {})
      .then(async () => {
        try {
          await saveBook(snapshot, revision);
          savedVersion.current = snapshot.updated;
          if (
            latest.current?.id === snapshot.id &&
            latest.current.updated === snapshot.updated
          ) {
            setSaveStatus("saved");
            setLastSaved(Date.now());
          } else if (latest.current) journal(latest.current);
        } catch (e) {
          setSaveStatus("error");
          fail(e);
          throw e;
        }
      });
    saveQueue.current = task;
    return task;
  }
  useEffect(() => {
    if (!book || book.updated === savedVersion.current) return;
    const id = setTimeout(() => void save().catch(() => {}), prefs.auto * 1000);
    return () => clearTimeout(id);
  }, [book, prefs.auto]);
  useEffect(() => {
    const interval = setInterval(() => {
      if (latest.current) void save(true).catch(() => {});
    }, 30000);
    const flush = () => {
      if (document.visibilityState === "hidden" && latest.current) {
        journal(latest.current);
        void save().catch(() => {});
      }
    };
    const unload = (e: BeforeUnloadEvent) => {
      if (latest.current && latest.current.updated !== savedVersion.current) {
        journal(latest.current);
        e.preventDefault();
        e.returnValue = "";
      }
    };
    document.addEventListener("visibilitychange", flush);
    window.addEventListener("beforeunload", unload);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", flush);
      window.removeEventListener("beforeunload", unload);
    };
  }, []);
  async function openBook(id: string) {
    try {
      const b = await loadBook(id);
      if (!b)
        throw Error(
          "This project could not be opened. Restore a backup if available.",
        );
      setBook(b);
      latest.current = b;
      savedVersion.current = b.updated;
      setLastSaved(b.updated);
      setSaveStatus("saved");
      setNav(false);
    } catch (e) {
      fail(e);
    }
  }
  async function closeBook() {
    try {
      await save(true);
      setBook(null);
      latest.current = null;
      await refresh();
    } catch {
      notify(
        "Your book could not be saved. Download a backup before leaving.",
        true,
      );
    }
  }
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };
  async function restore(file: File) {
    await run(async () => {
      const b = await importBackup(file);
      await refresh();
      notify(
        "Backup restored as a new book. Existing projects were not changed.",
      );
      await openBook(b.id);
    });
  }
  function launchWizard(tmp?: Template) {
    setInitial(tmp);
    setWizard(true);
    setNav(false);
  }
  async function projectAction(b: Book, action: string) {
    try {
      if (action === "duplicate") {
        const copy = structuredClone(b);
        copy.id = uid();
        copy.title += " (copy)";
        copy.created = Date.now();
        copy.updated = Date.now();
        await saveBook(copy);
        await refresh();
      }
      if (action === "rename") {
        const title = prompt("Book title", b.title);
        if (title?.trim()) {
          b = { ...b, title: title.trim(), updated: Date.now() };
          await saveBook(b);
          await refresh();
        }
      }
      if (action === "folder") {
        const folder = prompt("Collection name", b.folder);
        if (folder !== null) {
          await saveBook({ ...b, folder, updated: Date.now() });
          await refresh();
        }
      }
      if (
        action === "delete" &&
        confirm(
          `Delete “${b.title}” from this device? Export a backup first. This cannot be undone.`,
        )
      ) {
        await deleteBook(b.id);
        await refresh();
      }
      if (action === "backup") await exportBackup(b);
    } catch (e) {
      fail(e);
    }
  }
  async function applyTemplate(tmp: Template) {
    if (!book) return;
    let pages = book.pages,
      layout = book.layout;
    if (templateScope === "book") {
      layout = { ...layout, ...tmp.layout };
      pages = pages.map((p) => ({
        ...p,
        templateId: tmp.id,
        layout: { ...p.layout, ...tmp.layout },
      }));
    } else {
      const selected = prompt("Page number", "1"),
        idx = Number(selected) - 1;
      if (!selected || !pages[idx]) return;
      const chapterId = pages[idx].chapterId;
      pages = pages.map((p, i) =>
        i === idx || (templateScope === "chapter" && p.chapterId === chapterId)
          ? { ...p, templateId: tmp.id, layout: { ...p.layout, ...tmp.layout } }
          : p,
      );
    }
    if (
      !validLayout(layout) ||
      pages.some((p) => !validLayout({ ...layout, ...p.layout }))
    )
      throw Error(
        "Template margins do not fit this book size. Adjust the page dimensions first.",
      );
    change({ ...book, templateId: tmp.id, layout, pages });
    setModal("");
    setTemplateTarget(null);
    notify("Template applied. Your content has been preserved.");
  }
  async function showRevisions() {
    if (!book) return;
    await save(true);
    setRevisions(
      (
        await db.revisions.where("bookId").equals(book.id).sortBy("date")
      ).reverse(),
    );
    setModal("revisions");
  }
  const sideItems = [
    ["home", LayoutGrid, "home"],
    ["books", BookOpen, "library"],
    ["templates", LayoutTemplate, "templates"],
    ["ai", Sparkles, "assistant"],
    ["backup", Archive, "backup"],
  ] as const;
  const visibleBooks = books
    .filter(
      (b) =>
        `${b.title} ${b.author} ${b.folder}`
          .toLowerCase()
          .includes(search.toLowerCase()) &&
        (collection === "All" || b.folder === collection),
    )
    .sort((a, b) =>
      sort === "title" ? a.title.localeCompare(b.title) : b.updated - a.updated,
    );
  if (!ready)
    return (
      <div className="loading">
        <Brand />
        <Loader2 className="spin" />
        <p>{t("loading")}</p>
      </div>
    );
  const gallery = (selection = false) => (
    <>
      <div className="category-tabs">
        {["All", "Poetry", "Literature", "Education", "Other", "Custom"].map(
          (c) => (
            <button
              key={c}
              className={category === c ? "active" : ""}
              onClick={() => setCategory(c)}
            >
              {c === "All" ? t("all") : c}
              <span>
                {c === "All"
                  ? templates.length
                  : templates.filter((x) =>
                      c === "Custom"
                        ? x.id.startsWith("custom-")
                        : x.category === c,
                    ).length}
              </span>
            </button>
          ),
        )}
      </div>
      <div className="template-grid">
        {templates
          .filter(
            (x) =>
              category === "All" ||
              (category === "Custom"
                ? x.id.startsWith("custom-")
                : x.category === category),
          )
          .map((tmp) => (
            <article className="template-card" key={tmp.id}>
              <button
                className="template-art-button"
                onClick={() => {
                  setTemplateTarget(tmp);
                  if (!selection) setModal("template-preview");
                }}
              >
                <CoverArt template={tmp} />
              </button>
              <div className="template-meta">
                <div>
                  <strong>{tmp.name}</strong>
                  <small>{tmp.category}</small>
                </div>
                <button
                  className="icon-btn"
                  aria-label={`Customize ${tmp.name}`}
                  onClick={() => {
                    setEditTemplate({
                      ...structuredClone(tmp),
                      id: "custom-" + uid(),
                      name: tmp.name + " — Custom",
                    });
                    setModal("custom-template");
                  }}
                >
                  <Pencil size={15} />
                </button>
              </div>
              <p>{tmp.tagline}</p>
              <button
                className="template-use"
                onClick={() =>
                  selection ? setTemplateTarget(tmp) : launchWizard(tmp)
                }
              >
                {selection ? t("apply") : t("choose")}
                <ArrowUpRight size={16} />
              </button>
            </article>
          ))}
      </div>
    </>
  );
  return (
    <>
      <div className={`app-shell ${book ? "editing" : ""}`}>
        {!book && (
          <>
            <aside className={`sidebar ${nav ? "open" : ""}`}>
              <Brand />
              <button
                className="btn primary new-book"
                onClick={() => launchWizard()}
              >
                <Plus size={18} />
                {t("newBook")}
                <span className="shortcut">N</span>
              </button>
              <p className="nav-caption">{t("workspace")}</p>
              <nav>
                {sideItems.map(([key, Icon, label]) => (
                  <button
                    key={key}
                    aria-label={t(label)}
                    className={view === key ? "active" : ""}
                    onClick={() => {
                      setView(key);
                      setNav(false);
                    }}
                  >
                    <Icon size={19} />
                    <span>{t(label)}</span>
                    {key === "books" && (
                      <span className="nav-count">{books.length}</span>
                    )}
                    {key === "ai" && <span className="online-badge">AI</span>}
                  </button>
                ))}
              </nav>
              <div className="sidebar-bottom">
                <div className="privacy-card">
                  <ShieldCheck size={20} />
                  <strong>{t("local")}</strong>
                  <p>{t("localText")}</p>
                  <span>
                    <span className="status-dot" />
                    {t("saved")}
                  </span>
                </div>
                <button
                  className={
                    view === "settings"
                      ? "sidebar-setting active"
                      : "sidebar-setting"
                  }
                  onClick={() => {
                    setView("settings");
                    setNav(false);
                  }}
                >
                  <Settings size={18} />
                  {t("settings")}
                </button>
                <div className="sidebar-footer">
                  <span>
                    Kitab Studio <small>v1.0</small>
                  </span>
                  <button
                    className="icon-btn"
                    aria-label="Toggle dark mode"
                    onClick={() =>
                      setPrefs({
                        ...prefs,
                        theme: prefs.theme === "dark" ? "light" : "dark",
                      })
                    }
                  >
                    {prefs.theme === "dark" ? (
                      <Sun size={17} />
                    ) : (
                      <Moon size={17} />
                    )}
                  </button>
                </div>
              </div>
            </aside>
            {nav && (
              <button
                className="nav-scrim"
                aria-label="Close navigation"
                onClick={() => setNav(false)}
              />
            )}
            <div className="main-shell">
              <header className="topbar">
                <div className="topbar-title">
                  <button
                    className="icon-btn mobile-only"
                    aria-label="Open navigation"
                    onClick={() => setNav(!nav)}
                  >
                    <Menu size={21} />
                  </button>
                  <span>
                    {t(
                      view === "home"
                        ? "home"
                        : view === "books"
                          ? "library"
                          : view === "templates"
                            ? "templates"
                            : view === "ai"
                              ? "assistant"
                              : view === "backup"
                                ? "backup"
                                : "settings",
                    )}
                  </span>
                </div>
                <div className="topbar-right">
                  <span className={`connection ${online ? "" : "is-offline"}`}>
                    {online ? <Wifi size={14} /> : <CloudOff size={14} />}
                    <span>{online ? t("online") : "Offline Mode"}</span>
                  </span>
                  <select
                    className="language-select"
                    aria-label="Application language"
                    value={lang}
                    onChange={(e) =>
                      setPrefs({ ...prefs, language: e.target.value as Lang })
                    }
                  >
                    {Object.entries(languageNames).map(([k, v]) => (
                      <option value={k} key={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                  <button
                    className="avatar"
                    aria-label="Open settings"
                    onClick={() => setView("settings")}
                  >
                    K
                  </button>
                </div>
              </header>
              {!online && (
                <div className="offline-banner">
                  <CloudOff size={15} />
                  {t("offline")}
                </div>
              )}
              <main className="main-content">
                {(view === "home" || view === "books") && (
                  <>
                    <div className="page-heading">
                      <div>
                        <p className="eyebrow">{t("welcome")}</p>
                        <h1>
                          {view === "home" ? t("greeting") : t("library")}
                        </h1>
                        <p className="muted">{t("intro")}</p>
                      </div>
                      <button
                        className="btn primary"
                        onClick={() => launchWizard()}
                      >
                        <Plus size={17} />
                        {t("newBook")}
                      </button>
                    </div>
                    {view === "home" && (
                      <>
                        <section className="hero">
                          <div className="hero-copy">
                            <div className="hero-label">
                              <Feather size={14} /> MADE FOR THE WAY YOU WRITE
                            </div>
                            <h2>
                              {t("start")}
                              <span>One page at a time.</span>
                            </h2>
                            <p>
                              Poetry, stories, and everything in between.
                              <br />A thoughtfully designed home for your words.
                            </p>
                            <button
                              className="btn cream"
                              onClick={() => {
                                setView("templates");
                                setCategory("All");
                              }}
                            >
                              {t("choose")}
                              <ArrowRight size={16} />
                            </button>
                            <small>
                              19 original templates · Yours to make your own
                            </small>
                          </div>
                          <div className="hero-art" aria-hidden="true">
                            <div className="hero-lines" />
                            <div className="hero-book rear">
                              <CoverArt
                                template={builtins[1]}
                                title="The quiet art of being"
                                author="A collection of reflections"
                              />
                            </div>
                            <div className="hero-book front">
                              <CoverArt
                                template={builtins[0]}
                                title="د رڼا سفر"
                                author="د شعرونو ټولګه"
                              />
                            </div>
                            <span className="hero-star">✳</span>
                          </div>
                        </section>
                        <div className="stats-row">
                          <div>
                            <span className="stat-icon">
                              <BookOpen size={18} />
                            </span>
                            <div>
                              <strong>
                                {books.length.toString().padStart(2, "0")}
                              </strong>
                              <small>{t("library")}</small>
                            </div>
                            <span className="stat-note">
                              YOUR STORIES, TOGETHER
                            </span>
                          </div>
                          <div>
                            <span className="stat-icon sand">
                              <FileText size={18} />
                            </span>
                            <div>
                              <strong>
                                {books
                                  .reduce((n, b) => n + b.pages.length, 0)
                                  .toString()
                                  .padStart(2, "0")}
                              </strong>
                              <small>{t("pages")}</small>
                            </div>
                            <span className="stat-note">
                              EVERY PAGE MATTERS
                            </span>
                          </div>
                          <div>
                            <span className="stat-icon lilac">
                              <ShieldCheck size={18} />
                            </span>
                            <div>
                              <strong>100%</strong>
                              <small>Stored locally</small>
                            </div>
                            <span className="stat-note">
                              JUST YOU & YOUR WORDS
                            </span>
                          </div>
                        </div>
                      </>
                    )}
                    <div className="section-heading">
                      <h2>
                        {t("recent")}{" "}
                        <span className="count-pill">{books.length}</span>
                      </h2>
                      <div className="books-controls">
                        <label className="search-box">
                          <Search size={16} />
                          <input
                            aria-label="Search projects"
                            placeholder={t("search")}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                          />
                        </label>
                        <select
                          aria-label="Sort projects"
                          value={sort}
                          onChange={(e) => setSort(e.target.value)}
                        >
                          <option value="recent">Last edited</option>
                          <option value="title">Title A–Z</option>
                        </select>
                        <select
                          aria-label="Collection filter"
                          value={collection}
                          onChange={(e) => setCollection(e.target.value)}
                        >
                          <option value="All">All collections</option>
                          {Array.from(
                            new Set(books.map((b) => b.folder).filter(Boolean)),
                          ).map((f) => (
                            <option key={f}>{f}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    {!visibleBooks.length ? (
                      <Empty
                        title={t("empty")}
                        text={t("emptyText")}
                        action={
                          <button
                            className="btn primary"
                            onClick={() => launchWizard()}
                          >
                            <Plus size={16} />
                            {t("newBook")}
                          </button>
                        }
                      />
                    ) : (
                      <div className="books-grid">
                        {visibleBooks.map((b) => (
                          <article key={b.id} className="book-card">
                            <button
                              className="book-thumbnail"
                              onClick={() => void openBook(b.id)}
                              aria-label={`${t("open")} ${b.title}`}
                            >
                              <CoverCanvas side={b.cover.front} />
                            </button>
                            <div className="book-card-meta">
                              <span className="book-genre">{b.genre}</span>
                              <div className="book-title-line">
                                <h3 dir="auto">
                                  <button onClick={() => void openBook(b.id)}>
                                    {b.title}
                                  </button>
                                </h3>
                                <details className="project-menu">
                                  <summary aria-label={`Actions ${b.title}`}>
                                    <MoreHorizontal size={18} />
                                  </summary>
                                  <div>
                                    {[
                                      ["rename", Pencil, "rename"],
                                      ["duplicate", Copy, "duplicate"],
                                      ["folder", Folder, "folder"],
                                      ["backup", Download, "backup"],
                                      ["delete", Trash2, "delete"],
                                    ].map(([key, Icon, label]) => {
                                      const I = Icon as typeof Pencil;
                                      return (
                                        <button
                                          key={String(key)}
                                          onClick={(e) => {
                                            (
                                              e.currentTarget.closest(
                                                "details",
                                              ) as HTMLDetailsElement
                                            ).open = false;
                                            void projectAction(b, String(key));
                                          }}
                                        >
                                          <I size={14} />
                                          {t(label as "rename")}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </details>
                              </div>
                              <p>{b.author || languageNames[b.language]}</p>
                              <div className="book-card-foot">
                                <span>
                                  {b.pages.length} {t("pages")} ·{" "}
                                  {countWords(b)} {t("words")}
                                </span>
                                <span>
                                  <Clock size={12} />
                                  {new Date(b.updated).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                          </article>
                        ))}
                        <button
                          className="new-book-card"
                          onClick={() => launchWizard()}
                        >
                          <span>
                            <Plus size={27} />
                          </span>
                          <strong>{t("newBook")}</strong>
                          <small>A new idea deserves a home.</small>
                        </button>
                      </div>
                    )}
                    {view === "home" && (
                      <section className="bottom-callout">
                        <span className="callout-icon">✧</span>
                        <div>
                          <strong>
                            A little structure. Endless possibilities.
                          </strong>
                          <p>Find a layout that feels like your story.</p>
                        </div>
                        <button
                          className="text-button"
                          onClick={() => setView("templates")}
                        >
                          {t("choose")}
                          <ArrowUpRight size={17} />
                        </button>
                      </section>
                    )}
                  </>
                )}
                {view === "templates" && (
                  <>
                    <div className="page-heading">
                      <div>
                        <p className="eyebrow">DESIGNED TO INSPIRE</p>
                        <h1>{t("templates")}</h1>
                        <p className="muted">{t("templateIntro")}</p>
                      </div>
                      <button
                        className="btn primary"
                        onClick={() => {
                          setEditTemplate({
                            id: "custom-" + uid(),
                            name: "My template",
                            category: "Custom",
                            tagline: "A design of your own",
                            accent: "#173f35",
                            paper: "#f8f1e0",
                            pattern: 0,
                            layout: { ...prefs.defaults },
                          });
                          setModal("custom-template");
                        }}
                      >
                        <Plus size={16} />
                        {t("custom")}
                      </button>
                    </div>
                    {gallery()}
                  </>
                )}
                {view === "backup" && (
                  <>
                    <div className="page-heading">
                      <div>
                        <p className="eyebrow">KEEP YOUR WORDS SAFE</p>
                        <h1>{t("backup")}</h1>
                        <p className="muted">{t("localText")}</p>
                      </div>
                    </div>
                    <div className="utility-grid">
                      <section className="utility-card">
                        <Download size={28} />
                        <h2>{t("download")}</h2>
                        <p>
                          Each archive includes manuscript, covers, inline
                          images, assets, custom templates, settings, fonts, and
                          licenses.
                        </p>
                        {books.map((b) => (
                          <button
                            key={b.id}
                            className="backup-book"
                            onClick={() => void run(() => exportBackup(b))}
                          >
                            <BookOpen size={17} />
                            {b.title}
                            <Download size={16} />
                          </button>
                        ))}
                        {!books.length && (
                          <p className="muted">
                            Create a book to export its backup.
                          </p>
                        )}
                      </section>
                      <section className="utility-card">
                        <Upload size={28} />
                        <h2>{t("restore")}</h2>
                        <p>
                          Restore a .kitab.zip archive. Your existing books are
                          never overwritten; a new copy is created.
                        </p>
                        <label className="upload-zone">
                          <Upload size={28} />
                          <strong>Choose a Kitab backup</strong>
                          <small>.kitab.zip · up to 80 MB</small>
                          <input
                            type="file"
                            accept=".zip"
                            hidden
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) void restore(f);
                              e.target.value = "";
                            }}
                          />
                        </label>
                      </section>
                    </div>
                  </>
                )}
                {view === "settings" && (
                  <>
                    <div className="page-heading">
                      <div>
                        <p className="eyebrow">MAKE YOURSELF AT HOME</p>
                        <h1>{t("settings")}</h1>
                      </div>
                    </div>
                    <div className="settings-grid">
                      <section className="utility-card">
                        <h2>
                          {t("theme")} & {t("language")}
                        </h2>
                        <Field label={t("language")}>
                          <select
                            value={lang}
                            onChange={(e) =>
                              setPrefs({
                                ...prefs,
                                language: e.target.value as Lang,
                              })
                            }
                          >
                            {Object.entries(languageNames).map(([k, v]) => (
                              <option key={k} value={k}>
                                {v}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label={t("theme")}>
                          <select
                            value={prefs.theme}
                            onChange={(e) =>
                              setPrefs({
                                ...prefs,
                                theme: e.target.value as Preferences["theme"],
                              })
                            }
                          >
                            {(["light", "dark", "system"] as const).map((v) => (
                              <option key={v} value={v}>
                                {t(v)}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label={t("auto")}>
                          <input
                            type="number"
                            min="1"
                            max="30"
                            value={prefs.auto}
                            onChange={(e) =>
                              setPrefs({
                                ...prefs,
                                auto: Math.max(
                                  1,
                                  Math.min(30, Number(e.target.value)),
                                ),
                              })
                            }
                          />
                        </Field>
                        <hr />
                        <h2>{t("install")}</h2>
                        <p className="muted">
                          Install once, then write offline. The app must be
                          served over HTTPS or localhost.
                        </p>
                        <button
                          className="btn primary"
                          onClick={async () => {
                            if (install) {
                              await install.prompt();
                              await install.userChoice;
                              setInstall(null);
                            } else setModal("install");
                          }}
                        >
                          <Download size={16} />
                          {install ? t("install") : t("noInstall")}
                        </button>
                        <hr />
                        <h2>{t("storage")}</h2>
                        <p>
                          {((storage.usage || 0) / 1024 / 1024).toFixed(1)} MB
                          used /{" "}
                          {((storage.quota || 0) / 1024 / 1024).toFixed(0)} MB
                          estimated quota
                        </p>
                        <button
                          className="btn subtle"
                          onClick={() =>
                            void run(async () => {
                              const ok = await navigator.storage?.persist?.();
                              notify(
                                ok
                                  ? "Persistent storage granted. Keep regular backups."
                                  : "Persistent storage not granted by this browser. Keep regular backups.",
                              );
                            })
                          }
                        >
                          <HardDrive size={16} />
                          {t("persist")}
                        </button>
                        <p className="small-text muted">{t("localText")}</p>
                      </section>
                      <section className="utility-card">
                        <h2>Defaults for new books</h2>
                        <p className="muted small-text">
                          Templates may override typography. Existing books are
                          not changed.
                        </p>
                        <LayoutFields
                          lang={lang}
                          layout={prefs.defaults}
                          format
                          onChange={(p) => {
                            const defaults = { ...prefs.defaults, ...p };
                            if (validLayout(defaults))
                              setPrefs({ ...prefs, defaults });
                            else
                              fail(
                                Error(
                                  "These margins leave too little page space.",
                                ),
                              );
                          }}
                        />
                      </section>
                      <section className="utility-card">
                        <h2>Optional AI connection</h2>
                        <p>
                          Core tools never require this connection. Deploy the
                          included server separately and set its Gemini key on
                          the server only.
                        </p>
                        <Field label="Trusted AI endpoint (HTTPS or localhost)">
                          <input
                            placeholder="https://your-server.example/api/ai"
                            value={aiEndpoint}
                            onChange={(e) => {
                              setAiEndpoint(e.target.value);
                              localStorage.setItem(
                                "kitab-ai-endpoint",
                                e.target.value,
                              );
                            }}
                          />
                        </Field>
                        <p className="small-text muted">
                          Use a server you trust. A permitted origin and access
                          token are required by the included AI server.
                        </p>
                      </section>
                    </div>
                  </>
                )}
                {view === "ai" && (
                  <div className="ai-page utility-card">
                    <Sparkles size={38} />
                    <p className="eyebrow">A THOUGHTFUL WRITING PARTNER</p>
                    <h1>{t("assistant")}</h1>
                    <p>
                      {online
                        ? "Bring a selection of your writing, not your entire manuscript. You decide what to share."
                        : t("aiOffline")}
                    </p>
                    <div className="chip-list">
                      {[
                        "Generate a book outline",
                        "Suggest chapter titles",
                        "Proofread text",
                        "Improve grammar",
                        "Summarize selected text",
                        "Suggest a preface",
                        "Improve a poetry draft",
                        "Write a book description",
                      ].map((x) => (
                        <button
                          key={x}
                          className="btn subtle"
                          disabled={!online}
                          onClick={() => {
                            setAiPrompt(x);
                            setAiText("");
                            setAiResult("");
                            setAiConsent(false);
                            setModal("ai");
                          }}
                        >
                          {x}
                          <ArrowUpRight size={14} />
                        </button>
                      ))}
                    </div>
                    {!aiEndpoint && (
                      <p className="muted">
                        Connect your optional AI server in Settings first.
                      </p>
                    )}
                  </div>
                )}
              </main>
              <footer className="app-footer">
                <span>KITAB STUDIO · A home for your words.</span>
                <span>
                  <ShieldCheck size={12} />
                  No account. No tracking. Your device.
                </span>
              </footer>
            </div>
          </>
        )}
        {book && (
          <>
            <div className={`editor-connect ${!online ? "offline" : ""}`}>
              {!online ? (
                t("offline")
              ) : (
                <>
                  <span className="status-dot" />
                  {t("online")}
                </>
              )}
              <select
                aria-label="Application language"
                value={lang}
                onChange={(e) =>
                  setPrefs({ ...prefs, language: e.target.value as Lang })
                }
              >
                {Object.entries(languageNames).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <BookEditor
              key={book.id}
              book={book}
              lang={lang}
              templates={templates}
              onChange={change}
              onSave={() => save(true)}
              onClose={closeBook}
              onExport={() => setModal("export")}
              onPreview={() => setModal("preview")}
              onRevisions={() => void run(showRevisions)}
              onTemplate={() => {
                setCategory("All");
                setModal("apply-template");
              }}
              onAI={(text) => {
                setAiText(text);
                setAiConsent(false);
                setAiResult("");
                setModal("ai");
              }}
              onError={fail}
              saveStatus={saveStatus}
              lastSaved={lastSaved}
            />
          </>
        )}
      </div>
      {wizard && (
        <Wizard
          lang={lang}
          defaults={prefs.defaults}
          templates={templates}
          initial={initial}
          onClose={() => setWizard(false)}
          onError={fail}
          onCreate={async (b) => {
            b.layout = { ...prefs.defaults, ...b.layout };
            await saveBook(b, true);
            setWizard(false);
            await refresh();
            await openBook(b.id);
          }}
        />
      )}
      {modal === "export" && book && (
        <Modal title={t("export")} onClose={() => setModal("")}>
          <div className="modal-body">
            <p className="eyebrow">MADE TO BE SHARED</p>
            <h2>{t("exportIntro")}</h2>
            <button
              disabled={busy}
              className="export-option"
              onClick={() => void run(() => openPrint(book))}
            >
              <span className="export-icon">PDF</span>
              <div>
                <strong>{t("print")}</strong>
                <small>Browser-rendered · Complex-script shaping</small>
              </div>
              <ArrowUpRight size={20} />
            </button>
            <p className="small-text muted">{t("printNote")}</p>
            <button
              disabled={busy}
              className="btn subtle"
              onClick={() => void run(() => openPrint(book, true))}
            >
              Download self-contained print-ready HTML
            </button>
            <button
              disabled={busy}
              className="export-option"
              onClick={() => void run(() => exportDocx(book))}
            >
              <span className="export-icon blue">W</span>
              <div>
                <strong>{t("docx")}</strong>
                <small>Headings, images, tables, and RTL paragraphs</small>
              </div>
              <Download size={20} />
            </button>
            <p className="small-text muted">
              Word must have Noto fonts installed for matching typography.
              Decorative covers are simplified in DOCX; use PDF for visual
              fidelity.
            </p>
            <button
              disabled={busy}
              className="export-option"
              onClick={() => void run(() => exportBackup(book))}
            >
              <span className="export-icon sand">ZIP</span>
              <div>
                <strong>{t("archive")}</strong>
                <small>Restore your whole workspace for this book</small>
              </div>
              <Download size={20} />
            </button>
          </div>
        </Modal>
      )}
      {modal === "preview" && book && (
        <Modal title={t("preview")} onClose={() => setModal("")} wide>
          <div className="preview-pages">
            <div className="preview-cover">
              <CoverCanvas side={book.cover.front} />
            </div>
            {book.pages.map((p, i) => (
              <div className="preview-item" key={p.id}>
                <div
                  className="book-paper"
                  style={layoutCSS(effective(book, p), i)}
                >
                  <div className="running-header">
                    {effective(book, p).header || book.title}
                  </div>
                  <div
                    className="preview-content"
                    dangerouslySetInnerHTML={{ __html: normalizeHTML(p.html) }}
                  />
                  <div className="running-footer">
                    <span>{effective(book, p).footer}</span>
                    <span>{pageNumber(book, i)}</span>
                  </div>
                </div>
                <small>
                  {t("page")} {i + 1}
                </small>
              </div>
            ))}
            <div className="preview-cover">
              <CoverCanvas side={book.cover.back} />
            </div>
          </div>
        </Modal>
      )}
      {modal === "install" && (
        <Modal title={t("noInstall")} onClose={() => setModal("")}>
          <div className="modal-body">
            <h3>Android · Chrome / Edge</h3>
            <p>
              Open the browser menu → Install app or Add to Home screen. The
              option appears only when the browser considers the app
              installable.
            </p>
            <h3>Desktop · Chrome / Edge</h3>
            <p>
              Use the install icon in the address bar or the browser menu →
              Install Kitab Studio.
            </p>
            <h3>iPhone / iPad · Safari</h3>
            <p>
              Share → Add to Home Screen. Offline storage behavior varies by
              browser; keep external backups.
            </p>
            <p className="muted">
              Finish the first load while online. Offline mode is ready after
              the service worker finishes caching the production build.
            </p>
          </div>
        </Modal>
      )}
      {(modal === "apply-template" || modal === "template-preview") && (
        <Modal
          title={t("templates")}
          onClose={() => {
            setModal("");
            setTemplateTarget(null);
          }}
          wide
        >
          <div className="modal-body">
            {modal === "apply-template" && book && (
              <button
                className="btn subtle"
                style={{ marginBottom: 18 }}
                onClick={() => {
                  setEditTemplate({
                    id: "custom-" + uid(),
                    name: book.title + " template",
                    category: "Custom",
                    tagline: "Custom book layout",
                    accent: book.cover.front.background,
                    paper: book.layout.background,
                    pattern: 0,
                    layout: { ...book.layout },
                  });
                  setModal("custom-template");
                }}
              >
                <Plus size={15} />
                {t("custom")}
              </button>
            )}
            {modal === "apply-template" && (
              <Field label={t("scope")}>
                <select
                  value={templateScope}
                  onChange={(e) => setTemplateScope(e.target.value)}
                >
                  <option value="book">{t("book")}</option>
                  <option value="chapter">{t("chapter")}</option>
                  <option value="page">{t("current")}</option>
                </select>
              </Field>
            )}
            {templateTarget ? (
              <div className="template-detail">
                <CoverArt template={templateTarget} />
                <div>
                  <h2>{templateTarget.name}</h2>
                  <p>{templateTarget.tagline}</p>
                  <p>
                    {templateTarget.layout.font} · {templateTarget.layout.size}{" "}
                    pt
                  </p>
                  <p className="muted">
                    Applies styling without replacing your manuscript. Covers
                    remain unchanged.
                  </p>
                  <button
                    className="btn primary"
                    onClick={() => {
                      if (modal === "apply-template")
                        void run(() => applyTemplate(templateTarget));
                      else {
                        const tmp = templateTarget;
                        setModal("");
                        setTemplateTarget(null);
                        launchWizard(tmp);
                      }
                    }}
                  >
                    {modal === "apply-template" ? t("apply") : t("newBook")}
                  </button>
                  <button
                    className="btn subtle"
                    onClick={() => setTemplateTarget(null)}
                  >
                    {t("back")}
                  </button>
                </div>
              </div>
            ) : (
              gallery(true)
            )}
          </div>
        </Modal>
      )}
      {modal === "custom-template" && editTemplate && (
        <Modal title={t("custom")} onClose={() => setModal("")} wide>
          <div className="modal-body custom-template-editor">
            <div>
              <CoverArt template={editTemplate} />
              <Field label="Template name">
                <input
                  value={editTemplate.name}
                  onChange={(e) =>
                    setEditTemplate({ ...editTemplate, name: e.target.value })
                  }
                />
              </Field>
              <Field label="Accent">
                <input
                  type="color"
                  value={editTemplate.accent}
                  onChange={(e) =>
                    setEditTemplate({ ...editTemplate, accent: e.target.value })
                  }
                />
              </Field>
              <Field label="Cover pattern">
                <select
                  value={editTemplate.pattern}
                  onChange={(e) =>
                    setEditTemplate({
                      ...editTemplate,
                      pattern: +e.target.value,
                    })
                  }
                >
                  {[0, 1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n + 1}
                    </option>
                  ))}
                </select>
              </Field>
              <button
                className="btn primary"
                disabled={!editTemplate.name.trim()}
                onClick={() =>
                  void run(async () => {
                    if (
                      !validLayout({ ...defaultLayout, ...editTemplate.layout })
                    )
                      throw Error("Invalid template layout.");
                    await db.templates.put(editTemplate);
                    await refresh();
                    setModal("");
                    notify("Custom template saved offline.");
                  })
                }
              >
                {t("save")}
              </button>
              {book && (
                <button
                  className="btn subtle"
                  onClick={() =>
                    setEditTemplate({
                      ...editTemplate,
                      layout: { ...book.layout },
                    })
                  }
                >
                  Use current book layout
                </button>
              )}
            </div>
            <div>
              <LayoutFields
                lang={lang}
                format
                layout={{ ...defaultLayout, ...editTemplate.layout }}
                onChange={(p) =>
                  setEditTemplate({
                    ...editTemplate,
                    layout: { ...editTemplate.layout, ...p },
                  })
                }
              />
            </div>
          </div>
        </Modal>
      )}
      {modal === "revisions" && book && (
        <Modal title={t("revisions")} onClose={() => setModal("")}>
          <div className="modal-body">
            <p className="muted">
              Last 30 snapshots. A snapshot is taken on manual save and every 30
              seconds while a book is open.
            </p>
            {revisions.map((r) => (
              <div className="revision-row" key={r.id}>
                <div>
                  <strong>{new Date(r.date).toLocaleString()}</strong>
                  <small>
                    {r.book.pages.length} pages · {countWords(r.book)} words
                  </small>
                </div>
                <button
                  className="btn subtle"
                  onClick={() => {
                    if (
                      confirm(
                        "Restore this revision? The current version will remain in revision history.",
                      )
                    )
                      void run(async () => {
                        await save(true);
                        change({ ...r.book, updated: Date.now() });
                        await save(true);
                        setModal("");
                      });
                  }}
                >
                  {t("restore")}
                </button>
              </div>
            ))}
          </div>
        </Modal>
      )}
      {modal === "ai" && (
        <Modal title={t("assistant")} onClose={() => setModal("")}>
          <div className="modal-body">
            {!online && <div className="notice">{t("aiOffline")}</div>}
            <p className="muted small-text">{t("aiNotice")}</p>
            <Field label={t("prompt")}>
              <textarea
                value={aiPrompt}
                maxLength={2000}
                onChange={(e) => {
                  setAiPrompt(e.target.value);
                  setAiConsent(false);
                }}
              />
            </Field>
            <Field label={t("selected")}>
              <textarea
                rows={7}
                value={aiText}
                maxLength={16000}
                onChange={(e) => {
                  setAiText(e.target.value);
                  setAiConsent(false);
                }}
              />
            </Field>
            <label className="consent">
              <input
                type="checkbox"
                checked={aiConsent}
                onChange={(e) => setAiConsent(e.target.checked)}
              />
              {t("consent")}
            </label>
            <button
              className="btn primary"
              disabled={
                !online || !aiConsent || busy || !aiEndpoint || !aiPrompt.trim()
              }
              onClick={() =>
                void run(async () => {
                  const url = new URL(aiEndpoint, location.href);
                  if (
                    url.protocol !== "https:" &&
                    !(
                      url.protocol === "http:" &&
                      ["localhost", "127.0.0.1"].includes(url.hostname)
                    )
                  )
                    throw Error("AI endpoint must use HTTPS or localhost.");
                  const token = prompt(
                    "AI server access token (kept in memory only)",
                  );
                  if (!token) return;
                  const r = await fetch(url, {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                      instruction: aiPrompt,
                      text: aiText,
                      language: lang,
                    }),
                    signal: AbortSignal.timeout(60000),
                    credentials: "omit",
                  });
                  const data = await r.json();
                  if (!r.ok) throw Error(data.error || "AI request failed.");
                  if (typeof data.text !== "string")
                    throw Error("Invalid AI response.");
                  setAiResult(data.text);
                })
              }
            >
              <Sparkles size={16} />
              Send selected text
            </button>
            {!aiEndpoint && (
              <p className="notice">
                Configure your trusted AI endpoint in Settings. No API key is
                required for writing or exporting.
              </p>
            )}
            {aiResult && (
              <>
                <h3>Suggestion — review before using</h3>
                <pre className="ai-result">{aiResult}</pre>
                <button
                  className="btn subtle"
                  onClick={() => {
                    download(
                      new Blob([aiResult], {
                        type: "text/plain;charset=utf-8",
                      }),
                      "writing-suggestion.txt",
                    );
                  }}
                >
                  Download suggestion
                </button>
              </>
            )}
          </div>
        </Modal>
      )}
      {toast && (
        <div role="alert" className={`toast ${toast.error ? "error" : ""}`}>
          {toast.error ? (
            <AlertTriangle size={20} />
          ) : (
            <CheckCircle2 size={20} />
          )}
          <span>{toast.text}</span>
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast(null)}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {busy && (
        <div className="busy-indicator" role="status">
          <Loader2 size={16} className="spin" />
          Working locally…
        </div>
      )}
      {updateReady && (
        <div className="update-notice">
          An application update is available. Save and back up before reloading.
          <button
            onClick={() =>
              void run(async () => {
                await save(true);
                window.dispatchEvent(new Event("kitab-apply-update"));
              })
            }
          >
            Save & update
          </button>
        </div>
      )}
    </>
  );
}

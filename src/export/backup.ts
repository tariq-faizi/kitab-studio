import JSZip from "jszip";
import { db } from "../storage";
import { uid, type Book, type Template } from "../types";
import {
  download,
  normalizeHTML,
  safeImage,
  validLayout,
} from "../utils/document";
export async function exportBackup(book: Book) {
  const zip = new JSZip();
  zip.file(
    "manifest.json",
    JSON.stringify({
      application: "kitab-studio",
      version: 1,
      exported: new Date().toISOString(),
    }),
  );
  zip.file("book.json", JSON.stringify(book));
  zip.file("templates.json", JSON.stringify(await db.templates.toArray()));
  const assets = await db.assets.where("bookId").equals(book.id).toArray();
  for (const a of assets) zip.file(`assets/${a.id}`, a.data);
  zip.file(
    "assets.json",
    JSON.stringify(assets.map(({ id, name }) => ({ id, name }))),
  );
  const licenses = zip.folder("licenses")!;
  for (const name of ["naskh", "sans"])
    licenses.file(
      `${name}-LICENSE.txt`,
      await (await fetch(`/fonts/${name}-LICENSE.txt`)).text(),
    );
  const fontFiles = Object.keys(import.meta.glob("/public/fonts/*.woff2")).map(
    (x) => x.replace("/public", ""),
  );
  for (const path of fontFiles)
    zip.file(
      `fonts/${path.split("/").pop()}`,
      await (await fetch(path)).arrayBuffer(),
    );
  download(
    await zip.generateAsync({ type: "blob" }),
    `${book.title || "book"}.kitab.zip`,
  );
}
export async function importBackup(file: File): Promise<Book> {
  if (file.size > 80 * 1024 * 1024) throw Error("Archive exceeds 80 MB.");
  const zip = await JSZip.loadAsync(file);
  let expanded = 0;
  for (const entry of Object.values(zip.files)) {
    const e = entry as unknown as { _data?: { uncompressedSize?: number } };
    expanded += e._data?.uncompressedSize || 0;
    if (expanded > 160 * 1024 * 1024)
      throw Error("Archive expands beyond the 160 MB safety limit.");
  }
  const manifest = JSON.parse(
    (await zip.file("manifest.json")?.async("string")) || "null",
  );
  if (manifest?.application !== "kitab-studio" || manifest.version !== 1)
    throw Error("Not a supported Kitab Studio backup.");
  const raw = await zip.file("book.json")?.async("string");
  if (!raw || raw.length > 40 * 1024 * 1024)
    throw Error("Missing or oversized book data.");
  const b = JSON.parse(raw) as Book;
  if (
    b.version !== 1 ||
    !["ps", "fa", "ar", "ur", "en"].includes(b.language) ||
    !Array.isArray(b.pages) ||
    !Array.isArray(b.chapters) ||
    !b.pages.length ||
    !b.chapters.length ||
    b.pages.length > 2000 ||
    !validLayout(b.layout) ||
    typeof b.title !== "string" ||
    !b.cover
  )
    throw Error("Project data is invalid.");
  for (const k of [
    "subtitle",
    "author",
    "publisher",
    "description",
    "genre",
    "year",
    "folder",
    "templateId",
  ] as const)
    if (typeof b[k] !== "string") throw Error(`Invalid ${k}.`);
  const chapters = new Set<string>();
  for (const c of b.chapters) {
    if (
      !c ||
      typeof c.id !== "string" ||
      chapters.has(c.id) ||
      typeof c.title !== "string" ||
      !["front", "main", "back"].includes(c.matter) ||
      !["next", "odd", "even"].includes(c.start)
    )
      throw Error("Invalid chapter.");
    chapters.add(c.id);
  }
  const pages = new Set<string>();
  for (const p of b.pages) {
    if (
      !p ||
      typeof p.id !== "string" ||
      pages.has(p.id) ||
      !chapters.has(p.chapterId) ||
      typeof p.html !== "string" ||
      !p.layout ||
      !validLayout({ ...b.layout, ...p.layout })
    )
      throw Error("Invalid page.");
    pages.add(p.id);
    p.html = normalizeHTML(p.html);
  }
  for (const side of [b.cover.front, b.cover.back, b.cover.spine]) {
    if (
      !side ||
      !/^#[a-f0-9]{6}$/i.test(side.background) ||
      typeof side.gradient !== "string" ||
      (side.gradient && !/^#[a-f0-9]{6}$/i.test(side.gradient)) ||
      !Array.isArray(side.elements) ||
      side.elements.length > 100
    )
      throw Error("Invalid cover.");
    for (const e of side.elements) {
      if (
        !e ||
        !["text", "image", "shape", "barcode"].includes(e.kind) ||
        typeof e.text !== "string" ||
        (e.kind === "image" && !safeImage(e.text)) ||
        !["x", "y", "width", "height", "size"].every((k) =>
          Number.isFinite((e as unknown as Record<string, number>)[k]),
        ) ||
        e.x < 0 ||
        e.x > 100 ||
        e.y < 0 ||
        e.y > 100 ||
        e.width < 1 ||
        e.width > 100 ||
        e.height < 1 ||
        e.height > 100 ||
        e.size < 4 ||
        e.size > 150 ||
        !/^#[a-f0-9]{6}$/i.test(e.color) ||
        !["left", "center", "right"].includes(e.align) ||
        !["Noto Naskh Arabic", "Noto Sans Arabic", "Georgia", "Arial"].includes(
          e.font,
        )
      )
        throw Error("Invalid cover element.");
    }
  }
  if (
    !Number.isFinite(b.cover.spineWidth) ||
    b.cover.spineWidth < 1 ||
    b.cover.spineWidth > 100
  )
    throw Error("Invalid spine width.");
  // Always restore as a new project; existing manuscripts are never overwritten.
  b.id = uid();
  b.title += " (restored)";
  b.created = Date.now();
  b.updated = Date.now();
  const custom = JSON.parse(
    (await zip.file("templates.json")?.async("string")) || "[]",
  ) as Template[];
  if (!Array.isArray(custom) || custom.length > 200)
    throw Error("Invalid templates.");
  const remap = new Map<string, string>();
  const imported: Template[] = [];
  for (const t of custom) {
    if (
      !t ||
      typeof t.id !== "string" ||
      typeof t.name !== "string" ||
      typeof t.category !== "string" ||
      typeof t.tagline !== "string" ||
      !Number.isInteger(t.pattern) ||
      t.pattern < 0 ||
      t.pattern > 5 ||
      !/^#[a-f0-9]{6}$/i.test(t.accent) ||
      !/^#[a-f0-9]{6}$/i.test(t.paper) ||
      !validLayout({ ...b.layout, ...t.layout })
    )
      throw Error("Invalid custom template.");
    const id = uid();
    remap.set(t.id, id);
    imported.push({ ...t, id });
  }
  if (remap.has(b.templateId)) b.templateId = remap.get(b.templateId)!;
  b.pages.forEach((p) => {
    if (p.templateId && remap.has(p.templateId))
      p.templateId = remap.get(p.templateId);
  });
  const metadata = JSON.parse(
    (await zip.file("assets.json")?.async("string")) || "[]",
  );
  if (!Array.isArray(metadata) || metadata.length > 2000)
    throw Error("Invalid asset list.");
  const assets: Array<{
    id: string;
    bookId: string;
    name: string;
    data: Blob;
  }> = [];
  for (const a of metadata) {
    if (
      typeof a.id !== "string" ||
      !/^[a-z0-9-]+$/i.test(a.id) ||
      typeof a.name !== "string"
    )
      throw Error("Invalid asset.");
    const entry = zip.file(`assets/${a.id}`);
    if (entry)
      assets.push({
        id: uid(),
        bookId: b.id,
        name: a.name,
        data: await entry.async("blob"),
      });
  }
  await db.transaction("rw", db.books, db.templates, db.assets, async () => {
    await db.templates.bulkPut(imported);
    await db.books.add(b);
    await db.assets.bulkPut(assets);
  });
  return b;
}

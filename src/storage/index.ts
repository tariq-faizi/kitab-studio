import Dexie, { type EntityTable } from "dexie";
import type { Book, Revision, Template } from "../types";
export const db = new Dexie("kitab-studio-v1") as Dexie & {
  books: EntityTable<Book, "id">;
  templates: EntityTable<Template, "id">;
  revisions: EntityTable<Revision, "id">;
  assets: EntityTable<
    { id: string; bookId: string; name: string; data: Blob },
    "id"
  >;
};
db.version(1).stores({
  books: "id,updated,title,folder",
  templates: "id,category",
  revisions: "++id,bookId,date",
  assets: "id,bookId",
});
export async function saveBook(book: Book, revision = false) {
  await db.transaction("rw", db.books, db.revisions, async () => {
    await db.books.put(structuredClone(book));
    if (revision) {
      await db.revisions.add({
        bookId: book.id,
        date: Date.now(),
        book: structuredClone(book),
      });
      const old = await db.revisions
        .where("bookId")
        .equals(book.id)
        .sortBy("date");
      if (old.length > 30)
        await db.revisions.bulkDelete(old.slice(0, -30).map((x) => x.id!));
    }
  });
  try {
    localStorage.removeItem("kitab-recovery-" + book.id);
  } catch {
    /* IndexedDB is authoritative. */
  }
}
export async function deleteBook(id: string) {
  await db.transaction("rw", db.books, db.revisions, db.assets, async () => {
    await db.books.delete(id);
    await db.revisions.where("bookId").equals(id).delete();
    await db.assets.where("bookId").equals(id).delete();
  });
  localStorage.removeItem("kitab-recovery-" + id);
}
export function journal(book: Book) {
  try {
    localStorage.setItem("kitab-recovery-" + book.id, JSON.stringify(book));
  } catch {
    /* Large documents still save in IndexedDB; UI exposes save errors. */
  }
}
export async function loadBook(id: string) {
  const saved = await db.books.get(id);
  const raw = localStorage.getItem("kitab-recovery-" + id);
  if (raw) {
    try {
      const draft = JSON.parse(raw) as Book;
      if (draft.id === id && draft.updated > (saved?.updated || 0))
        return draft;
    } catch {
      /* A damaged journal must never replace a saved book. */
    }
  }
  return saved;
}

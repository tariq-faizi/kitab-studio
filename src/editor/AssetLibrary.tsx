import { useEffect, useState } from "react";
import { Upload, Plus, Trash2 } from "lucide-react";
import { db } from "../storage";
import { uid, type Book } from "../types";
import { Modal } from "../components/ui";
import { readImage, safeImage } from "../utils/document";
interface Asset {
  id: string;
  src: string;
  name: string;
  stored: boolean;
}
export function AssetLibrary({
  book,
  onInsert,
  onClose,
  onError,
}: {
  book: Book;
  onInsert: (src: string, name: string) => void;
  onClose: () => void;
  onError: (e: unknown) => void;
}) {
  const [assets, setAssets] = useState<Asset[]>([]),
    [busy, setBusy] = useState(false);
  async function refresh() {
    const list: Asset[] = [];
    const stored = await db.assets.where("bookId").equals(book.id).toArray();
    for (const a of stored) {
      const src = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = reject;
        r.readAsDataURL(a.data);
      });
      if (safeImage(src))
        list.push({ id: a.id, src, name: a.name, stored: true });
    }
    const add = (src: string, name: string) => {
      if (safeImage(src) && !list.some((a) => a.src === src))
        list.push({ id: uid(), src, name, stored: false });
    };
    for (const page of book.pages) {
      const el = document.createElement("div");
      el.innerHTML = page.html;
      el.querySelectorAll("img").forEach((i) =>
        add(i.src, i.alt || "Manuscript image"),
      );
    }
    for (const side of [book.cover.front, book.cover.back, book.cover.spine])
      side.elements
        .filter((e) => e.kind === "image")
        .forEach((e) => add(e.text, "Cover image"));
    setAssets(list);
  }
  useEffect(() => {
    void refresh().catch(onError);
  }, [book.id]);
  return (
    <Modal title="Images & assets" onClose={onClose} wide>
      <div className="modal-body">
        <p className="muted small-text">
          Assets are stored on this device. Removing an uploaded asset does not
          erase copies already inserted in your book.
        </p>
        <label className="btn primary">
          <Upload size={16} />
          Upload an image
          <input
            hidden
            type="file"
            disabled={busy}
            accept="image/png,image/jpeg,image/webp"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              setBusy(true);
              try {
                await readImage(file);
                await db.assets.add({
                  id: uid(),
                  bookId: book.id,
                  name: file.name,
                  data: file,
                });
                await refresh();
              } catch (err) {
                onError(err);
              } finally {
                setBusy(false);
              }
            }}
          />
        </label>
        <div className="asset-grid">
          {assets.map((a) => (
            <article key={a.id}>
              <img src={a.src} alt={a.name} />
              <strong>{a.name}</strong>
              <div className="button-row">
                <button
                  className="btn subtle"
                  onClick={() => {
                    onInsert(a.src, a.name);
                    onClose();
                  }}
                >
                  <Plus size={14} />
                  Insert
                </button>
                {a.stored && (
                  <button
                    className="icon-btn"
                    aria-label={`Remove asset ${a.name}`}
                    onClick={async () => {
                      if (
                        confirm(
                          "Remove this image from the asset library? Inserted copies stay in the manuscript.",
                        )
                      ) {
                        try {
                          await db.assets.delete(a.id);
                          await refresh();
                        } catch (e) {
                          onError(e);
                        }
                      }
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
        {!assets.length && (
          <p className="muted">
            No images yet. Upload a local PNG, JPEG, or WebP image.
          </p>
        )}
      </div>
    </Modal>
  );
}

import type { ReactNode } from "react";
import { X, BookOpen, Sparkles } from "lucide-react";
import type { Template, Book, CoverSide } from "../types";
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`modal ${wide ? "wide" : ""}`}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
          if (e.key === "Tab") {
            const nodes = e.currentTarget.querySelectorAll<HTMLElement>(
              'button:not(:disabled),input,select,textarea,[tabindex="0"]',
            );
            const first = nodes[0],
              last = nodes[nodes.length - 1];
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last?.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <header className="modal-head">
          <h2>{title}</h2>
          <button
            autoFocus
            className="icon-btn"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function CoverArt({
  template,
  title,
  author,
  small = false,
}: {
  template: Template;
  title?: string;
  author?: string;
  small?: boolean;
}) {
  return (
    <div
      className={`book-art pattern-${template.pattern} ${small ? "small" : ""}`}
      style={{ background: template.accent, color: template.paper }}
    >
      <div className="cover-rule" />
      <span className="cover-kicker">KITAB EDITIONS</span>
      <div className="cover-orbit" />
      <div className="cover-title" dir="auto">
        {title || template.name}
      </div>
      <div className="cover-sub">
        {title
          ? author
          : template.category === "Poetry"
            ? "A COLLECTION OF VERSES"
            : template.category.toUpperCase()}
      </div>
      <span className="cover-symbol">✳</span>
      <span className="cover-bottom">
        {title ? "کتاب سټوډیو" : "THE WRITER’S COLLECTION"}
      </span>
    </div>
  );
}
export function CoverCanvas({
  side,
  onSelect,
  selected,
  onMove,
}: {
  side: CoverSide;
  onSelect?: (id: string) => void;
  selected?: string;
  onMove?: (id: string, x: number, y: number) => void;
}) {
  return (
    <div
      className="cover-canvas"
      style={{
        background: side.gradient
          ? `linear-gradient(145deg,${side.background},${side.gradient})`
          : side.background,
      }}
    >
      {side.elements.map((e) => (
        <div
          key={e.id}
          className={`cover-element ${selected === e.id ? "selected" : ""}`}
          role={onSelect ? "button" : undefined}
          tabIndex={onSelect ? 0 : undefined}
          aria-label={e.kind === "text" ? e.text : e.kind}
          onKeyDown={(ev) => {
            if (ev.key === "Enter") onSelect?.(e.id);
            if (
              ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(
                ev.key,
              )
            ) {
              ev.preventDefault();
              onMove?.(
                e.id,
                Math.max(
                  0,
                  Math.min(
                    100 - e.width,
                    e.x +
                      (ev.key === "ArrowRight"
                        ? 1
                        : ev.key === "ArrowLeft"
                          ? -1
                          : 0),
                  ),
                ),
                Math.max(
                  0,
                  Math.min(
                    100 - e.height,
                    e.y +
                      (ev.key === "ArrowDown"
                        ? 1
                        : ev.key === "ArrowUp"
                          ? -1
                          : 0),
                  ),
                ),
              );
            }
          }}
          onPointerDown={(ev) => {
            if (!onSelect) return;
            onSelect(e.id);
            const target = ev.currentTarget,
              parent = target.parentElement!.getBoundingClientRect(),
              sx = ev.clientX,
              sy = ev.clientY;
            target.setPointerCapture(ev.pointerId);
            target.onpointermove = (p) => {
              const x = Math.max(
                  0,
                  Math.min(
                    100 - e.width,
                    e.x + ((p.clientX - sx) / parent.width) * 100,
                  ),
                ),
                y = Math.max(
                  0,
                  Math.min(
                    100 - e.height,
                    e.y + ((p.clientY - sy) / parent.height) * 100,
                  ),
                );
              target.style.left = `${x}%`;
              target.style.top = `${y}%`;
            };
            target.onpointerup = (p) => {
              target.onpointermove = null;
              target.onpointerup = null;
              onMove?.(
                e.id,
                Math.max(
                  0,
                  Math.min(
                    100 - e.width,
                    e.x + ((p.clientX - sx) / parent.width) * 100,
                  ),
                ),
                Math.max(
                  0,
                  Math.min(
                    100 - e.height,
                    e.y + ((p.clientY - sy) / parent.height) * 100,
                  ),
                ),
              );
            };
          }}
          style={
            {
              left: `${e.x}%`,
              top: `${e.y}%`,
              width: `${e.width}%`,
              height: `${e.height}%`,
              fontSize: `${e.size * 0.2383}cqw`,
              "--cover-font-size": `${e.size * 0.2383}cqw`,
              fontFamily: e.font,
              color: e.color,
              textAlign: e.align,
              background: e.kind === "shape" ? e.color : undefined,
              borderRadius: e.kind === "shape" ? "50%" : undefined,
            } as import("react").CSSProperties
          }
        >
          {e.kind === "image" ? (
            <img src={e.text} alt="Uploaded cover asset" />
          ) : e.kind === "barcode" ? (
            <div className="barcode">
              <div />
              BARCODE PLACEHOLDER
            </div>
          ) : e.kind === "text" ? (
            e.text
          ) : null}
        </div>
      ))}
    </div>
  );
}
export function Brand() {
  return (
    <div className="brand">
      <div className="brand-icon">
        <BookOpen size={25} strokeWidth={1.4} />
      </div>
      <div>
        <strong>
          KITAB STUDIO<span className="brand-dot">.</span>
        </strong>
        <small>کتاب سټوډیو</small>
      </div>
    </div>
  );
}
export function Empty({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Sparkles size={30} />
      </div>
      <h2>{title}</h2>
      <p>{text}</p>
      {action}
    </div>
  );
}
export const countWords = (b: Book) =>
  b.pages.reduce(
    (n, p) =>
      n +
      p.html
        .replace(/<[^>]*>/g, " ")
        .trim()
        .split(/\s+/)
        .filter(Boolean).length,
    0,
  );

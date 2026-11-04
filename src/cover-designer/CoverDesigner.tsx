import { useState } from "react";
import { Plus, Trash2, Image, Type, Shapes, Barcode } from "lucide-react";
import { CoverCanvas, Field } from "../components/ui";
import {
  fonts,
  uid,
  type Book,
  type Cover,
  type CoverElement,
  type Lang,
} from "../types";
import { readImage } from "../utils/document";
import { tr } from "../localization";
export function CoverDesigner({
  book,
  onChange,
  lang,
  onError,
}: {
  book: Book;
  onChange: (c: Cover) => void;
  lang: Lang;
  onError: (e: unknown) => void;
}) {
  const [side, setSide] = useState<"front" | "spine" | "back">("front"),
    [selected, setSelected] = useState(""),
    [spread, setSpread] = useState(false);
  const t = tr(lang),
    c = book.cover,
    s = c[side],
    el = s.elements.find((e) => e.id === selected);
  const update = (p: Partial<typeof s>) =>
    onChange({ ...c, [side]: { ...s, ...p } });
  const edit = (p: Partial<CoverElement>) =>
    update({
      elements: s.elements.map((e) => (e.id === selected ? { ...e, ...p } : e)),
    });
  const add = (kind: CoverElement["kind"], text = "") => {
    const e: CoverElement = {
      id: uid(),
      kind,
      text,
      x: 10,
      y: 25,
      width: 80,
      height: 20,
      size: 30,
      color: "#f0dfb6",
      align: "center",
      font: book.layout.font,
    };
    update({ elements: [...s.elements, e] });
    setSelected(e.id);
  };
  return (
    <div className="cover-designer">
      <div className="cover-tools">
        <div className="segmented">
          {(["front", "spine", "back"] as const).map((v) => (
            <button
              key={v}
              className={side === v ? "active" : ""}
              onClick={() => {
                setSide(v);
                setSelected("");
                setSpread(false);
              }}
            >
              {t(v === "back" ? "backCover" : v)}
            </button>
          ))}
        </div>
        <button className="btn subtle" onClick={() => setSpread(!spread)}>
          {spread ? "Single panel" : "Full cover preview"}
        </button>
        <div className="cover-add">
          <button
            className="btn subtle"
            onClick={() => add("text", "Your text")}
          >
            <Type size={16} />
            {t("add")}
          </button>
          <button className="btn subtle" onClick={() => add("shape")}>
            <Shapes size={16} />
            Shape
          </button>
          <button className="btn subtle" onClick={() => add("barcode")}>
            <Barcode size={16} />
            Barcode placeholder
          </button>
          <label className="btn subtle">
            <Image size={16} />
            {t("image")}
            <input
              hidden
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={async (e) => {
                try {
                  const file = e.target.files?.[0];
                  if (file) add("image", await readImage(file));
                } catch (err) {
                  onError(err);
                }
                e.target.value = "";
              }}
            />
          </label>
        </div>
        <div className="field-grid">
          <Field label={t("background")}>
            <input
              type="color"
              value={s.background}
              onChange={(e) => update({ background: e.target.value })}
            />
          </Field>
          <Field label="Gradient end">
            <input
              type="color"
              value={s.gradient || s.background}
              onChange={(e) => update({ gradient: e.target.value })}
            />
          </Field>
        </div>
        <button
          className="text-button"
          onClick={() => update({ gradient: "" })}
        >
          Remove gradient
        </button>
        <Field label="Spine width (mm)">
          <input
            type="number"
            min="1"
            max="100"
            value={c.spineWidth}
            onChange={(e) =>
              onChange({
                ...c,
                spineWidth: Math.max(1, Math.min(100, +e.target.value)),
                estimate: false,
              })
            }
          />
        </Field>
        <Field label="Paper sheet caliper (mm)">
          <input
            type="number"
            min="0"
            max="1"
            step="0.001"
            value={c.paperCaliper}
            onChange={(e) =>
              onChange({
                ...c,
                paperCaliper: Math.max(0, Math.min(1, +e.target.value)),
              })
            }
          />
        </Field>
        <button
          className="btn subtle"
          disabled={!c.paperCaliper}
          onClick={() =>
            onChange({
              ...c,
              spineWidth: Math.max(
                1,
                Math.min(
                  100,
                  Math.ceil(book.pages.length / 2) * c.paperCaliper,
                ),
              ),
              estimate: true,
            })
          }
        >
          Estimate spine from sheet caliper
        </button>
        <p className="muted small-text">
          {c.estimate ? "Estimated spine. " : ""}Estimate = sheets × sheet
          caliper, excluding cover stock and binding allowance. Confirm bleed,
          trim, color profile, and spine with your printer.
        </p>
        {el && (
          <div className="element-controls">
            <h4>Selected {el.kind}</h4>
            {el.kind === "text" && (
              <Field label="Text">
                <textarea
                  value={el.text}
                  onChange={(e) => edit({ text: e.target.value })}
                />
              </Field>
            )}
            <div className="field-grid">
              {(["x", "y", "width", "height", "size"] as const).map((k) => (
                <Field key={k} label={`${k}${k === "size" ? " (pt)" : " (%)"}`}>
                  <input
                    type="number"
                    min={
                      k === "size" ? 4 : k === "width" || k === "height" ? 1 : 0
                    }
                    max={k === "size" ? 150 : 100}
                    value={el[k]}
                    onChange={(e) =>
                      edit({
                        [k]: Math.min(
                          k === "size" ? 150 : 100,
                          Math.max(
                            k === "size"
                              ? 4
                              : k === "width" || k === "height"
                                ? 1
                                : 0,
                            +e.target.value,
                          ),
                        ),
                      })
                    }
                  />
                </Field>
              ))}
              <Field label={t("color")}>
                <input
                  type="color"
                  value={el.color}
                  onChange={(e) => edit({ color: e.target.value })}
                />
              </Field>
            </div>
            <Field label={t("font")}>
              <select
                value={el.font}
                onChange={(e) => edit({ font: e.target.value })}
              >
                {fonts.map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </Field>
            <Field label={t("alignment")}>
              <select
                value={el.align}
                onChange={(e) =>
                  edit({ align: e.target.value as CoverElement["align"] })
                }
              >
                {["left", "center", "right"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </Field>
            <button
              className="btn subtle"
              onClick={() => {
                const copy = {
                  ...el,
                  id: uid(),
                  x: Math.min(el.x + 3, 90),
                  y: Math.min(el.y + 3, 90),
                };
                update({ elements: [...s.elements, copy] });
                setSelected(copy.id);
              }}
            >
              <Plus size={15} />
              {t("duplicate")}
            </button>
            <button
              className="btn danger"
              onClick={() => {
                update({ elements: s.elements.filter((e) => e.id !== el.id) });
                setSelected("");
              }}
            >
              <Trash2 size={15} />
              {t("delete")}
            </button>
          </div>
        )}
      </div>
      <div className="cover-workspace">
        {spread ? (
          <div className="cover-spread">
            <CoverCanvas side={c.back} />
            <div
              className="spine-preview"
              style={{
                background: c.spine.background,
                width: Math.max(20, c.spineWidth * 2),
              }}
            >
              {c.spine.elements.map((e) => (
                <span key={e.id} style={{ color: e.color }}>
                  {e.text}
                </span>
              ))}
            </div>
            <CoverCanvas side={c.front} />
          </div>
        ) : (
          <div
            className={`cover-single ${side === "spine" ? "is-spine" : ""}`}
            style={
              side === "spine"
                ? { maxWidth: Math.max(65, c.spineWidth * 5) }
                : undefined
            }
          >
            <CoverCanvas
              side={s}
              selected={selected}
              onSelect={setSelected}
              onMove={(id, x, y) =>
                update({
                  elements: s.elements.map((e) =>
                    e.id === id ? { ...e, x, y } : e,
                  ),
                })
              }
            />
          </div>
        )}
        <p className="muted small-text">
          Drag to position · Arrow keys for precise movement · Select an element
          to resize
        </p>
      </div>
    </div>
  );
}

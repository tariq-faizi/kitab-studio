import { Field } from "./ui";
import { fonts, type Layout, type Lang } from "../types";
import { tr } from "../localization";
export function LayoutFields({
  layout: l,
  onChange,
  lang,
  format = false,
}: {
  layout: Layout;
  onChange: (p: Partial<Layout>) => void;
  lang: Lang;
  format?: boolean;
}) {
  const t = tr(lang);
  const number = (
    key: keyof Layout,
    label: string,
    min: number,
    max: number,
    step = 1,
  ) => (
    <Field label={label}>
      <input
        type="number"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={l[key] as number}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v) && v >= min && v <= max)
            onChange({ [key]: v });
        }}
      />
    </Field>
  );
  return (
    <>
      {format && (
        <>
          <Field label={t("format")}>
            <select
              aria-label="Page size"
              value=""
              onChange={(e) => {
                const [width, height] = e.target.value.split(",").map(Number);
                if (width) onChange({ width, height });
              }}
            >
              <option value="">
                {l.width} × {l.height} mm
              </option>
              {[
                ["A4", 210, 297],
                ["A5", 148, 210],
                ["B5", 176, 250],
                ["US Letter", 215.9, 279.4],
                ["6 × 9 in", 152.4, 228.6],
                ["5 × 8 in", 127, 203.2],
              ].map(([name, w, h]) => (
                <option value={`${w},${h}`} key={String(name)}>
                  {name}
                </option>
              ))}
            </select>
          </Field>
          <div className="field-grid">
            {number("width", "Width (mm)", 60, 420, 0.1)}
            {number("height", "Height (mm)", 60, 594, 0.1)}
          </div>
          <button
            className="btn subtle"
            onClick={() => onChange({ width: l.height, height: l.width })}
          >
            ↔ Portrait / Landscape
          </button>
        </>
      )}
      <h4>{t("typography")}</h4>
      <Field label={t("font")}>
        <select
          aria-label="Font family"
          value={l.font}
          onChange={(e) => onChange({ font: e.target.value })}
        >
          {fonts.map((f) => (
            <option key={f}>{f}</option>
          ))}
        </select>
      </Field>
      <div className="field-grid">
        {number("size", t("size"), 6, 72, 0.5)}
        {number("line", t("line"), 1, 4, 0.1)}
        {number("spacing", "Paragraph spacing (pt)", 0, 72)}
        {number("indent", "First-line indent (mm)", 0, 30)}
        {number("tracking", "Letter spacing (px)", 0, 10, 0.1)}
      </div>
      <Field label={t("alignment")}>
        <select
          aria-label="Text alignment"
          value={l.align}
          onChange={(e) =>
            onChange({ align: e.target.value as Layout["align"] })
          }
        >
          {["right", "left", "center", "justify"].map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      </Field>
      <Field label={t("direction")}>
        <select
          aria-label="Text direction"
          value={l.direction}
          onChange={(e) =>
            onChange({ direction: e.target.value as "rtl" | "ltr" })
          }
        >
          <option value="rtl">RTL ←</option>
          <option value="ltr">LTR →</option>
        </select>
      </Field>
      <h4>{t("margins")}</h4>
      <div className="field-grid">
        {number("top", t("top"), 5, 100)}
        {number("bottom", t("bottom"), 5, 100)}
        {number("inside", t("inside"), 5, 100)}
        {number("outside", t("outside"), 5, 100)}
        {number("gutter", t("gutter"), 0, 40)}
      </div>
      <div className="field-grid">
        <Field label={t("color")}>
          <input
            type="color"
            aria-label="Text color"
            value={l.color}
            onChange={(e) => onChange({ color: e.target.value })}
          />
        </Field>
        <Field label={t("background")}>
          <input
            type="color"
            aria-label="Page background"
            value={l.background}
            onChange={(e) => onChange({ background: e.target.value })}
          />
        </Field>
      </div>
      <Field label={t("header")}>
        <input
          value={l.header}
          onChange={(e) => onChange({ header: e.target.value })}
        />
      </Field>
      <Field label={t("footer")}>
        <input
          value={l.footer}
          onChange={(e) => onChange({ footer: e.target.value })}
        />
      </Field>
      <Field label={t("numbering")}>
        <select
          value={l.numbering}
          onChange={(e) =>
            onChange({ numbering: e.target.value as Layout["numbering"] })
          }
        >
          <option value="arabic">1, 2, 3</option>
          <option value="roman">i, ii, iii</option>
          <option value="none">—</option>
        </select>
      </Field>
    </>
  );
}

import { useState } from "react";
import { Check, ArrowRight, ArrowLeft } from "lucide-react";
import { Modal, Field, CoverArt } from "../components/ui";
import { LayoutFields } from "../components/LayoutFields";
import { CoverDesigner } from "../cover-designer/CoverDesigner";
import { newBook } from "../templates";
import { languageNames, type Lang, type Book, type Template } from "../types";
import { validLayout } from "../utils/document";
import { tr } from "../localization";
export function Wizard({
  lang,
  templates,
  initial,
  defaults,
  onClose,
  onCreate,
  onError,
}: {
  lang: Lang;
  templates: Template[];
  initial?: Template;
  defaults: Book["layout"];
  onClose: () => void;
  onCreate: (b: Book) => Promise<void>;
  onError: (e: unknown) => void;
}) {
  const [step, setStep] = useState(0),
    [busy, setBusy] = useState(false),
    [book, setBook] = useState(() =>
      newBook(
        {
          title: "",
          language: lang,
          layout: {
            ...defaults,
            ...(initial || templates[0]).layout,
            direction: lang === "en" ? "ltr" : "rtl",
          },
        },
        initial || templates[0],
      ),
    );
  const t = tr(lang),
    labels = [
      t("info"),
      t("format"),
      t("templates"),
      t("typography"),
      t("cover"),
      t("create"),
    ];
  const patch = (p: Partial<Book>) => setBook((b) => ({ ...b, ...p }));
  return (
    <Modal title={t("newBook")} onClose={onClose} wide>
      <div className="wizard-steps">
        {labels.map((s, i) => (
          <button
            key={s}
            className={i === step ? "active" : i < step ? "done" : ""}
            onClick={() => {
              if (i <= step) setStep(i);
            }}
            disabled={i > step}
          >
            <span>{i < step ? <Check size={13} /> : i + 1}</span>
            <small>{s}</small>
          </button>
        ))}
      </div>
      <div className="wizard-body">
        {step === 0 && (
          <>
            <p className="eyebrow">THE BEGINNING OF SOMETHING GOOD</p>
            <h2>{t("info")}</h2>
            <div className="field-grid">
              {(
                [
                  "title",
                  "subtitle",
                  "author",
                  "publisher",
                  "year",
                  "genre",
                ] as const
              ).map((k) => (
                <Field key={k} label={t(k)}>
                  <input
                    aria-label={k}
                    autoFocus={k === "title"}
                    maxLength={k === "title" ? 200 : 500}
                    value={book[k]}
                    onChange={(e) => patch({ [k]: e.target.value })}
                  />
                </Field>
              ))}
            </div>
            <Field label={t("language")}>
              <select
                value={book.language}
                onChange={(e) =>
                  patch({
                    language: e.target.value as Lang,
                    layout: {
                      ...book.layout,
                      direction: e.target.value === "en" ? "ltr" : "rtl",
                      align: e.target.value === "en" ? "left" : "right",
                    },
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
            <Field label={t("description")}>
              <textarea
                value={book.description}
                onChange={(e) => patch({ description: e.target.value })}
              />
            </Field>
          </>
        )}
        {step === 1 && (
          <div className="wizard-layout">
            <LayoutFields
              lang={lang}
              layout={book.layout}
              format
              onChange={(p) => patch({ layout: { ...book.layout, ...p } })}
            />
          </div>
        )}
        {step === 2 && (
          <div className="template-grid wizard-templates">
            {templates.map((tmp) => (
              <button
                key={tmp.id}
                className={`template-card ${book.templateId === tmp.id ? "selected" : ""}`}
                onClick={() =>
                  patch({
                    templateId: tmp.id,
                    layout: { ...book.layout, ...tmp.layout },
                  })
                }
              >
                <CoverArt template={tmp} small />
                <strong>{tmp.name}</strong>
                <small>{tmp.category}</small>
                {book.templateId === tmp.id && <Check size={18} />}
              </button>
            ))}
          </div>
        )}
        {step === 3 && (
          <div className="wizard-layout">
            <LayoutFields
              lang={lang}
              layout={book.layout}
              onChange={(p) => patch({ layout: { ...book.layout, ...p } })}
            />
          </div>
        )}
        {step === 4 && (
          <CoverDesigner
            book={book}
            lang={lang}
            onError={onError}
            onChange={(cover) => patch({ cover })}
          />
        )}
        {step === 5 && (
          <div className="wizard-summary">
            <CoverArt
              template={
                templates.find((x) => x.id === book.templateId) || templates[0]
              }
              title={book.title}
              author={book.author}
            />
            <div>
              <p className="eyebrow">READY FOR YOUR FIRST WORDS</p>
              <h2 dir="auto">{book.title}</h2>
              <p>{book.author}</p>
              <p>
                {book.layout.width} × {book.layout.height} mm ·{" "}
                {languageNames[book.language]}
              </p>
              <p className="muted">{t("localText")}</p>
            </div>
          </div>
        )}
      </div>
      <footer className="modal-foot">
        <button
          className="btn subtle"
          onClick={() => (step ? setStep(step - 1) : onClose())}
        >
          <ArrowLeft size={16} />
          {step ? t("back") : t("cancel")}
        </button>
        <span className="muted small-text">{step + 1} / 6</span>
        <button
          className="btn primary"
          disabled={busy || !book.title.trim()}
          onClick={async () => {
            if (!validLayout(book.layout))
              return onError(
                Error(
                  "Margins must leave at least 20 mm of content area. Check dimensions and typography.",
                ),
              );
            if (step < 5) {
              if (step === 3) {
                const c = structuredClone(book.cover);
                if (c.front.elements[0]) c.front.elements[0].text = book.title;
                if (c.front.elements[1]) c.front.elements[1].text = book.author;
                if (c.spine.elements[0]) c.spine.elements[0].text = book.title;
                const color =
                  templates.find((t) => t.id === book.templateId)?.accent ||
                  "#173f35";
                c.front.background = color;
                c.back.background = color;
                c.spine.background = color;
                patch({ cover: c });
              }
              setStep(step + 1);
            } else {
              setBusy(true);
              try {
                await onCreate(book);
              } catch (e) {
                onError(e);
              } finally {
                setBusy(false);
              }
            }
          }}
        >
          {step === 5 ? t("create") : t("next")}
          <ArrowRight size={16} />
        </button>
      </footer>
    </Modal>
  );
}

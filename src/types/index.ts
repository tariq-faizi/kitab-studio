export type Lang = "ps" | "fa" | "ar" | "ur" | "en";
export type Matter = "front" | "main" | "back";
export interface Layout {
  width: number;
  height: number;
  top: number;
  bottom: number;
  inside: number;
  outside: number;
  gutter: number;
  font: string;
  size: number;
  line: number;
  spacing: number;
  indent: number;
  tracking: number;
  align: "right" | "left" | "center" | "justify";
  direction: "rtl" | "ltr";
  color: string;
  background: string;
  header: string;
  footer: string;
  numbering: "arabic" | "roman" | "none";
}
export interface Template {
  id: string;
  name: string;
  category: string;
  tagline: string;
  accent: string;
  paper: string;
  pattern: number;
  layout: Partial<Layout>;
}
export interface Page {
  id: string;
  chapterId: string;
  html: string;
  layout: Partial<Layout>;
  templateId?: string;
  autoBlank?: boolean;
  toc?: boolean;
}
export interface Chapter {
  id: string;
  title: string;
  matter: Matter;
  start: "next" | "odd" | "even";
}
export interface CoverElement {
  id: string;
  kind: "text" | "image" | "shape" | "barcode";
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  size: number;
  color: string;
  align: "right" | "left" | "center";
  font: string;
}
export interface CoverSide {
  background: string;
  gradient: string;
  elements: CoverElement[];
}
export interface Cover {
  front: CoverSide;
  back: CoverSide;
  spine: CoverSide;
  spineWidth: number;
  paperCaliper: number;
  estimate: boolean;
}
export interface Book {
  version: 1;
  id: string;
  title: string;
  subtitle: string;
  author: string;
  publisher: string;
  description: string;
  language: Lang;
  genre: string;
  year: string;
  templateId: string;
  layout: Layout;
  chapters: Chapter[];
  pages: Page[];
  cover: Cover;
  created: number;
  updated: number;
  folder: string;
}
export interface Revision {
  id?: number;
  bookId: string;
  date: number;
  book: Book;
}
export const uid = () => crypto.randomUUID();
export const defaultLayout: Layout = {
  width: 148,
  height: 210,
  top: 20,
  bottom: 20,
  inside: 20,
  outside: 18,
  gutter: 3,
  font: "Noto Naskh Arabic",
  size: 16,
  line: 1.9,
  spacing: 8,
  indent: 0,
  tracking: 0,
  align: "right",
  direction: "rtl",
  color: "#242d29",
  background: "#fffefb",
  header: "",
  footer: "",
  numbering: "arabic",
};
export const languageNames: Record<Lang, string> = {
  ps: "پښتو",
  fa: "دری",
  ar: "العربية",
  ur: "اردو",
  en: "English",
};
export const fonts = [
  "Noto Naskh Arabic",
  "Noto Sans Arabic",
  "Georgia",
  "Arial",
];
export function makeCover(
  title: string,
  author: string,
  accent: string,
): Cover {
  const element = (text: string, y: number, size: number): CoverElement => ({
    id: uid(),
    kind: "text",
    text,
    x: 8,
    y,
    width: 84,
    height: 20,
    size,
    color: "#f3e6c9",
    align: "center",
    font: "Noto Naskh Arabic",
  });
  return {
    front: {
      background: accent,
      gradient: "",
      elements: [element(title, 29, 32), element(author, 76, 15)],
    },
    back: { background: accent, gradient: "", elements: [element("", 30, 16)] },
    spine: {
      background: accent,
      gradient: "",
      elements: [element(title, 20, 16)],
    },
    spineWidth: 12,
    paperCaliper: 0,
    estimate: false,
  };
}

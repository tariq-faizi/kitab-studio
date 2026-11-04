# Acceptance and release status

Four Playwright integration suites pass, covering the scenarios below. Five optional-server security tests are provided separately. This is not a statement that all production requirements are complete.

| Test | Criterion | Status | Evidence / limits |
|---|---|---|---|
| 1 | Create a new book | PASS | Six-step wizard exercised through UI. |
| 2 | Select a poetry template | PASS | Pashto Poetry selected. |
| 3 | Three chapters and multiple pages | PASS | 3 chapters / at least 4 pages saved and reloaded. |
| 4 | Pashto and RTL | PASS, scoped | RTL editor, offline exports, Noto PDF subsets and visual inspection; not linguist certification. |
| 5 | Mixed Pashto / English | PASS, scoped | Mixed text in editor and exports; per-block LTR/RTL controls available. |
| 6 | Fonts, colors, margins, layout | PASS | UI changes and content preservation checked. |
| 7 | Reload persistence | PASS | IndexedDB reload and book reopening. |
| 8 | Offline existing app | PASS | Production service-worker shell reload tested disconnected. |
| 9 | Offline creation and editing | PASS | New book, edits, pages, assets while disconnected. |
| 10 | Offline PDF | PASS, fallback path | Local browser print-to-PDF saved by Chromium; A5 dimensions and embedded fonts inspected. |
| 11 | Offline DOCX | PASS, scoped | Real local DOCX ZIP inspected for text, bidi XML, and embedded images; Word visual verification pending. |
| 12 | Backup and restore | PASS | Archive restored into a new ID; existing book retained. |
| 13 | Assets / structure / content | PASS, scoped | Images, chapters, settings, bundled fonts and ordering present; sample round-trip checked. |
| 14 | PWA manifest / worker | PASS | Controller active, manifest icons/display validated, offline navigation succeeds. |
| 15 | Android installation | NOT RUN | Requires a supported Android browser on a physical device and HTTPS deployment. |
| 16 | Responsive sizes | PASS, scoped | 1440px desktop, 768px tablet, and 390px phone viewport; mobile navigation/settings tested. |
| 17 | Console and interactions | PASS, scoped | No runtime page/console errors in main workflow; tested interactions pass, not exhaustive every-path audit. |
| 18 | Template change safety | PASS | Editor HTML identical before/after template application. |

## Additional exercised functionality

- Forward overflow pagination preserved every character of a 70-repeat mixed-language paragraph.
- Cursor-position manual page breaks, page duplicate/delete, undo/redo, asset library insertion, dynamic chapter-name updates in contents, revision-list availability, custom-template persistence, all five locale directions, dark mode, and mobile navigation.
- Invalid backups are rejected without losing existing projects.
- Optional server tests reject disallowed origins, missing access tokens, invalid payloads, and oversized requests. A real provider call was not made.

## Not certified

Physical PWA installation, additional browser engines, true linked footnotes, backward text reflow, complex tables crossing pages, complete five-language translation, native Word rendering, print-shop color/bleed compliance, exhaustive quota/crash simulation, high-volume books, and live AI assistance. See README for functional alternatives and limitations.

Screenshots and exported files are test artifacts, not seeded application content.

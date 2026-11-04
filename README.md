# KITAB STUDIO — کتاب سټوډیو

A working, offline-first book-writing PWA built with React, TypeScript, Vite, TipTap, Dexie/IndexedDB, docx, JSZip, DOMPurify, and Workbox. No account or cloud database is required. Pashto is the default interface language.

## Release status — read first

This is a runnable v1 implementation, **not a claim of complete production acceptance of the entire master specification**. Browser integration tests pass for the core publishing workflow. Real Android installation, physical-printer preflight, live Gemini responses, native Word round-tripping, and additional browser engines still require verification. See [QA and scope notes](qa/ACCEPTANCE.md).

The app is NOT an APK or native desktop binary. It is installable through supporting browsers as a PWA. It was run locally and tested in Chromium; no public deployment is included.

## Fastest way to run the included build

Install **Node.js 22.12+** (tested with 22.23.4), extract the ZIP, open a terminal in this folder, then:

~~~sh
node serve.mjs
~~~

Open **http://localhost:4173**. The included dist/ directory is already built; this command uses only Node's standard library and does not require npm packages or internet access. Keep this terminal running while initially loading/installing the PWA. Do NOT double-click dist/index.html: service workers require an HTTP(S) origin.

A different localhost port is a different storage origin and will not show the same books. Always return to the same protocol, host, and port. Export a backup before changing hosts.

## Install dependencies and rebuild from source

~~~sh
npm ci
npm run build
npm start
~~~

Initial npm installation requires internet. The built application's essential functions do not. Development mode:

~~~sh
npm run dev
~~~

The service worker is enabled in the **production build**, not in the Vite development server. Use npm run build followed by npm start (or npm run preview) for offline/PWA testing. The build must be served at the site root; subpath deployment requires updating Vite's base, the manifest scope/start URL, and asset paths together.

## Android, tablet, and desktop installation

1. Deploy the contents of dist/ to a static **HTTPS** host. localhost is allowed for desktop testing, but an Android phone opening an ordinary LAN HTTP address does not meet the secure-origin requirement.
2. Load the application online once and let its production service worker finish caching. Browser developer tools → Application → Service Workers/Cache Storage can verify this.
3. Android Chrome/Edge: browser menu → Install app / Add to Home screen. Desktop Chrome/Edge: address-bar install icon or browser menu → Install. An actual Install button is shown only when a beforeinstallprompt event is available.
4. Safari iOS/iPadOS: Share → Add to Home Screen, subject to platform storage limitations.
5. Reopen in standalone mode. Disconnect and confirm the offline notice, then create, edit, save, and export a test book.

Icons include 192px, 512px, maskable PNGs, and the original SVG. The manifest uses standalone display. Workbox precaches the app shell, JavaScript, CSS, icons, font files, and font licenses. Built-in templates are compiled into the offline bundle. All project images are data URLs inside IndexedDB book records or binary asset records.

## Working features

- Empty, functional bookshelf on first run, with search, collections, sorting, recent projects, rename, duplicate, delete confirmation, and backup actions. No fake seeded books are shipped.
- Six-step creation wizard: metadata, page dimensions/margins, templates, typography, covers, and creation. A4/A5/B5/Letter/6×9/5×8/custom sizes. Metadata is editable from the editor's gear button.
- 19 original built-in designs covering poetry, literature, education, and other book types. Template preview/application, custom template creation/duplication, persistent custom templates, and current-book layout capture. Template application preserves content and existing cover edits.
- Chapter/front-matter/back-matter management; page add, duplicate, delete, move, drag reordering, manual breaks at the cursor, and per-page/chapter/book styling.
- TipTap rich-text editing: headings, paragraphs, bold/italic/underline, colors, highlights, alignment, per-block RTL/LTR, lists, poetry/quote/caption/reference blocks, images, table insertion and row/column controls. Accessible block-up/down controls.
- Measured forward text flow creates additional pages and preserves inline HTML formatting. Oversized textual blocks split with DOM ranges. Content is never intentionally clipped or deleted.
- Automatically refreshed contents pages from chapter names and H2/H3 headings; Arabic or Roman-style numbering; odd/even chapter starts insert generated blank pages.
- Front, spine, and back cover panels with text/image/shape/barcode-placeholder elements; background/gradient controls; drag/keyboard positioning; size, font, and alignment fields; full spread preview. Spine estimates require user-supplied sheet caliper and remain editable.
- Asset library with local image validation, uploads, insertion, and removal. PNG/JPEG/WebP only, ≤8 MB per uploaded image and bounded dimensions.
- Debounced autosave, manual save, save state/time, per-session undo/redo, recovery journal, and 30 local revision snapshots. Ctrl/Cmd+S saves; Ctrl/Cmd+Alt+Z undoes a book-level change. TipTap supports its own normal text-edit undo shortcuts.
- Theme switching, responsive touch layouts, fit-to-screen mobile page zoom, language selection, and five locale directions.
- Local PDF via the browser's print engine, editable DOCX download, self-contained print-ready HTML, and project ZIP export/restore.
- Optional server-side Gemini assistance with explicit text-sharing consent, no automatic whole-book upload, an origin allowlist, access token, request limits, timeouts, and no frontend API key.

## Language and fonts

Pashto, Dari, Arabic, Urdu, and English are selectable. RTL is applied to Arabic-script locales; English uses LTR. Document blocks can independently override direction. Both Noto Naskh Arabic and Noto Sans Arabic (regular and bold) are bundled locally under their supplied SIL OFL licenses. Georgia/Arial are device-font options and may vary by OS.

**Localization is not complete:** the primary navigation and editing labels are translated, but some specialist controls, instructions, privacy/export explanations, template names, and decorative dashboard copy still appear in English, especially in Dari/Arabic/Urdu. Linguist review and full-string localization remain release work. Optional Nastaliq is not bundled.

Mixed-language text uses browser Unicode bidi processing. For a wholly English paragraph within an RTL book, select that paragraph and use the Block LTR control. The supplied Pashto test sentence was exercised in editor, print HTML/PDF, and DOCX XML.

## Saving and recovery

IndexedDB database: kitab-studio-v1. Tables: books, assets, templates, revisions. Uploaded images can also be embedded directly in the manuscript/cover, so moving pages does not break asset references.

Changes are journaled locally immediately where localStorage capacity permits; IndexedDB autosaves by default after 1 second. Large manuscripts may exceed journal capacity but still save through IndexedDB. Save errors remain visible. Keep the tab open and use Export → Complete project archive if saving fails. Recovery selects a newer journal over an older saved project on reopening.

Snapshots are taken on manual save and every 30 seconds while a book is open, capped at 30 per book. The browser may terminate a tab before an asynchronous save finishes; no web app can guarantee protection against every OS/storage failure. Keep independent backups.

Use Settings → Request persistent storage. Granting this is the browser's decision and is not guaranteed. Storage is scoped to the current browser profile and origin. Clearing browser data, private browsing, changing origin, uninstalling, or device loss can destroy local projects. Persistence is not backup.

## PDF and print-ready HTML

Editor → Export → Print / Save as PDF opens a font-embedded print document locally. The action is intentionally labelled Print / Save as PDF, not a fake direct-download button. In that window choose Print / Save as PDF, select the PDF destination, use 100% scale, remove browser-generated headers/footers, and inspect the page preview. Choose background graphics if the browser requires it for cover colors.

If popup restrictions block the window, enable popups for the application or download the **self-contained print-ready HTML** and open it. Font data and images are embedded in that file; no external font service is required. Chromium-generated acceptance.pdf was inspected for page dimensions, page count, and embedded Noto font subsets.

This is not a commercial print-preflight engine. It does not create CMYK/ICC-managed PDF/X, trim/bleed marks, licensed ISBN barcodes, or a printer-certified single-piece cover wrap. Confirm printer specifications separately. The spine preview is not included in the interior PDF; front/back covers are individual pages. Different browsers can paginate differently.

## DOCX

Exports local, editable Word documents with real text, headings, paragraph/run formatting, tables, inline images (WebP converted locally to PNG), RTL direction, section/page boundaries, headers, and page fields.

DOCX is an editable document, not a pixel-identical copy of the page/cover canvas. Decorative covers are simplified to text, absolute-positioned cover art is not reproduced, fonts are referenced rather than embedded, and Word can reflow content. Install corresponding fonts on the computer opening Word for closer typography. Native Microsoft Word/LibreOffice visual round-tripping has not been tested here.

## Backup and restore

Export → Complete project archive creates a .kitab.zip with book.json, manifest.json, custom templates, binary assets, project layout/cover settings, local font files, and licenses. Inline images are retained in book.json. Application-wide UI preferences and local revision history are not part of a single-book backup.

Dashboard → Backup & restore → Choose a Kitab backup validates the archive and restores it as a **new** project, never overwriting an existing book. Custom template IDs are remapped to avoid collisions. Local revisions are independent of external backups. Import limits: 80 MB compressed, 160 MB advertised expanded size, 2,000 pages, bounded templates/assets, sanitized document HTML, no external image sources. Extremely large books may need smaller images before backup/restore.

## Optional secure AI server

No AI server is needed for writing, storage, templates, or export. No real API credentials are included. The server is separate from the static PWA.

~~~sh
cp .env.example .env
# Set GEMINI_API_KEY, AI_ACCESS_TOKEN, ALLOWED_ORIGINS, and optional model/port.
npm run ai-server
~~~

For local testing, set the application's Settings → Trusted AI endpoint to http://localhost:8787/api/ai. When sending an explicitly consented selection, enter the server's AI_ACCESS_TOKEN. It is kept in the active request, not persisted in browser storage. The provider key stays server-side.

For deployment, terminate TLS at a trusted reverse proxy, keep the Node server on loopback, configure ALLOWED_ORIGINS to the exact deployed PWA origin, add deployment-appropriate access control and distributed rate limiting if multi-user, and use a secret manager. Do not expose .env or use VITE_-prefixed keys. The included single-process server is intended for a trusted/private deployment, not an unauthenticated public AI relay.

Only the explicitly entered/selected text and instruction are sent. Offline cloud actions are disabled. AI results are suggestions for review and can be downloaded; they do not silently replace manuscript content. A working configured provider account/model is needed to verify real response quality. API costs, support, and retention depend on the chosen provider.

## Architecture

~~~text
src/app/              Application state, routing, autosave coordination
src/components/       Accessible dialogs, controls, cover previews, layout fields
src/pages/            New-book wizard
src/editor/           TipTap page editor, book/page management, asset library
src/templates/        Original built-in template definitions
src/cover-designer/   Visual front/spine/back editing
src/export/           Browser print HTML/PDF, DOCX, ZIP backup and validation
src/storage/          Dexie schema, transactions, journal recovery, revisions
src/localization/     Locale dictionaries and language resolution
src/typography/       Local @font-face declarations
src/types/            Versioned project model
src/utils/            Sanitization, measurements, numbering, book structure
public/fonts/         Local licensed WOFF2 assets and OFL notices
public/icons/         Installable PWA icons
server/               Optional server-only AI endpoint and security tests
serve.mjs             Dependency-free included-build HTTP server
vite.config.ts        Manifest and production Workbox precaching
~~~

## Tests and screenshots

~~~sh
npx playwright install --with-deps chromium
npm run build
npm start                 # keep this terminal open
# in a second terminal:
npm test
npm run test:server
~~~

The supplied qa/ folder contains browser test results, screenshots, sample exports, a test HTML report, and the acceptance/status matrix. Screenshots use books created by the automated UI tests; production storage starts empty. No external AI/image-generation service was used to produce screenshots.

## Remaining scope and release caveats

- Physical Android/desktop installation and native OS behavior need real-device testing; mobile/tablet tests here are browser viewport tests, not hardware certification.
- Automatic pagination is forward-only. Removing text does not automatically pull content backward from later pages. Oversized tables/list blocks need manual splitting; the UI preserves and flags them instead of silently clipping them. Widows/orphans, advanced hyphenation, running cross-references, linked Word footnotes, and complex multi-column publishing are not implemented.
- Footnote blocks are inline manuscript notes, not linked automatic footnotes at each page bottom. Bibliography/reference blocks are editable text, not a citation-manager database.
- Template thumbnail cover motifs are original editorial previews; the cover designer's saved element scene is authoritative. Browser print/PDF is the visual export path, DOCX the editable path.
- Localization coverage, printer preflight, Word rendering, live AI, browser-storage failure simulation, large-book performance, and cross-engine accessibility audits are not complete.
- Runtime npm audit reports zero known production-dependency vulnerabilities at packaging time. The development PWA/Workbox build dependency tree has outstanding low/moderate advisories; see qa/dependency-audit.json. Do not describe the build toolchain as vulnerability-free or expose development servers publicly.
- The application is a usable local publishing workspace, but the above items preclude declaring every master-prompt acceptance criterion fully signed off.

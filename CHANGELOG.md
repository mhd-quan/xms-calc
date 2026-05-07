# Changelog

All notable changes to XMS Calculator are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [1.12.4] — 2026-05-07

### Fixed
- **Subtotal Row Spacing**: Rebalanced the discount row grid so meters, knobs, toggles, and inline subtotals distribute horizontally without leaving a large empty readout lane.
- **Savings Ring**: Rebuilt the bottom-bar savings meter as a full circular tick ring with a centered `% saved` readout and ratio-driven active ticks.
- **Version Display**: Updated the status bar version label to match the `1.12.4` PR.

## [1.12.3] — 2026-05-07

### Fixed
- **Discount Row Spacing**: Restored the wider v1.12.0-style discount control layout so the DISC toggle no longer floats after a large empty gap.
- **Discount Meter Masking**: Kept the step line visually cut at the meter frame instead of protruding beyond the box.
- **Savings Ring**: Rebuilt the bottom-bar savings visualization with a full visible tick scale and active ticks driven by aggregate Grand Total savings.
- **Version Display**: Updated the status bar version label to match the `1.12.3` PR.

## [1.12.1] — 2026-05-07

### Changed
- **Discount Visualization**: Reworked the meter frame toward the Ableton-style reference with a taller dark box, stronger grid, and step lines that overhang both ends.
- **Savings Ring**: Added a bottom-bar tick ring beside Grand Total to visualize the total savings ratio after all discounts.
- **Pricing Spacing**: Tightened pricing row spacing so inline subtotals sit closer to their controls instead of drifting to the far edge.
- **Bulk Add Modal**: Fixed clipped dropdowns and capped the modal height so large branch batches scroll while footer actions remain reachable.
- **Version Display**: Updated the status bar version label to match the packaged `1.12.1` release.

## [1.12.0] — 2026-05-06

### Changed
- **Responsive Layout**: Kept the workbench in its dense two-column layout longer for square and moderately narrow windows, with the discount visualization shrinking first instead of forcing the whole row to stack.
- **Discount Visualization**: Added an inset framed meter with grid cues and resize-safe canvas redraws so the discount level remains readable without stretched line artifacts.
- **Compact Sidebar**: Added a short-height sidebar mode with logo-only branding, branch cue tiles, and a two-letter quote-chain button that opens the current revision popover.
- **Bottom Bar**: Let the four subtotal groups switch to a 2x2 matrix at narrower widths while preserving the full-width bottom/status frame.
- **Version Display**: Updated the status bar version label to match the packaged `1.12.0` release.

## [1.11.4] — 2026-05-06

### Changed
- **Motion Refinement**: Added transition motion for button presses, dropdowns, date popups, modals, branch switching, branch creation, and bulk branch entry while respecting reduced-motion preferences.
- **Accent Glow**: Extended restrained breathing/glow treatments to active branch accent lines, branch color chips, discount lines, VU fills, and active discount toggles.
- **Performance**: Optimized sidebar branch rendering by removing per-row index scans and deferring branch entry animations until after the scheduled render frame.
- **Version Display**: Updated the status bar version label to match the packaged `1.11.4` release.

## [1.11.3] — 2026-05-05

### Changed
- **Discount Visualization**: Replaced the heavy automation-lane canvas with a cleaner step-line indicator. Disabled discounts render as washed gray, while enabled discounts use the section accent color and drop lower as the discount increases.

## [1.11.2] — 2026-05-05

### Added
- **Draft File Save**: Added `.xmsdraft` save/import support for full quote snapshots, including customer, prepared-by, calculator options, branches, and totals.

### Fixed
- **PDF Export Diagnostics**: Reworked quote template rendering so renderer errors are returned as explicit export failures instead of Electron's generic `Script failed to execute` wrapper.
- **Workbook Export Fidelity**: Embedded the full XMS manifest into exported workbooks so XLSX re-import preserves the complete editable quote data.
- **Export Flow Stability**: Unified PDF, workbook, and draft export preparation around one normalized/recomputed snapshot and guarded concurrent export actions.

## [1.11.1] — 2026-05-05

### Added
- **Global History System**: Robust Undo/Redo support (`Cmd+Z` / `Shift+Cmd+Z`) with persistent file-based caching (up to 30 steps).
- **Navigation Shortcuts**: Comprehensive keyboard framework including `Cmd+N` (New Quote), `Cmd+O` (Import), `Cmd+S` (Save), and sidebar branch navigation via arrow keys.
- **Coarse Knob Adjustments**: Added `Shift + Arrows` support for discount knobs to jump in ±10% increments (standard ±1% without Shift).

### Fixed
- **Export Bug**: Fixed a critical regression where pressing the "e" key triggered an Excel export. Export is now strictly bound to `Cmd+E` (PDF) and `Shift+Cmd+E` (Workbook).
- **History Management**: Implemented automatic cache purging on application startup and new quote creation to prevent state bloat.


## [1.11.0] — 2026-05-05

### Added
- Restored the "+" topbar button and dropdown containing New Quote, New Revision, and Import actions.
- Full XLSX import support: Quotes can now be reconstructed directly from previously exported `.xlsx` workbooks.

### Changed
- Wording for Export actions updated to "as Quota" (PDF) and "as Workbook" (Excel) to better reflect output types.
- Branch title (work view) UI overhaul: Font size doubled to 32px and background glow replaced with a sleeker, animated bottom border highlight.
- Re-calibrated branch color palette (`palette.css`) with richer, more vibrant tones to provide better contrast against the amber active state.

### Fixed
- Fixed an `export-quote` bug (`Script failed to execute` / `SyntaxError`) that occurred when a quote contained certain unescaped line terminators or characters by implementing double-JSON serialization for context bridging.

---

## [1.10.3] — 2026-05-05

### Fixed
- Disabled horizontal scrolling in the sidebar branch list to eliminate the unwanted scrollbar track consuming vertical space.
- Implemented auto-fading overlay vertical scrollbars for the sidebar to prevent layout shifts and maintain a clean UI.

---

## [1.10.2] — 2026-05-05

### Fixed
- Fixed a bug where the Export Dropdown menu would not open when clicked.
- Replaced the save icon with a proper export icon for clarity.

---

## [1.10.1] — 2026-05-05

### Added
- **Excel Export Support (`exceljs`)**: Replaced raw string parsing with native Excel formulas and layout matching the Fujimart reference.
- Unified Export UI Dropdown (combining PDF and XLSX exports) for better UX.

### Changed
- Replaced Arial font with **Aptos Display** across the entire Excel export for a cleaner modern look.
- Synced red highlight note texts with the design system token (`--p-rust-5: #c4604c`).

### Fixed
- Fixed CORS security block caused by ES Modules for `template-renderer.ts`, fully restoring PDF export rendering.
- Render strikethrough pricing natively in PDF exports for discounted stores.

---

## [1.9.1] — 2026-05-03

### Changed
- Increased size of strikethrough price in inline amounts (11px to 12.5px) and grand total (12px to 14px) for better legibility.
- Changed strikethrough color from \`ink-4\` to \`ink-5\` to blend more seamlessly with the dark background.
- Removed strikethrough pricing from the 4 bottombar breakdown cells to reduce visual clutter.

---

## [1.9.0] — 2026-05-03

### Added
- Strikethrough pricing across the entire pricing surface. When a discount is applied to any line item (QTG, QLQ, Account, Box), the original pre-discount price appears above the discounted price in a smaller, muted, line-through style.
- Bottombar breakdown cells (Q. Tác Giả, Q. Liên Quan, Tài khoản, Box) now show original pricing with strikethrough when respective discounts are active.
- Grand total area in the bottom bar displays the pre-discount total with strikethrough above the discounted+VAT total.
- Calculator engine now computes and propagates `*Original` values for all line items, subtotals, and grand total.

### Changed
- Bottom bar height increased from 52px to 64px to accommodate the two-line pricing layout (strikethrough + discounted).
- Inline amount readout layout changed from single-line baseline alignment to vertical column layout, allowing the strike price to sit above the current price while maintaining right-alignment.
- Version bumped from 1.8.14 to 1.9.0.

---

## [1.8.1] — 2026-05-02

### Fixed
- Fixed discount knob geometry so the indicator remains anchored across the full 0–100% range.
- Reduced knob drag and wheel sensitivity for controlled discount adjustment.
- Added per-knob discount apply toggles so stored discount values can be enabled or bypassed independently.
- Fixed the Tháng/Quý/Năm cycle selector so bottom totals, section totals, and active line amounts divide by 12, 4, or 1.
- Restored sidebar branch delete controls.
- Reworked the customer modal so it only saves customer profile data instead of exporting PDF immediately.
- Added macOS titlebar inset and restored a visible XMS brand mark in the topbar.
- Removed visible "Dark Ableton" status copy from the app chrome.

### Changed
- Tightened copyright row spacing to remove the void between discount knobs and amount readouts.
- Increased bottom bar total emphasis and made branch palette selection brighter.

---

## [1.8.0] — 2026-05-02

### Added
- Dark Ableton renderer design system with `tokens.css`, `palette.css`, `components.css`, and app-level layout composition.
- `x-*` component primitives for controls, dropdowns, datepicker, counters, knobs, VU meters, contextual InfoView, modals, and track rows.
- 70-color branch palette for content-led branch identity.
- Topbar quote-chain revision dropdown using reusable `x-track` rows.
- Design policy checks for tokens, class namespaces, motion, radius, and shadow constraints.

### Changed
- Renderer shell migrated to a 4-zone desktop frame: topbar, sidebar/workbench, bottombar, and statusbar.
- Calculation sections, branch list, bottom totals, and status surfaces now use the v1.8 Dark Ableton component contract.
- Discount controls moved to the knob-bank interaction model with drag, wheel, shift fine-adjust, and double-click reset.
- Context help moved into the persistent bottom-left InfoView.
- Revision selection moved out of sidebar history UI and into the topbar breadcrumb.
- `DESIGN.md` and `DESIGN-AUDIT.md` refreshed to match the implemented renderer system.

### Removed
- Legacy pulse/glow animations, elevation shadows, and non-canonical transition durations from renderer UI.
- Superseded design documentation that described the pre-v1.8 renderer language.

---

## [1.7.0] — 2026-04-25

### Added
- Full TypeScript project scaffolding with strict compiler configs (`tsconfig*.json`) and typed Electron contracts (`src/shared/types.ts`, `src/shared/preload-contract.d.ts`, `src/renderer/electron-api.d.ts`).
- Electron-Vite build pipeline and modernized npm scripts for typecheck/build/dev workflows.
- Policy and governance scripts for phase-gate validation, module boundaries, strict typing, and commit-convention checks.

### Changed
- Version bumped from `1.6.6` to `1.7.0`.
- Main, preload, renderer, shared logic, services, and tests migrated from JavaScript/CommonJS patterns to TypeScript module-based sources.
- Renderer loading path moved to bundler-driven module entry (`src/renderer/app.ts`) while preserving application behavior and UI output.
- Documentation updated for architecture and migration execution notes aligned with the TypeScript baseline.

### Removed
- Legacy runtime dependence on browser globals for calculator/payload/identity modules in active source flow.
- Active test/runtime reliance on `.js` source files in `src/` and `test/` (replaced by `.ts` counterparts).
- Pre-migration JavaScript snapshot under `archive/pre-ts-1.6.6/`; use the `v1.6.6` tag for historical source comparison.

### Unchanged
- Core calculator business formulas and ND 17/2023 pricing logic behavior remain unchanged.
- Quote template visual output and branding assets remain functionally unchanged.
- Application domain scope and major user workflows (calculation, quote generation, persistence, PDF export/import) remain unchanged.

---

## [1.6.6] — 2026-04-24

### Changed
- Repository reorganized into `src/`, `assets/`, `build/`, `docs/` structure.
- `package.json` cleaned: deduplicated `dependencies` block, added `engines`, `repository`, `author`, `bugs`, `homepage` fields; expanded `scripts`.
- Repo renamed to `xms-calculator`.
- License declared as UNLICENSED (proprietary).

### Removed
- Legacy React prototype (`xms-royalty-calculator.jsx`) moved to `archive/legacy-prototype/`. Not built, not loaded.
- `dist/` untracked from git; build output is now fully ignored.

---

## [1.6.5] — 2026-04-23

### Added
- PDF import service (`pdf-import-service.js`): parses embedded manifests, fingerprinting, revision conflict detection.
- Quote identity service (`quote-identity-service.js`): quote code generation and sequence management.
- Quote repository (`quote-repository.js`): SQLite-backed quote persistence.
- End-to-end workflow test (`test/quote-workflow.test.js`).

### Changed
- Optimized quote export renderer snapshots.
- `quote-exporter.js` and `quote-payload.js` refactored in line with new services split.

_(Commits `44753d3` through `c9b2a01`)_

---

## [1.5.0] — 2026-04-23

### Added
- Partner-ready quotation PDF export with NCT branding.
- Ableton-style neutral quotation shell (light theme, Lexend font).

### Changed
- Multiple style passes: PDF typography, background tone, color noise reduction, layout refinement.

_(Commits `51a3a2c` through `d0866d0`)_

---

## [1.4.1] — 2026-04-23

### Added
- Bulk branch input grid for multi-location clients.
- Branch accent color system in bulk rows.
- Topbar action accent diversification.

_(Commits `6549cc1` through `9a5372b`)_

# Changelog

All notable changes to XMS Calculator are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

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

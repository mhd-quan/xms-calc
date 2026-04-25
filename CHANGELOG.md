# Changelog

All notable changes to XMS Calculator are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [1.7.0] — 2026-04-25

### Added
- Full TypeScript project scaffolding with strict compiler configs (`tsconfig*.json`) and typed Electron contracts (`src/shared/types.ts`, `src/shared/preload-contract.d.ts`, `src/renderer/electron-api.d.ts`).
- Electron-Vite build pipeline and modernized npm scripts for typecheck/build/dev workflows.
- Policy and governance scripts for phase-gate validation, module boundaries, strict typing, and commit-convention checks.
- Archived pre-migration JavaScript snapshot under `archive/pre-ts-1.6.6/` for historical reference.

### Changed
- Version bumped from `1.6.6` to `1.7.0`.
- Main, preload, renderer, shared logic, services, and tests migrated from JavaScript/CommonJS patterns to TypeScript module-based sources.
- Renderer loading path moved to bundler-driven module entry (`src/renderer/app.ts`) while preserving application behavior and UI output.
- Documentation updated for architecture and migration execution notes aligned with the TypeScript baseline.

### Removed
- Legacy runtime dependence on browser globals for calculator/payload/identity modules in active source flow.
- Active test/runtime reliance on `.js` source files in `src/` and `test/` (replaced by `.ts` counterparts).

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

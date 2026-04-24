# Changelog

All notable changes to XMS Calculator are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

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

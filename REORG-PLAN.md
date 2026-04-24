# REORG-PLAN.md — XMS Calculator v1.6.5

**Target executor:** downstream coding agent (not the planning agent).
**Owner:** Archie (intelligence@delphyra.com).
**Repo root:** `/Users/mhdquan/Desktop/BD Calc/` (to be renamed at Phase 0, see §2).
**Current state:** Electron app, local git with 4 branches, no remote, currently on `feature/v1.6-revisioned-pdf-import` with uncommitted changes and untracked files. Version 1.6.5 in `package.json`.

Read this file top to bottom before executing anything. Each phase has acceptance criteria. **Do not merge phases.** Each phase = one commit (or one PR once remote is wired).

---

## 0. Hard rules for the executor

1. **Never delete a file without Archie's explicit approval.** Move-to-`/archive` is allowed; `rm` is not.
2. **Branch discipline:** create `chore/repo-reorg` off current branch before touching anything. Do not reorg directly on `main` or on any `feature/*` branch.
3. **Every phase ends with a green `npm test`.** If a phase breaks tests, stop and report.
4. **Commit messages** follow Conventional Commits (existing repo already uses this style: `feat:`, `chore:`, `style:`, `refactor:`).
5. **Do not touch** the actual calculation logic (`calculator.js`), legal constants, or the ND 17/2023 reference math. This reorg is mechanical only.
6. **Do not refactor CSS** in this pass. Design work in Phase 6 is **audit only** (write DESIGN-AUDIT.md, do not edit `styles.css` or `template.css`).
7. **Low confidence items are tagged `[CONFIRM]`.** Stop and ask Archie before executing those.

---

## 1. Current state inventory (as of 2026-04-24)

### Top-level files
| File | Size | Role | Action |
|---|---|---|---|
| `main.js` | 9.7KB | Electron main process | → `src/main/` |
| `preload.js` | 772B | Electron preload | → `src/main/` |
| `app.js` | 49KB / 1413 LOC | Renderer entry (monolith) | → `src/renderer/` (no split in this pass) |
| `calculator.js` | 6.8KB | Pure royalty math | → `src/shared/` |
| `pdf-import-service.js` | 7.2KB | PDF parsing | → `src/services/` |
| `quote-exporter.js` | 6.9KB | PDF export | → `src/services/` |
| `quote-identity-service.js` | 2.1KB | Quote ID generation | → `src/services/` |
| `quote-payload.js` | 6.1KB | Quote data shape | → `src/services/` |
| `quote-repository.js` | 12.5KB | Quote persistence | → `src/services/` |
| `index.html` | 33KB | Renderer shell | → `src/renderer/` |
| `styles.css` | 46KB / 1279 LOC | App styles | → `src/renderer/styles/` |
| `vendor/gsap-lite.js` | 3.2KB | Animation lib | → `src/renderer/vendor/` |
| `quote-template/` | 22KB | PDF template + fonts | → `src/templates/quote/` |
| `test/*.js` | 2 files | Node test runner | stays at `test/` (root) |
| `xms-royalty-calculator.jsx` | 40KB | **Legacy React prototype** | → `archive/legacy-prototype/` |
| `17-cp.signed (1).pdf` | 5.2MB | ND 17/2023 decree reference | → `docs/reference/nd-17-2023.pdf` (rename, remove space + `(1)`) |
| `NCT - Brand Guidelines (1).pdf` | 12MB | NCT brand book | → `docs/reference/nct-brand-guidelines.pdf` |
| `NCT - Main logo 512.png` | 51KB | Brand asset | → `assets/brand/nct-logo-512.png` |
| `signature.png` | 135KB | Export signature | → `assets/brand/signature.png` |
| `512x512@2x.icns` | 436KB | macOS app icon | → `build/icons/app.icns` (electron-builder convention) |
| `DESIGN.md` | 4KB | Ableton design spec | stays at root |
| `package.json` | 889B | npm manifest | edit in Phase 3 (dup key fix + paths) |
| `package-lock.json` | 144KB | npm lockfile | stays, regenerate after path edits |
| `.gitignore` | 77B | git ignore rules | extend in Phase 2 |
| `dist/` | build output | **tracked by mistake** (`.DS_Store` committed) | `git rm -r --cached dist/` + keep ignored |

### Git state
- Branch: `feature/v1.6-revisioned-pdf-import`.
- Uncommitted: 12 modified files + 4 untracked files (new services: `pdf-import-service.js`, `quote-identity-service.js`, `quote-repository.js`, `test/quote-workflow.test.js`).
- Remote: none.
- Last tag: none (should tag `v1.4.1` retroactively per commit `9a5372b`, and the current `v1.6.5` state after reorg).

### Broken bits found
1. `package.json` declares the `dependencies` key **twice** (lines 19–21 and 39–41). Second one wins, but linters and some tooling will warn. Fix in Phase 3.
2. `dist/.DS_Store` is tracked. Untrack in Phase 2.
3. Folder name `BD Calc` has a space — fine on macOS, breaks a lot of CI and some git tools. Rename to `bd-calc` or `xms-calculator` at Phase 0 (see §2). `[CONFIRM]` repo name choice.

---

## 2. Proposed final tree

```
xms-calculator/                          # renamed from "BD Calc"
├── .github/
│   └── workflows/
│       └── test.yml                     # Phase 7 (deferred, optional)
├── .gitignore
├── .gitattributes                       # Phase 2 (line endings, binary flags)
├── DESIGN.md
├── DESIGN-AUDIT.md                      # Phase 6 output
├── README.md                            # Phase 5
├── CHANGELOG.md                         # Phase 5
├── LICENSE                              # Phase 5 [CONFIRM license]
├── package.json
├── package-lock.json
│
├── src/
│   ├── main/
│   │   ├── main.js
│   │   └── preload.js
│   ├── renderer/
│   │   ├── index.html
│   │   ├── app.js
│   │   ├── styles/
│   │   │   └── styles.css
│   │   └── vendor/
│   │       └── gsap-lite.js
│   ├── services/
│   │   ├── pdf-import-service.js
│   │   ├── quote-exporter.js
│   │   ├── quote-identity-service.js
│   │   ├── quote-payload.js
│   │   └── quote-repository.js
│   ├── shared/
│   │   └── calculator.js
│   └── templates/
│       └── quote/
│           ├── template.html
│           ├── template.css
│           ├── assets/
│           └── fonts/
│
├── assets/
│   └── brand/
│       ├── nct-logo-512.png
│       └── signature.png
│
├── build/
│   └── icons/
│       └── app.icns                     # renamed from 512x512@2x.icns
│
├── docs/
│   ├── reference/
│   │   ├── nd-17-2023.pdf
│   │   └── nct-brand-guidelines.pdf
│   └── architecture.md                  # Phase 5 (light; links core modules)
│
├── archive/
│   └── legacy-prototype/
│       └── xms-royalty-calculator.jsx
│
├── test/
│   ├── calculator.test.js
│   └── quote-workflow.test.js
│
└── dist/                                # ignored, build output only
```

---

## 3. Execution phases

Each phase is one commit. After every phase: `npm test` must pass. If not, revert and report.

### Phase 0 — Pre-flight (no code changes)

**Goal:** clean working tree, safety branch, tag the current working state.

Steps:
1. `git status` — confirm we're on `feature/v1.6-revisioned-pdf-import`.
2. Commit the current uncommitted work first. Use message: `chore(v1.6.5): checkpoint before reorg`. This preserves the "it works" state.
3. Tag it: `git tag v1.6.5-pre-reorg`. This is the rollback target.
4. Create the reorg branch: `git checkout -b chore/repo-reorg`.
5. Run `npm install && npm test`. Record pass/fail baseline.

**Acceptance:** clean `git status`, tag exists, tests green.

**`[CONFIRM]` with Archie:**
- New repo/folder name. Options: `xms-calculator` (matches `name` in package.json), `xms-royalty-calculator`, `bd-calc`. Recommend **`xms-calculator`**.
- Whether to rename the on-disk folder too, or only the git repo name when pushing. Renaming the folder breaks whatever shortcut/terminal history Archie has pointed at `/Users/mhdquan/Desktop/BD Calc/`.

---

### Phase 1 — Archive the legacy prototype

**Goal:** get the 40KB stale JSX file out of root without losing it.

Steps:
1. `mkdir -p archive/legacy-prototype`
2. `git mv "xms-royalty-calculator.jsx" archive/legacy-prototype/`
3. Add `archive/README.md`:
   ```
   # Archive
   Code preserved for historical reference. Not built, not tested, not loaded.
   - legacy-prototype/xms-royalty-calculator.jsx: React prototype predating the Electron port. Kept for calc logic reference only.
   ```
4. Commit: `chore(archive): move legacy React prototype to /archive`.

**Acceptance:** root no longer contains the JSX file; `npm test` green.

---

### Phase 2 — Fix .gitignore, untrack dist, add .gitattributes

**Goal:** stop tracking build artifacts and OS junk; normalize line endings.

Steps:
1. Extend `.gitignore`:
   ```
   # Existing
   node_modules/
   dist/
   .DS_Store
   npm-debug.log*
   yarn-debug.log*
   yarn-error.log*

   # Add
   *.log
   .env
   .env.local
   .vscode/
   .idea/
   *.swp
   *.swo
   .cache/
   out/
   release/
   coverage/
   ```
2. Untrack files already committed but should be ignored:
   ```
   git rm -r --cached dist/
   git rm --cached .DS_Store 2>/dev/null || true
   find . -name ".DS_Store" -not -path "./node_modules/*" -not -path "./.git/*" -exec git rm --cached {} \; 2>/dev/null || true
   ```
3. Add `.gitattributes`:
   ```
   * text=auto eol=lf
   *.png binary
   *.pdf binary
   *.icns binary
   *.ttf binary
   *.otf binary
   *.woff binary
   *.woff2 binary
   ```
4. Commit: `chore(git): untrack dist, extend ignore, add gitattributes`.

**Acceptance:** `git ls-files | grep -E "^dist/"` returns empty; `npm test` green.

---

### Phase 3 — Restructure source tree

**Goal:** physical move of files into `src/`, `assets/`, `build/`, `docs/` per §2. Edit path references. **Do not change logic.**

Steps (in order, one atomic commit):
1. Create directories:
   ```
   mkdir -p src/main src/renderer/styles src/renderer/vendor src/services src/shared src/templates/quote
   mkdir -p assets/brand build/icons docs/reference
   ```

2. Move files with `git mv` (preserves history):
   ```
   git mv main.js src/main/main.js
   git mv preload.js src/main/preload.js
   git mv app.js src/renderer/app.js
   git mv index.html src/renderer/index.html
   git mv styles.css src/renderer/styles/styles.css
   git mv vendor/gsap-lite.js src/renderer/vendor/gsap-lite.js
   rmdir vendor
   git mv calculator.js src/shared/calculator.js
   git mv pdf-import-service.js src/services/pdf-import-service.js
   git mv quote-exporter.js src/services/quote-exporter.js
   git mv quote-identity-service.js src/services/quote-identity-service.js
   git mv quote-payload.js src/services/quote-payload.js
   git mv quote-repository.js src/services/quote-repository.js
   git mv quote-template/template.html src/templates/quote/template.html
   git mv quote-template/template.css src/templates/quote/template.css
   git mv quote-template/assets src/templates/quote/assets
   git mv quote-template/fonts src/templates/quote/fonts
   rmdir quote-template
   git mv "NCT - Main logo 512.png" assets/brand/nct-logo-512.png
   git mv signature.png assets/brand/signature.png
   git mv "512x512@2x.icns" build/icons/app.icns
   git mv "17-cp.signed (1).pdf" docs/reference/nd-17-2023.pdf
   git mv "NCT - Brand Guidelines (1).pdf" docs/reference/nct-brand-guidelines.pdf
   ```

3. Update `package.json`:
   - Fix the duplicate `dependencies` key (keep one).
   - Update `main` field: `"main": "src/main/main.js"`.
   - Update `build.files` glob:
     ```json
     "files": [
       "src/**/*",
       "!src/**/*.map"
     ]
     ```
   - Update `build.mac.icon`: `"build/icons/app.icns"`.
   - Keep version at `1.6.5` (do NOT bump for a reorg; bump to `1.6.6` only after green tests in Phase 4).

4. Update `test/*.js` imports. Scan for `require('./...')` patterns. Expected edits:
   - `test/calculator.test.js`: `require('../calculator')` → `require('../src/shared/calculator')`.
   - `test/quote-workflow.test.js`: scan and fix all relative requires.

5. Update cross-references inside `src/`:
   - `src/main/main.js`: any `require('./preload')`, `require('./calculator')`, `require('./pdf-import-service')`, etc. — remap:
     - `./preload` stays (same folder).
     - `./calculator` → `../shared/calculator`.
     - `./pdf-import-service` → `../services/pdf-import-service`.
     - `./quote-*` → `../services/quote-*`.
     - `BrowserWindow.loadFile('index.html')` → `loadFile(path.join(__dirname, '../renderer/index.html'))`.
     - Any path to `quote-template/` → `src/templates/quote/` (use `__dirname` + relative).
   - `src/renderer/app.js`: no requires (Electron renderer). But any `fetch('./quote-template/...')` or hardcoded asset paths need remapping. Scan for: `quote-template`, `signature.png`, `NCT`, `vendor/`.
   - `src/renderer/index.html`: `<link href="styles.css">` stays (same folder after move). `<script src="app.js">` stays. `<script src="vendor/gsap-lite.js">` stays (folder moved as unit).
   - `src/services/quote-exporter.js` and `src/services/pdf-import-service.js`: likely reference `quote-template/` and `assets/`. Scan and remap. Use `path.join(__dirname, '../templates/quote/...')` and `path.join(__dirname, '../../assets/brand/...')`.

6. Regenerate lockfile: `rm package-lock.json && npm install`.

7. Run `npm test`. Run `npm start` manually to confirm the app boots and one end-to-end flow works (create quote, export PDF).

8. Commit: `refactor(structure): reorganize source into src/, assets/, build/, docs/`.

**Acceptance:** `npm test` green, `npm start` launches the app, one manual quote export works. If ANY of these fail, abort and report the failing path. Do NOT continue to Phase 4 until this is rock solid.

**Known risk:** path references inside `quote-exporter.js` and `pdf-import-service.js` for loading the HTML template and signature image. Grep for these strings before moving, so you know what to rewrite:
```
grep -rnE "quote-template|signature\.png|NCT|vendor/" src/ test/
```

---

### Phase 4 — package.json hygiene + version bump

**Goal:** ship a clean manifest.

Steps:
1. Remove duplicate `dependencies` block.
2. Add `author`, `repository`, `bugs`, `homepage` fields. Leave repo URL as placeholder `TBD` if no GitHub URL yet; fill in Phase 7.
3. Add `engines` field: `"engines": { "node": ">=20" }` (electron 41 requires Node 20+).
4. Bump version to `1.6.6` (patch for the reorg — no feature, no breaking change).
5. Add npm scripts:
   ```json
   "scripts": {
     "start": "electron .",
     "test": "node --test test/",
     "test:watch": "node --test --watch test/",
     "pack": "electron-builder --dir",
     "dist": "electron-builder",
     "dist:mac": "electron-builder --mac"
   }
   ```
6. Commit: `chore(package): clean manifest, bump to 1.6.6`.
7. Tag: `git tag v1.6.6`.

**Acceptance:** `npm test` green, `npm start` works.

---

### Phase 5 — Repository documentation

**Goal:** make the repo legible to a stranger (or to Archie six months from now).

Files to create at root:

1. **`README.md`** — ~150 lines max. Sections:
   - Title + one-line description ("Royalty calculator for XMusic Station per ND 17/2023, Vietnam").
   - Screenshot placeholder (Archie can drop one in later).
   - Feature list (terse, bullet-free prose).
   - Tech stack: Electron 41, vanilla JS (no framework), Node test runner, pdf-lib, electron-builder.
   - Install & run: `npm install`, `npm start`.
   - Test: `npm test`.
   - Build: `npm run dist:mac` → `dist/*.dmg`.
   - Directory layout (copy the tree from §2).
   - Versioning: see CHANGELOG.md.
   - License: see LICENSE.

2. **`CHANGELOG.md`** — Keep a Changelog format. Reconstruct from git log. Entries the executor can extract mechanically:
   ```
   ## [1.6.6] - 2026-04-24
   ### Changed
   - Repository reorganized into src/, assets/, build/, docs/ structure.
   - package.json cleaned (deduplicated dependencies, added engines/scripts).
   ### Removed
   - Legacy React prototype moved to /archive.

   ## [1.6.5] - 2026-04-23
   - Revisioned PDF import service; quote identity + repository split.
   - (see git log for commits d0866d0..c9b2a01)

   ## [1.5.0] - 2026-04-22
   - Partner-ready quotation PDF export.
   - Ableton-style neutral quotation shell.

   ## [1.4.1] - earlier
   - Bulk branch input grid, branch accent colors.
   ```
   Pull commit subjects from `git log --oneline` and group under version tags. Do not fabricate dates — if a date is unknown, leave as TBD.

3. **`LICENSE`** — `[CONFIRM]` with Archie which license. Default recommendation: `MIT` (current package.json says `ISC`, inconsistent with having no LICENSE file). If private/proprietary, use a `UNLICENSED` marker with a short copyright notice.

4. **`docs/architecture.md`** — ~60 lines. Describe:
   - Process model: main (`src/main/main.js`) ↔ renderer (`src/renderer/`) via preload (`src/main/preload.js`).
   - Module map: calculator (pure), services (stateful), templates (presentation).
   - Data flow: user input → app.js state → calculator → quote-payload → quote-repository (persist) / quote-exporter (PDF).
   - Dependency graph (ASCII or mermaid block).

5. **`.github/PULL_REQUEST_TEMPLATE.md`** — simple template with: what, why, screenshots, testing done, version impact.

Commit: `docs: add README, CHANGELOG, architecture, license`.

**Acceptance:** all 5 files exist; `npm test` still green.

---

### Phase 6 — Design language audit (no code changes)

**Goal:** produce `DESIGN-AUDIT.md` at repo root, comparing actual code vs. `DESIGN.md` spec. This is **read-only**; no CSS edits.

The agent should read:
- `DESIGN.md` (the spec, Ableton-inspired).
- `src/renderer/styles/styles.css` (app).
- `src/templates/quote/template.css` (PDF export).
- `src/renderer/index.html` (for font loading + structure).
- `src/templates/quote/template.html`.

Output sections for `DESIGN-AUDIT.md`:

1. **Executive summary.** One paragraph. Does the app + PDF template cohere as one design system, or do they diverge? (Preview finding: they diverge. App uses dark Ableton theme with `#1e1e22` + Space Grotesk + pear/picton accents. PDF template uses light neutral `#f8f8f6` + Lexend. Two separate languages — intentional for PDF legibility, but not documented anywhere.)

2. **Color palette compliance.**
   - DESIGN.md specs: `#212121` bg, `#323232` panel, `#454545` control, `#cccccc` text, `#ff9e00` active.
   - styles.css actual: `#1e1e22` bg-root, `#28282e` elevated, `#e8e8ec` text-primary, `#FF8B00` daw-orange, plus **two extra accents not in spec**: pear `#CFF533` and picton `#44CCFF`.
   - Verdict: palette is **adjacent to** DESIGN.md, not compliant. Tonally darker + more saturated + more accents.
   - Recommendation: decide one of: (a) update DESIGN.md to match shipped code (styles.css is the source of truth — this is honest about divergence); (b) refactor styles.css to match DESIGN.md (larger scope, Phase 8+).

3. **Typography compliance.**
   - DESIGN.md specs: "condensed sans-serif (Ableton Sans or Inter/Helvetica)", sizes 9–14px, uppercase headers.
   - styles.css actual: Space Grotesk 300–700 via Google Fonts, tabular nums enabled, `letter-spacing: -0.01em`.
   - PDF template actual: Lexend 400/600/900 self-hosted as .ttf.
   - Verdict: **three fonts across two contexts** (Space Grotesk app, Lexend PDF + app fallback, system-ui fallback). Not condensed. Legible but not Ableton.
   - Recommendation: pick one display font system. If PDF must stay Lexend for embed reliability, document the split explicitly.

4. **Visual flatness compliance.**
   - DESIGN.md specs: "No Drop Shadows. Completely flat. Depth via value changes only."
   - styles.css actual: multiple `box-shadow` uses including `0 14px 36px rgba(0,0,0,0.35)` (line 365), `0 4px 12px rgba(207,245,51,0.15)` (line 431), `0 10px 30px rgba(0,0,0,0.5)` (line 596), glow rings on focus states.
   - Verdict: **non-compliant**. Shipped app has shadows + glows. Glow rings on focus (line 582, 617) are DAW-plugin adjacent but not Ableton Live — Ableton uses flat outline.
   - Recommendation: either accept glows as a deliberate departure (document in DESIGN.md as a "glass/glow" extension), or plan a de-glow pass.

5. **Rounded corners compliance.**
   - DESIGN.md specs: "no rounded corners (or 2px minimum for buttons)".
   - styles.css actual: `border-radius: 2px`, `3px`, `4px`, `8px`, `10px`, `12px`, `999px` in use.
   - Verdict: **non-compliant**. Pill shapes (999px) and 12px radii (line 363) are explicitly outside spec.
   - Recommendation: cap at 3px for rectangles, `999px` only for explicit pill badges. Note which components use >3px and whether each is justified.

6. **Information density.**
   - DESIGN.md specs: "maximum UI surface area usable, minimize whitespace".
   - Need on-screen measurement. Executor should note qualitative observation only (no screenshots required).

7. **Component-level gap list.** Short table per component, flagging deviations. Rows: topbar, dropdown, datepicker, bulk grid, quote card, PDF template header. Columns: component, DESIGN.md rule violated, file:line, severity (low/med/high), suggested fix (one sentence).

8. **PDF template ↔ app divergence.** Explicit section. The PDF template is intentionally light-theme for print, which is correct — but needs to be **declared** in DESIGN.md as "PDF output = light variant" with its own palette + typography locked.

9. **Recommendations ranked by leverage.** Three tiers:
   - **Tier 1 (cheap, high impact):** document PDF-light as an official variant in DESIGN.md; cap border-radius at 3px (global find-replace with spot review).
   - **Tier 2 (medium):** consolidate typography down to one app font (Space Grotesk) + one PDF font (Lexend), document the split; deprecate shadow-heavy surfaces or rewrite DESIGN.md to acknowledge them.
   - **Tier 3 (heavy):** full palette realignment, full flatness pass — scope to a dedicated refactor milestone.

Commit: `docs: add DESIGN-AUDIT.md`.

**Acceptance:** file exists, covers all 9 sections, cites file:line for claims.

---

### Phase 7 — Remote setup (deferred, separate session)

**Goal:** push to GitHub (or GitLab/Gitea per Archie's preference). **Do not execute this phase automatically.** Archie runs this manually after reviewing Phases 0–6.

Steps (for Archie's reference, not the agent):
1. Create empty repo on GitHub: `xms-calculator`, private.
2. `git remote add origin git@github.com:<archie>/xms-calculator.git`.
3. `git push -u origin main` (after merging `chore/repo-reorg` into `main`).
4. Push tags: `git push --tags`.
5. Push feature branches: `git push origin feature/v1.6-revisioned-pdf-import` etc.
6. Optionally: enable branch protection on `main`, require PR + green tests.
7. Optionally: add `.github/workflows/test.yml` for CI (matrix: macos-latest, node 20, run `npm ci && npm test`).
8. Update `package.json` `repository` and `bugs` fields with the real URL.

**`[CONFIRM]` with Archie before Phase 7:**
- Host: GitHub, GitLab, self-hosted Gitea, or desktop-only tracker (Fork / Tower)?
- Visibility: private (recommended — this contains client-facing quote logic and brand assets) or public?
- Whether to strip the signed decree PDF (`nd-17-2023.pdf`) before pushing if remote is public. It's a government document so legally fine to redistribute, but check if the signed copy carries any identifying metadata.

---

## 4. Rollback plan

If any phase breaks and recovery via git takes >15 minutes:
1. `git checkout v1.6.5-pre-reorg` (the tag set in Phase 0).
2. `git branch -D chore/repo-reorg` (destroy the failed branch).
3. Report to Archie which phase failed and at which step.

---

## 5. Out of scope (explicit non-goals)

This reorg does NOT include:
- Splitting the 1413-LOC `app.js` monolith (separate refactor, post-v1.7).
- Splitting the 1279-LOC `styles.css` into component files (tied to design refactor).
- Introducing TypeScript, a bundler, or a framework.
- Adding ESLint / Prettier (opinionated — defer until Archie picks a style).
- Cleaning up the git history (no `git filter-branch` / `git filter-repo`; history stays as-is. If binaries become a size problem later, that's a separate operation with BFG).
- Internationalization, accessibility audit, security review.
- CI/CD pipelines (placeholder only in Phase 7).

---

## 6. Confidence levels

| Item | Confidence | Basis |
|---|---|---|
| Directory structure in §2 is standard-correct | Highly Confident | Matches common Electron app conventions (electron-builder docs, Electron Forge templates). |
| `git mv` path translations in Phase 3 will compile | Moderately Confident | Requires grep-and-remap step; any missed relative path will break at runtime. Phase 3 explicitly gates on `npm start` working. |
| Design audit findings in Phase 6 | Highly Confident | Line numbers and hex codes cited are from direct read of `styles.css`. |
| `xms-royalty-calculator.jsx` is truly dead code | Moderately Confident | Not referenced from `main.js`, `index.html`, or `app.js` in quick scan. Executor should `grep -r "xms-royalty-calculator"` in Phase 1 to double-check before archiving. |
| v1.6.5 is a clean state to branch from | Speculative | There are uncommitted changes. Phase 0 handles this by committing first. |
| Archie will keep repo private | Highly Confident | Client quote logic + brand assets; no reason to open-source. |

---

## 7. TL;DR for the executor

1. `chore/repo-reorg` branch off current HEAD, after committing + tagging current state.
2. Archive the stale JSX.
3. Fix .gitignore and untrack `dist/`.
4. Move everything into `src/ / assets/ / build/ / docs/`. Rewrite paths in `main.js`, `package.json`, tests, and services. Green tests are the gate.
5. Clean `package.json`, bump to 1.6.6, tag.
6. Write README, CHANGELOG, architecture doc.
7. Write DESIGN-AUDIT.md — audit only, no CSS edits.
8. Stop. Hand back to Archie for remote setup.

One commit per phase. `npm test` green after every phase. Ask before anything tagged `[CONFIRM]`. Do not delete files.

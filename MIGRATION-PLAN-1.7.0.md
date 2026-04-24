# MIGRATION-PLAN-1.7.0.md — XMS Calculator TypeScript Migration

**Target executor:** downstream coding agent (not the planning agent).
**Owner:** Archie (intelligence@delphyra.com).
**Repo root:** `/Users/mhdquan/Desktop/xms-calc/`.
**Baseline version:** `1.6.6` (post-reorg state, see `REORG-PLAN.md` for prior history).
**Target version:** `1.7.0`.
**Scope:** mechanical language migration from JavaScript to TypeScript. Zero UI change, zero business-logic change, zero behaviour change. Add compile-time types, swap runtime loader (`<script>` tags → bundler), add lint+format tooling.

Read this file top to bottom before touching anything. Each phase has explicit acceptance criteria. **Do not merge phases.** One phase = one commit (or one PR).

---

## 0. Hard rules for the executor

1. **Never delete files without Archie's explicit approval.** `.js → .ts` via `git mv` (rename preserving history) is allowed because it is a rename, not a deletion. A full pre-migration snapshot MUST be copied to `archive/pre-ts-1.6.6/` at Phase 0 before any rename. `rm`, `git rm`, or destructive delete of tracked content requires explicit approval.
2. **Branch discipline:** work on `feat/v1.7.0-typescript-migration` off `main`. Do not rebase or force-push once pushed.
3. **No UI changes. No business logic changes.** Do not touch:
   - `src/shared/calculator.js` math (ND 17/2023 coefficient tables, price constants).
   - `src/renderer/styles/styles.css` (1279 LOC, no edits).
   - `src/templates/quote/template.css` (508 LOC, no edits).
   - `src/templates/quote/template.html` rendering DOM (structure untouched; the inline `<script>` block at the bottom is allowed to stay as vanilla JS — see §7.3).
   - `src/renderer/index.html` DOM structure (element IDs, classes, layout). Only the `<script>` tag loader block at `<head>` / pre-`</body>` may be swapped to a single module tag.
4. **Every phase ends with green `npm test`** and a running app (`npm run dev`). If a phase breaks tests, stop and report; do not roll forward.
5. **Commit convention:** Conventional Commits (`feat:`, `chore:`, `refactor:`, `test:`, `build:`, `docs:`).
6. **TypeScript config:** `strict: true` non-negotiable across all configs. `noImplicitAny`, `strictNullChecks`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` all ON. If this produces more than ~50 errors in any single phase, stop and escalate rather than adding blanket `any`.
7. **No `any` in production code.** `unknown` + type guards, or named types. `any` allowed only in `.d.ts` ambient declarations for third-party gaps that cannot be resolved in reasonable time; each use must carry a `// TODO(ts-1.7.1): replace any` comment with file/line reference.
8. **Low confidence items are tagged `[CONFIRM]`.** Stop and ask Archie before executing.

---

## 1. Current state inventory (baseline 1.6.6)

### Source tree (non-binary files only)

| File | LOC | Module system | Loaded as | Target |
|---|---|---|---|---|
| `src/main/main.js` | 306 | CommonJS | Electron main process | `src/main/main.ts` |
| `src/main/preload.js` | 12 | CommonJS | Electron preload (contextBridge) | `src/main/preload.ts` |
| `src/shared/calculator.js` | 190 | UMD (CJS + window global `BDCalculator`) | Both processes | `src/shared/calculator.ts` (ESM) |
| `src/services/quote-identity-service.js` | 63 | UMD (CJS + window global `BDQuoteIdentityService`) | Both processes | `.ts` (ESM) |
| `src/services/quote-payload.js` | 167 | UMD (CJS + window global `BDQuotePayload`) | Both processes | `.ts` (ESM) |
| `src/services/quote-exporter.js` | 223 | CommonJS | Main only | `.ts` (ESM) |
| `src/services/pdf-import-service.js` | 204 | CommonJS | Main only | `.ts` (ESM) |
| `src/services/quote-repository.js` | 450 | CommonJS | Main only | `.ts` (ESM) |
| `src/renderer/app.js` | 1413 | Globals + IIFE | Renderer via `<script>` | `src/renderer/app.ts` (single module, kept monolithic) |
| `src/renderer/vendor/gsap-lite.js` | 93 | IIFE with `window.gsap` | Renderer via `<script>` | `src/renderer/vendor/gsap-lite.ts` (ESM export, internal) |
| `src/renderer/index.html` | 665 | n/a | Electron renderer | Swap 4 `<script src="…">` tags for 1 `<script type="module" src="app.ts">` |
| `src/templates/quote/template.html` | 303 | n/a | Hidden BrowserWindow via `loadFile` | Keep inline `<script>` as vanilla JS; see §7.3 |
| `test/calculator.test.js` | 156 | CommonJS + `node:test` | `node --test` | `test/calculator.test.ts` via `tsx` loader |
| `test/quote-workflow.test.js` | 154 | CommonJS + `node:test` | `node --test` | `test/quote-workflow.test.ts` via `tsx` loader |

**Total:** ~3600 LOC of JS to migrate. Monolith `app.js` is the long pole (1413 LOC).

### External dependencies (runtime + types to add)

| Dep | Current | Types | Notes |
|---|---|---|---|
| `electron` | `^41.2.2` | ships types | fine |
| `electron-builder` | `^26.8.1` | ships types | fine |
| `pdf-lib` | `^1.17.1` | ships types | verified |
| `node:sqlite` | Node 22 built-in | `@types/node` ≥ 22.5 | `DatabaseSync` typed from Node 22.5+. Agent MUST verify installed `@types/node` version covers it. If not, add an ambient `declare module 'node:sqlite'` shim in `src/types/node-sqlite.d.ts`. `[CONFIRM]` if shim needed. |
| Node built-ins (`fs`, `path`, `crypto`, `perf_hooks`) | n/a | `@types/node` | covered |

### Tooling not currently present (to be added in Phase 1)

`typescript`, `tsx`, `electron-vite`, `vite`, `eslint`, `@typescript-eslint/parser`, `@typescript-eslint/eslint-plugin`, `eslint-config-prettier`, `eslint-plugin-import`, `prettier`, `@types/node`.

### Module resolution quirks to fix during migration

- **UMD → ESM:** `calculator.js`, `quote-identity-service.js`, `quote-payload.js` currently use the dual `(function(root, factory){ ... })(…)` pattern to be both CJS (in main) and browser global (in renderer). After migration: pure ESM `export`. Main imports directly; renderer imports via the bundler. The `window.BDCalculator` / `window.BDQuotePayload` / `window.BDQuoteIdentityService` globals disappear. `app.ts` replaces `const { … } = window.BDCalculator;` with `import { … } from '../shared/calculator';`.
- **Renderer `<script>` chain:** `index.html` currently loads `gsap-lite.js`, `calculator.js`, `quote-identity-service.js`, `quote-payload.js`, `app.js` via 5 separate `<script>` tags. After migration: 1 `<script type="module" src="app.ts">` entry; the bundler handles the rest.
- **Template inline script:** `template.html` contains a `window.renderQuote = function(payload){ … }` inline script invoked by `quote-exporter.js` via `webContents.executeJavaScript('window.renderQuote(…)')`. This runs in an isolated hidden BrowserWindow, is not bundled, and has no TS benefit. **Keep as vanilla JS.** Do not touch.

---

## 2. Stack decisions (already approved)

| Decision | Choice | Rationale |
|---|---|---|
| Bundler | `electron-vite` | Opinionated wrapper. Vite for renderer (HMR), esbuild under the hood for main + preload. Minimal config, correct defaults for Electron contextIsolation model. |
| TS strictness | `strict: true` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` | Catches the kinds of bugs that motivated the migration in the first place. |
| Refactor scope | Mechanical 1:1 | `.js` file → `.ts` file. No module splits, no renames, no API redesigns. `app.ts` stays a single 1413-LOC file. |
| Runtime validation | None (compile-time only) | Existing `normalizeProfile`, `normalizeCalcOptions`, `normalizeStores` in `quote-payload.js` already serve as runtime coercers. Zod deferred to v1.8.0. |
| Lint / format | ESLint + `@typescript-eslint` + Prettier | Standard combo. `eslint-config-prettier` disables style rules; Prettier owns format. |
| Test runner | `node --test` + `tsx` loader | Zero-migration-cost; keeps the 2 existing test files as-is structurally. |

---

## 3. Target final tree

```
xms-calc/
├── archive/
│   ├── legacy-prototype/
│   │   └── xms-royalty-calculator.jsx        # unchanged
│   └── pre-ts-1.6.6/                         # NEW — full snapshot of src/ + test/ pre-migration
│       ├── src/...
│       └── test/...
├── build/icons/app.icns                      # unchanged
├── docs/
│   ├── architecture.md                       # UPDATED in Phase 7
│   └── reference/*.pdf                       # unchanged
├── src/
│   ├── main/
│   │   ├── main.ts
│   │   └── preload.ts
│   ├── renderer/
│   │   ├── app.ts
│   │   ├── index.html                        # only script-tag block swapped
│   │   ├── styles/styles.css                 # untouched
│   │   ├── vendor/gsap-lite.ts
│   │   └── types/
│   │       └── electron-api.d.ts             # NEW — window.electronAPI typing
│   ├── services/
│   │   ├── pdf-import-service.ts
│   │   ├── quote-exporter.ts
│   │   ├── quote-identity-service.ts
│   │   ├── quote-payload.ts
│   │   └── quote-repository.ts
│   ├── shared/
│   │   ├── calculator.ts
│   │   └── types.ts                          # NEW — QuoteSnapshot, Store, CalcOptions, etc.
│   ├── templates/quote/                      # untouched
│   └── types/
│       └── node-sqlite.d.ts                  # NEW iff @types/node lacks DatabaseSync
├── test/
│   ├── calculator.test.ts
│   └── quote-workflow.test.ts
├── out/                                      # NEW — electron-vite build output, gitignored
├── .eslintrc.cjs                             # NEW
├── .prettierrc                               # NEW
├── .prettierignore                           # NEW
├── electron.vite.config.ts                   # NEW
├── tsconfig.json                             # NEW — base config
├── tsconfig.main.json                        # NEW — main + preload, CJS target
├── tsconfig.renderer.json                    # NEW — renderer, ESNext target, DOM libs
├── tsconfig.node.json                        # NEW — tooling config (vite config, tests)
├── package.json                              # UPDATED — deps, scripts, build.files, main field
├── package-lock.json                         # regenerated
├── CHANGELOG.md                              # UPDATED
├── README.md                                 # UPDATED
└── (unchanged: .gitignore, .gitattributes, LICENSE, DESIGN.md, DESIGN-AUDIT.md, REORG-PLAN.md)
```

---

## 4. Phase breakdown

### Phase 0 — Branch, baseline snapshot, tag

**Commit:** `chore: snapshot pre-typescript baseline for v1.7.0 migration`

Steps:
1. `git checkout main && git pull` (or confirm `main` is at `1.6.6`).
2. Verify `npm install && npm test` is green. If red, stop.
3. `git tag v1.6.6-pre-ts-migration` and push the tag.
4. `git checkout -b feat/v1.7.0-typescript-migration`.
5. Copy pre-migration source: `mkdir -p archive/pre-ts-1.6.6 && cp -R src test archive/pre-ts-1.6.6/`. Commit this as the baseline snapshot.

Acceptance:
- Tag `v1.6.6-pre-ts-migration` exists on `main`.
- Branch `feat/v1.7.0-typescript-migration` exists, one commit ahead of `main`.
- `archive/pre-ts-1.6.6/src/` and `archive/pre-ts-1.6.6/test/` contain byte-identical copies of the originals.
- `npm test` green.

---

### Phase 1 — Tooling scaffold (TS, electron-vite, ESLint, Prettier)

**Commit:** `build: add typescript + electron-vite + eslint + prettier toolchain`

#### 1.1 Install deps

```bash
npm i -D typescript@~5.6 tsx@~4.19 electron-vite@~2.3 vite@~5.4 \
  eslint@~9.13 typescript-eslint@~8.11 eslint-config-prettier@~9.1 \
  eslint-plugin-import@~2.31 prettier@~3.3 @types/node@~22.9
```

`[CONFIRM]` exact versions at execution time. Pin minor only if anything breaks. `@types/node` must be ≥ 22.5 for `node:sqlite` `DatabaseSync`.

#### 1.2 `tsconfig.json` (base, referenced by others; NOT emitted)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitReturns": true,
    "useDefineForClassFields": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "allowSyntheticDefaultImports": true
  },
  "files": [],
  "references": [
    { "path": "./tsconfig.main.json" },
    { "path": "./tsconfig.renderer.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

#### 1.3 `tsconfig.main.json` (main + preload + services + shared)

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["ES2022"],
    "types": ["node", "electron"],
    "composite": true,
    "outDir": "./out/main",
    "rootDir": "./src"
  },
  "include": [
    "src/main/**/*.ts",
    "src/services/**/*.ts",
    "src/shared/**/*.ts",
    "src/types/**/*.d.ts"
  ]
}
```

#### 1.4 `tsconfig.renderer.json` (renderer + shared re-usable for browser)

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": [],
    "composite": true,
    "outDir": "./out/renderer",
    "rootDir": "./src"
  },
  "include": [
    "src/renderer/**/*.ts",
    "src/shared/**/*.ts"
  ]
}
```

#### 1.5 `tsconfig.node.json` (vite config, tests, scripts)

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "composite": true,
    "types": ["node"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "noEmit": true
  },
  "include": [
    "electron.vite.config.ts",
    "test/**/*.ts"
  ]
}
```

#### 1.6 `electron.vite.config.ts`

```typescript
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import { resolve } from 'node:path';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'out/main',
      lib: {
        entry: resolve(__dirname, 'src/main/main.ts'),
        formats: ['cjs']
      },
      rollupOptions: {
        external: ['electron', 'pdf-lib', 'node:sqlite']
      }
    },
    resolve: {
      alias: {
        '@shared': resolve(__dirname, 'src/shared'),
        '@services': resolve(__dirname, 'src/services')
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'out/preload',
      lib: {
        entry: resolve(__dirname, 'src/main/preload.ts'),
        formats: ['cjs']
      }
    }
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    build: {
      outDir: resolve(__dirname, 'out/renderer'),
      rollupOptions: {
        input: resolve(__dirname, 'src/renderer/index.html')
      }
    },
    resolve: {
      alias: {
        '@shared': resolve(__dirname, 'src/shared'),
        '@services': resolve(__dirname, 'src/services')
      }
    }
  }
});
```

Aliases optional in v1.7.0 but cheap. `[CONFIRM]` with Archie whether to adopt `@shared/*` / `@services/*` imports now or keep relative imports for minimum diff.

#### 1.7 `.eslintrc.cjs`

```javascript
module.exports = {
  root: true,
  env: { browser: true, node: true, es2022: true },
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 2022, sourceType: 'module', project: ['./tsconfig.main.json', './tsconfig.renderer.json', './tsconfig.node.json'] },
  plugins: ['@typescript-eslint', 'import'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'prettier'
  ],
  rules: {
    '@typescript-eslint/consistent-type-imports': 'error',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-floating-promises': 'error',
    'import/order': ['warn', { 'newlines-between': 'always', groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'] }],
    'import/no-unresolved': 'off'
  },
  ignorePatterns: ['out/', 'dist/', 'node_modules/', 'archive/', 'src/templates/**/*.html']
};
```

#### 1.8 `.prettierrc`

```json
{
  "printWidth": 100,
  "tabWidth": 2,
  "singleQuote": true,
  "trailingComma": "none",
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

#### 1.9 `.prettierignore`

```
node_modules
out
dist
archive
package-lock.json
*.min.js
src/templates/**
```

#### 1.10 `package.json` scripts (update)

```json
{
  "scripts": {
    "dev": "electron-vite dev",
    "start": "electron-vite preview",
    "build": "electron-vite build",
    "typecheck": "tsc -b --noEmit",
    "lint": "eslint \"src/**/*.ts\" \"test/**/*.ts\"",
    "lint:fix": "eslint \"src/**/*.ts\" \"test/**/*.ts\" --fix",
    "format": "prettier --write \"src/**/*.{ts,html,css}\" \"test/**/*.ts\"",
    "format:check": "prettier --check \"src/**/*.{ts,html,css}\" \"test/**/*.ts\"",
    "test": "node --import tsx --test test/*.test.ts",
    "test:watch": "node --import tsx --test --watch test/*.test.ts",
    "pack": "npm run build && electron-builder --dir",
    "dist": "npm run build && electron-builder",
    "dist:mac": "npm run build && electron-builder --mac"
  }
}
```

#### 1.11 `.gitignore` additions

Append:
```
out/
.vite/
*.tsbuildinfo
```

Acceptance:
- `npm install` completes clean.
- `npx tsc -b --noEmit` passes (empty references OK for now).
- `npm run lint` passes on empty src (or warns only).
- `npm test` still green (tests still `.js`, node:test unaffected).
- `npm run dev` fails cleanly because no `.ts` exists yet — this is expected, do not try to fix here.

---

### Phase 2 — Migrate shared + services layer

**Commit:** `refactor(ts): migrate shared + services to TypeScript (ESM)`

Migrate pure, isolated modules first. These have no DOM dependencies and the smallest blast radius.

#### 2.1 Create `src/shared/types.ts` (NEW)

Centralized domain types used across main, renderer, services, and tests. Derive from existing runtime shapes in `quote-payload.js`, `quote-repository.js`, and the test fixtures.

Minimum set (add others as needed during migration):

```typescript
export type BusinessType =
  | 'cafe' | 'restaurant' | 'store' | 'gym' | 'entertainment' | 'mall' | 'supermarket';

export type BoxMode = 'none' | 'buy' | 'rent';

export interface GlobalDiscounts {
  account: number;
  box: number;
  qtg: number;
  qlq: number;
}

export interface CalcOptions {
  baseSalary: number;
  vatRate: number;
  boxMode: BoxMode;
  globalBoxCount: number;
  hasAccountFee: boolean;
  hasQTG: boolean;
  hasQLQ: boolean;
  globalDiscounts: GlobalDiscounts;
}

export interface Store {
  id: number;
  name: string;
  type: BusinessType | '';
  area: string;
  startDate: string;
  endDate: string;
}

export interface CustomerProfile {
  companyName: string;
  contactName: string;
  department: string;
  email: string;
  phone: string;
}

export interface PreparedByProfile {
  name: string;
  title: string;
  department: string;
  email: string;
  phone: string;
}

export interface StoreBreakdown {
  name: string;
  type: BusinessType | '';
  area: number;
  duration: number;
  coef: number;
  yearly: number;
  periodBase: number;
  qtgAmount: number;
  qlqAmount: number;
  accountAmount: number;
  boxAmount: number;
  total: number;
}

export interface Totals {
  subtotalQTG: number;
  subtotalQLQ: number;
  subtotalAccount: number;
  subtotalBox: number;
  subtotal: number;
  vatRate: number;
  vat: number;
  grand: number;
}

export interface QuoteSnapshot {
  customer: CustomerProfile;
  preparedBy: PreparedByProfile;
  calcOptions: CalcOptions;
  stores: Store[];
  totals: Partial<Totals>;
}

export interface QuoteIdentity {
  quoteCode: string;
  revisionNumber: number;
  revisionLabel: string;
  displayQuoteNumber: string;
}

export interface RevisionRecord {
  id: number;
  quoteId: number;
  quoteCode: string;
  revisionNumber: number;
  displayQuoteNumber: string;
  source: 'new' | 'clone' | 'import_pdf';
  customer: CustomerProfile;
  preparedBy: PreparedByProfile;
  calcOptions: CalcOptions;
  stores: Store[];
  totals: Partial<Totals>;
  embeddedPayloadVersion: string | null;
  pdfFilePath: string | null;
  pdfFingerprint: string | null;
  exportedAt: string | null;
  createdAt: string;
  updatedAt: string;
  status: 'draft' | 'exported' | 'imported';
  quoteIdentity: QuoteIdentity;
}

export interface QuoteRecord {
  id: number;
  quoteCode: string;
  currentRevisionNumber: number;
  status: 'draft' | 'exported' | 'imported';
  createdAt: string;
  updatedAt: string;
}

export interface RevisionBundle {
  quote: QuoteRecord;
  activeRevision: RevisionRecord;
  revisions: RevisionRecord[];
}

export interface EmbeddedManifest {
  schemaVersion: string;
  appVersion: string;
  quoteIdentity: Pick<QuoteIdentity, 'quoteCode' | 'revisionNumber' | 'displayQuoteNumber'>;
  quoteDate: string;
  customer: CustomerProfile;
  preparedBy: PreparedByProfile;
  calcOptions: CalcOptions;
  stores: Store[];
  totals: Partial<Totals>;
  exportedAt: string;
  pdfFingerprintSource: string;
}

export interface ImportPreview {
  filePath: string;
  fileName: string;
  fingerprint: string;
  manifest: EmbeddedManifest;
  quoteIdentity: QuoteIdentity;
  existingRevisionId: number | null;
  conflictType: 'new_quote' | 'attach_existing_chain' | 'same_file' | 'revision_conflict';
  recommendedAction: string;
  actions: Array<{ key: string; label: string }>;
  summary: string;
  preview: {
    displayQuoteNumber: string;
    quoteCode: string;
    revisionNumber: number;
    revisionLabel: string;
    customerName: string;
    branchCount: number;
    grandTotal: number;
    manifestCompatibility: string;
    exportedAt: string;
    hasExistingQuote: boolean;
  };
}
```

#### 2.2 Migrate in order (easiest → hardest)

Order matters because downstream files import upstream types.

1. **`src/shared/calculator.ts`** (from `calculator.js`, 190 LOC)
   - Drop UMD wrapper. `export const BUSINESS_TYPES`, `export function calculateCoef`, etc.
   - `BUSINESS_TYPES` typed as `Record<BusinessType, { label: string; short: string }>`.
   - `calculateStoreBreakdown(store: Store, options: CalcOptions): StoreBreakdown`.
   - `calculateTotals(stores: Store[], options: CalcOptions): { stores: StoreBreakdown[]; totals: Totals }`.
   - Keep function bodies byte-identical beyond type annotations.

2. **`src/services/quote-identity-service.ts`** (63 LOC)
   - Drop UMD. Export each function.
   - `generateBaseQuoteCode(date: Date, sequenceNumber: number): string`, etc.

3. **`src/services/quote-payload.ts`** (167 LOC)
   - Drop UMD.
   - Import `calculator` and `quote-identity-service` as ESM.
   - `buildQuotePayload(state, customerInput, settingsInput, options): QuotePayload`.
   - Define `QuotePayload` interface in `types.ts` or locally (prefer `types.ts`).
   - Type the `options` parameter — `{ quoteIdentity?: { quoteCode: string; revisionNumber: number }; quoteDateInput?: Date | string | number }`.

4. **`src/services/quote-exporter.ts`** (223 LOC)
   - Imports: `electron.BrowserWindow` / `electron.App` / `electron.Dialog` typings from `electron`.
   - Define `ExportQuoteArgs` interface for the single argument object.
   - `async function exportQuote(args: ExportQuoteArgs): Promise<{ filePath: string; fingerprint: string } | null>`.
   - `cachedPrintWindow` etc. typed as `BrowserWindow | null`.

5. **`src/services/pdf-import-service.ts`** (204 LOC)
   - `pdf-lib` exports are typed.
   - `buildImportPreview({ ... }: BuildImportPreviewArgs): ImportPreview`.
   - `extractManifestFromPdfFile(filePath: string): Promise<{ filePath: string; fileName: string; fingerprint: string; manifest: EmbeddedManifest }>`.

6. **`src/services/quote-repository.ts`** (450 LOC)
   - This is the biggest single file of the phase.
   - `node:sqlite` `DatabaseSync` must be typed. If `@types/node` ≥ 22.5 is installed, no extra work. If not: create `src/types/node-sqlite.d.ts` with an ambient declaration. `[CONFIRM]` needed at execution time.
   - `class QuoteRepository` with typed methods. Return types match the runtime hydration output (see `hydrateRevisionRow`).
   - `hydrateRevisionRow(row: unknown): RevisionRecord | null` — use `unknown` for the SQLite row and cast via a `RevisionRow` helper type matching column names.

#### 2.3 Test as you go

After each file:
- `npx tsc -b --noEmit` — no errors.
- `npm test` — tests still green. Tests still reference `.js` paths — that is fine if `require('../src/shared/calculator')` resolves to the compiled output. In this phase we have NOT yet wired the build, so tests must still pass via `tsx`. **Update test imports to point to `.ts` sources in the same commit**, otherwise tests break.

Tests already use CommonJS `require`. Migrating tests is Phase 5. For Phase 2, either:
- (A) Leave `.js` test files, and make Phase 2 tests pass via `tsx` loader resolving `.ts` imports. Verify: `node --import tsx --test test/*.test.js` works if the `.js` test `require`s a path that now only has a `.ts` sibling.
- (B) Migrate tests in this phase too.

**Recommendation:** (B). Scope creep is small (2 files, 310 LOC combined) and avoids a half-broken state. Move Phase 5 earlier into 2.7.

#### 2.7 Migrate tests in same commit

Convert `test/calculator.test.js` → `.test.ts` and `test/quote-workflow.test.js` → `.test.ts`. CommonJS `require` → ESM `import`. `node:test` API unchanged. Update `package.json` scripts to `.ts`.

Acceptance:
- All `.js` in `src/shared/`, `src/services/`, `test/` are gone (renamed to `.ts`).
- `npx tsc -b --noEmit` passes.
- `npm run lint` passes.
- `npm test` green with the same test count.
- Main process (`main.js`) still unchanged and still `require`s the `.ts` files. Verify: with `tsx` installed as a dev dep, `main.js`'s `require('../services/quote-payload')` will NOT resolve `.ts` — this breaks `npm start`. Therefore `npm start` will be broken after Phase 2. This is expected; Phase 3 fixes it. Document this in the commit message.

---

### Phase 3 — Migrate main + preload

**Commit:** `refactor(ts): migrate main process + preload to TypeScript`

#### 3.1 `src/main/preload.ts`

```typescript
import { contextBridge, ipcRenderer } from 'electron';
import type { QuoteSnapshot, RevisionBundle, ImportPreview } from '@shared/types';

export interface ElectronAPI {
  createNewQuote: (snapshot: QuoteSnapshot) => Promise<RevisionBundle>;
  createNewRevision: (payload: { revisionId: number; snapshot: QuoteSnapshot }) => Promise<RevisionBundle>;
  exportQuote: (payload: { revisionId: number; snapshot: QuoteSnapshot }) => Promise<{ filePath: string; bundle: RevisionBundle } | null>;
  getStartupRevision: () => Promise<RevisionBundle | null>;
  importQuotePdfPreview: () => Promise<ImportPreview | null>;
  confirmImportQuotePdf: (payload: { preview: ImportPreview; action: string }) => Promise<RevisionBundle>;
  loadQuoteRevision: (revisionId: number) => Promise<RevisionBundle>;
  saveQuoteDraft: (payload: { revisionId: number; snapshot: QuoteSnapshot }) => Promise<{ revisionId: number; updatedAt: string }>;
}

const api: ElectronAPI = {
  createNewQuote: (snapshot) => ipcRenderer.invoke('create-new-quote', snapshot),
  createNewRevision: (payload) => ipcRenderer.invoke('create-new-revision', payload),
  exportQuote: (payload) => ipcRenderer.invoke('export-quote', payload),
  getStartupRevision: () => ipcRenderer.invoke('get-startup-revision'),
  importQuotePdfPreview: () => ipcRenderer.invoke('import-quote-pdf-preview'),
  confirmImportQuotePdf: (payload) => ipcRenderer.invoke('confirm-import-quote-pdf', payload),
  loadQuoteRevision: (revisionId) => ipcRenderer.invoke('load-quote-revision', revisionId),
  saveQuoteDraft: (payload) => ipcRenderer.invoke('save-quote-draft', payload)
};

contextBridge.exposeInMainWorld('electronAPI', api);
```

#### 3.2 `src/renderer/types/electron-api.d.ts`

```typescript
import type { ElectronAPI } from '../../main/preload';

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
```

#### 3.3 `src/main/main.ts`

Migrate `main.js` 1:1. Key typing points:
- `ipcMain.handle('create-new-quote', async (_event, snapshot: QuoteSnapshot) => …)`. Type each handler's argument.
- `ensureRepository(): QuoteRepository`.
- `normalizeSnapshot(snapshot: unknown, options?: { recomputeTotals?: boolean }): QuoteSnapshot`.
- `resolveImport(preview: ImportPreview, action: string): RevisionRecord`.

Acceptance:
- `npm run typecheck` green.
- `npm run dev` launches the app window.
- Exercise: create new quote → fill 1 branch → export PDF → reimport PDF → verify revision conflict detection. All behave identically to 1.6.6.
- `npm test` green.
- `npm run lint` green.

---

### Phase 4 — Migrate renderer (app.js monolith + gsap-lite + index.html wiring)

**Commit:** `refactor(ts): migrate renderer to TypeScript + ESM`

This is the long phase. `app.ts` stays one file (1413 LOC) per scope decision. Add types throughout, do not split.

#### 4.1 `src/renderer/vendor/gsap-lite.ts`

Convert 93 LOC IIFE to ESM. Export a `gsap` object with the handful of methods app.js uses (`gsap.to`, `gsap.fromTo`, `gsap.killTweensOf`). Define an internal minimal `Tween`, `Target` type.

App imports: `import { gsap } from './vendor/gsap-lite';`.

Verify the `window.gsap` global usage does not exist elsewhere — grep the repo. It does not (only `app.js` uses it).

#### 4.2 `src/renderer/index.html`

Change script block in `<head>`:

```html
<!-- before -->
<script src="vendor/gsap-lite.js"></script>
<script src="../shared/calculator.js"></script>
<script src="../services/quote-identity-service.js"></script>
<script src="../services/quote-payload.js"></script>
```

to:

```html
<!-- Vite will rewrite this path during build. In dev, it resolves to src/renderer/app.ts -->
```

Move the single entry to bottom of body:

```html
<!-- before -->
<script src="app.js"></script>

<!-- after -->
<script type="module" src="./app.ts"></script>
```

Everything else in `index.html` stays byte-identical. No DOM edits.

#### 4.3 `src/renderer/app.ts`

Migrate 1413 LOC as one file. Typing strategy:

1. Top-level `let` state gets explicit types:
   ```typescript
   let baseSalary: number = 2340000;
   let vatRate: number = 0;
   let stores: Store[] = [];
   let activeTabId: number | null = null;
   let boxMode: BoxMode = 'none';
   // ... etc
   ```

2. Replace `window.BDCalculator` / `window.BDQuotePayload` destructuring with direct imports:
   ```typescript
   import { BUSINESS_TYPES, calculateCoef, calculateDurationMonths, calculateTotals } from '@shared/calculator';
   import {
     buildQuotePayload, normalizeCalcOptions, normalizePreparedBy, normalizeProfile, normalizeStores
   } from '@services/quote-payload';
   import { gsap } from './vendor/gsap-lite';
   ```

3. All `document.getElementById(...)` calls return `HTMLElement | null`. Helper:
   ```typescript
   function byId<T extends HTMLElement = HTMLElement>(id: string): T {
     const el = document.getElementById(id);
     if (!el) throw new Error(`Missing element #${id}`);
     return el as T;
   }
   ```
   Use `byId<HTMLInputElement>('areaInput')` when specific type is needed.

4. `window.electronAPI` is already typed via `electron-api.d.ts`.

5. Functions annotate arguments and returns. Examples:
   - `function createStore(index: number): Store`
   - `function applyRevisionBundle(bundle: RevisionBundle): void`
   - `function readPreparedByFields(): PreparedByProfile`
   - `async function performExport(): Promise<void>`
   - `async function persistDraftSerialized(serialized: string): Promise<{ revisionId: number; updatedAt: string } | null>`

6. Event handlers: `(event: MouseEvent) => void`, `(event: KeyboardEvent) => void`, etc.

7. The `escapeHTML` helper: `(value: unknown): string`.

8. Cache variables: `computedQuoteCache: { stores: StoreBreakdown[]; totals: Totals } | null`.

9. Local storage IO: wrap reads in try/catch with typed parse — already done, just add types.

10. Do NOT refactor. If a `let` is currently mutated across 5 functions, keep that pattern. Scope change = out of scope.

#### 4.4 Verify runtime

- `npm run dev` — app launches, loads startup revision, no console errors.
- Exercise all UI paths: add store, bulk add, change business type, toggle QTG/QLQ, change VAT, toggle box mode, open settings, export, import, new revision, search, delete store.
- Compare side-by-side against `v1.6.6-pre-ts-migration` tag if regression suspected.

Acceptance:
- `npm run typecheck` green.
- `npm run lint` green — zero `any`, zero `@ts-ignore`.
- `npm test` green.
- `npm run dev` launches, all UI paths work identically to 1.6.6.
- `npm run build` produces `out/main/main.js`, `out/preload/preload.js`, `out/renderer/index.html` with referenced assets.

---

### Phase 5 — (merged into Phase 2, see §2.7)

Left as a heading to preserve numeric alignment with REORG-PLAN style. No-op.

---

### Phase 6 — Wire electron-builder to compiled output

**Commit:** `build: update electron-builder to package out/ compiled bundle`

#### 6.1 `package.json` `main` field

```json
{
  "main": "out/main/main.js"
}
```

#### 6.2 `package.json` `build` block

```json
{
  "build": {
    "appId": "com.xmusic.calculator",
    "productName": "XMS Calculator",
    "directories": {
      "buildResources": "build"
    },
    "files": [
      "out/**/*",
      "src/templates/**/*",
      "package.json"
    ],
    "extraMetadata": {
      "main": "out/main/main.js"
    },
    "mac": {
      "category": "public.app-category.business",
      "target": [{ "target": "dmg", "arch": ["arm64", "x64"] }],
      "icon": "build/icons/app.icns"
    }
  }
}
```

Note: `src/templates/**/*` stays packaged (not bundled) because `quote-exporter.ts` loads `template.html` via `path.join(__dirname, '../templates/quote/template.html')` at runtime in the main process. The relative path must still resolve in the packaged app. Verify: when main is at `out/main/main.js`, the path resolves to `out/templates/quote/...` — which does not exist unless templates are copied. Either:
  - **(A)** Add a Vite plugin / post-build step that copies `src/templates/` to `out/templates/`. Update `quote-exporter.ts` path: `path.join(__dirname, '../templates/quote/template.html')` (relative to `out/main/`).
  - **(B)** Leave templates at `src/templates/` inside the asar; change `quote-exporter.ts` to compute path relative to app root (`app.getAppPath()`).

**Recommendation: (A)** — less code change. Add to `electron.vite.config.ts`:

```typescript
import { viteStaticCopy } from 'vite-plugin-static-copy'; // `npm i -D vite-plugin-static-copy`

// in main config:
plugins: [
  externalizeDepsPlugin(),
  viteStaticCopy({
    targets: [{ src: 'src/templates/*', dest: '../templates' }]
  })
]
```

`[CONFIRM]` approach (A) vs (B) with Archie before implementing.

#### 6.3 Smoke test the packaged app

- `npm run pack` — produces `dist/mac/XMS Calculator.app`.
- Launch the .app. Create a new quote, add 1 branch, export PDF. PDF saves, opens, and re-imports cleanly.
- `npm run dist:mac` — produces `dist/XMS Calculator-1.7.0.dmg`.

Acceptance:
- `dist:mac` output installs and runs.
- End-to-end: create → fill → export → close app → relaunch → confirm startup-revision restore → import that PDF → verify `conflictType === 'same_file'`.

---

### Phase 7 — Docs, CHANGELOG, version bump

**Commit:** `docs: update architecture.md, README, CHANGELOG for v1.7.0`

#### 7.1 `package.json` version

```json
{ "version": "1.7.0" }
```

#### 7.2 `CHANGELOG.md` entry

```markdown
## [1.7.0] — <date>

### Changed
- Entire codebase migrated from JavaScript to TypeScript (strict mode).
- Build pipeline switched from raw `<script>` tags + `electron-builder` glob to `electron-vite` (Vite for renderer, esbuild for main + preload).
- Renderer modules now import via ESM; `window.BDCalculator` / `window.BDQuotePayload` / `window.BDQuoteIdentityService` globals removed.
- `package.json` `main` now points to `out/main/main.js` (compiled bundle).
- Test runner now uses `node --test` with `tsx` loader for `.test.ts` files.

### Added
- ESLint 9 + `@typescript-eslint` + Prettier toolchain.
- Centralized domain types in `src/shared/types.ts`.
- `window.electronAPI` typed via `src/renderer/types/electron-api.d.ts`.
- `archive/pre-ts-1.6.6/` snapshot of the pre-migration tree.

### Removed
- UMD wrappers on `calculator.js`, `quote-identity-service.js`, `quote-payload.js`.
- `<script>` tag chain in `src/renderer/index.html` (4 tags → 1 module entry).

### Unchanged
- All UI elements, DOM structure, CSS, and business logic (ND 17/2023 math) verbatim.
- `src/templates/quote/template.html` inline `<script>` kept as vanilla JS (runs in isolated BrowserWindow, not bundled).
- SQLite schema, PDF manifest schema, quote code format.
```

#### 7.3 `docs/architecture.md` update

Rewrite the "Key design decisions" and "Module map" sections:

- Replace "No bundler" paragraph with `electron-vite` pipeline description.
- Replace UMD paragraph with ESM + TS note.
- Add short section: "PDF template inline script — why it stays plain JS" (justify the `template.html` carve-out).
- Keep data flow diagrams; update file extensions `.js` → `.ts`.

#### 7.4 `README.md` update

- Tech stack line: "Electron 41, TypeScript (strict), electron-vite, Node.js built-in test runner (via tsx), pdf-lib, electron-builder."
- Scripts section: add `npm run dev`, `npm run typecheck`, `npm run lint`, `npm run format`.
- Directory layout: update file extensions.

Acceptance:
- Version bumped to `1.7.0`.
- CHANGELOG includes `1.7.0` entry.
- README and `docs/architecture.md` reflect the new stack.
- Tag `v1.7.0` after merge.

---

## 5. Risks, unknowns, `[CONFIRM]` items

| # | Item | Severity | Action |
|---|---|---|---|
| R1 | `@types/node` coverage for `node:sqlite.DatabaseSync` may lag. | Medium | If missing at install time, write `src/types/node-sqlite.d.ts` ambient declaration. `[CONFIRM]` if shim is needed. |
| R2 | `src/templates/quote/template.html` path resolution in packaged app. | Medium | **Decision locked:** use approach **(A)** and copy templates to `out/templates/` at build time. Keep runtime lookup relative to compiled main output (`out/main/...`). |
| R3 | Alias adoption (`@shared/*`, `@services/*`). | Low | **Decision locked:** keep imports **relative-only** for v1.7.0 migration to minimize diff. Defer alias rollout to a follow-up refactor ticket. |
| R4 | `app.ts` 1413 LOC stays monolithic. Refactor temptation will be strong. | Medium | Hard rule: no split in 1.7.0. A future `REFACTOR-PLAN-1.8.0.md` handles modularization. |
| R5 | `gsap-lite` typing. Custom code, small surface, no external `@types`. | Low | Write inline types in the file. |
| R6 | `strict` mode surfacing real null/undefined bugs in `app.js`. | Medium-High | Expected. Fix as discovered, do not blanket-cast to `!`. Log each bug found in the commit body. If >10, Archie wants to review the list. |
| R7 | `electron-builder` asar repacking of compiled output differs from pre-migration; file paths inside packaged app shift. | Medium | Phase 6 smoke test must include reopening and re-importing a PDF to cover the full template-path round-trip. |
| R8 | `tsx` compatibility with Node `--test` may shift across minor Node releases. | Low | Pin Node to `>=20 <23` in `engines`. Version-bump `tsx` cautiously. |
| R9 | Electron 41 + Node 22 runtime inside the packaged app. `node:sqlite` must be present in Electron's bundled Node. | Medium | Verify: Electron 41 uses Node 22.x. `node:sqlite` is in Node ≥ 22.5. Check `process.versions.node` at Phase 3 smoke test. |
| R10 | Existing `ts-node`/`tsx` parse errors for `import.meta` if renderer code leaks into tests. | Low | `tsconfig.node.json` has `types: ["node"]` only, no DOM; tests should not import renderer files. Enforce via eslint `no-restricted-imports`. |

Locked decisions (approved on **2026-04-24**):
1. **Alias strategy:** relative imports only in v1.7.0. Do not introduce `@shared/*` or `@services/*` during migration.
2. **Template packaging strategy:** **(A)** copy `src/templates/` to `out/templates/` (e.g., via vite static copy step). Do not rely on `app.getAppPath()` in v1.7.0.
3. **`any` leak budget:** **0** in production code. Existing rule stands: `any` only in unavoidable ambient declarations, with `// TODO(ts-1.7.1): replace any`.
4. **Rename policy:** `.js -> .ts` transitions must use `git mv` to preserve history (with baseline snapshot in `archive/pre-ts-1.6.6/`).

---

## 6. Post-migration verification checklist

End-to-end runthrough on the packaged `.dmg`, with fresh user data dir:

1. Launch app → startup revision is null → auto-create base quote.
2. Fill: customer info, preparedBy in settings, 3 branches with different business types, different discount levels.
3. VAT 8% → grand total matches calculation done by hand (or by `v1.6.6-pre-ts` side-by-side).
4. Export PDF → PDF opens, layout matches 1.6.6 output pixel-for-pixel (diff two exports).
5. Close app.
6. Relaunch → startup revision loads → all state intact.
7. New Revision → appends R1 to the chain, snapshot cloned.
8. Import the PDF from step 4 → conflict detection says "same_file" → open existing.
9. Import the PDF under Finder → delete first, then import again → conflict detection says "new_quote" if DB wiped, else correct conflictType.
10. `cmd+E` keyboard shortcut triggers export.
11. Bulk Add modal: add 5 rows, select a business type, apply → 5 branches created.
12. Search in sidebar: type partial name, matching branches filter, clear works.
13. Delete a branch, verify totals recompute.
14. Quit via `cmd+Q` on Mac → `before-quit` handler fires, repo closes cleanly (no SQLite lock file left).

If any step diverges from 1.6.6 behaviour, treat as a regression bug, fix in-place, and log in CHANGELOG under `### Fixed`.

---

## 7. Appendix — carve-outs and rationale

### 7.1 `app.ts` stays monolithic

Archie rejected the "migration + split" option because regression risk compounds with migration risk. Policy for 1.7.0: language change only. 1.8.0 will carry the split.

### 7.2 No runtime validation (Zod etc.) in 1.7.0

Existing `normalizeProfile`, `normalizeCalcOptions`, `normalizeStores`, `normalizeSnapshot` in `quote-payload.ts` already defensively coerce untrusted input at module boundaries. They are imperfect but sufficient. Zod comes in 1.8.0 with the app.ts split, where validation schemas and type definitions can share one source of truth.

### 7.3 `template.html` inline script stays plain JS

The `window.renderQuote` function inside `template.html` runs in a hidden BrowserWindow invoked via `webContents.executeJavaScript('window.renderQuote(...)')` from `quote-exporter.ts`. It is never loaded through the renderer Vite pipeline. Migrating it costs effort, buys nothing (no imports, no module sharing), and adds a second bundler entry point. Leaving it as vanilla JS is the right call. The `payload` argument it receives is still typed at the producer side (`buildQuotePayload` in `quote-payload.ts`). A comment at the top of the inline script documents this carve-out.

### 7.4 Vendor lib naming

`vendor/gsap-lite.ts` is not a third-party library. The file is a custom 93-LOC minimal reimplementation of GSAP's `.to` / `.fromTo` / `.killTweensOf` for the app's animation needs. Name remains `vendor/` for historical continuity but typing is written in-file.

---

**End of plan.** Total planned commits: 5 (Phase 0, 1, 2, 3, 4 merged with 5, 6, 7). Estimated elapsed time for a focused agent: 2–4 working days depending on how much `strict` null-checking surfaces in `app.ts`.

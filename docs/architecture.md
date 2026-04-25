# Architecture

## Process model

XMS Calculator is a two-process Electron application built with TypeScript and electron-vite.

```text
src/main/main.ts           ← Node.js main process bundle entry
  └── src/main/preload.ts  ← Context bridge (contextIsolation: true)
        └── src/renderer/  ← Chromium renderer bundle entry (no direct Node access)
```

`main.ts` handles IPC, file I/O, SQLite persistence, and PDF export. The renderer calls into main exclusively via the IPC handlers exposed by `preload.ts`. `nodeIntegration` is disabled in the renderer; all Node-side work goes through the bridge contract.

## Module map

| Module | Location | Role |
|---|---|---|
| `main.ts` | `src/main/` | App lifecycle, window management, IPC dispatch |
| `preload.ts` | `src/main/` | Exposes typed `window.electronAPI` to renderer via contextBridge |
| `index.html` / `app.ts` | `src/renderer/` | UI shell and renderer state orchestration |
| `styles.css` | `src/renderer/styles/` | Full app stylesheet (Ableton-inspired dark theme) |
| `calculator.ts` | `src/shared/` | Pure royalty math per ND 17/2023. No side effects, no I/O. Imported from both renderer and main/services. |
| `quote-payload.ts` | `src/services/` | Quote data shape normalization and serialization |
| `quote-identity-service.ts` | `src/services/` | Quote code generation, revision numbering, fingerprinting |
| `quote-exporter.ts` | `src/services/` | PDF export: loads template in hidden BrowserWindow, captures via print API, embeds manifest |
| `pdf-import-service.ts` | `src/services/` | PDF manifest extraction, fingerprint verification, revision conflict detection |
| `quote-repository.ts` | `src/services/` | SQLite-backed quote persistence via `node:sqlite` |

## Data flow

```text
User input (renderer/app.ts)
  → IPC call (preload.ts bridge)
    → main.ts dispatch
      → calculator.ts          (pure computation)
      → quote-payload.ts       (build structured payload)
      → quote-repository.ts    (persist to SQLite)
      → quote-exporter.ts      (PDF export)
            └── src/templates/quote/template.html (rendered in hidden BrowserWindow)
```

## Dependency graph

```text
main.ts
├── services/quote-exporter.ts
│   └── services/pdf-import-service.ts
│       ├── services/quote-identity-service.ts
│       └── services/quote-payload.ts
│           └── shared/calculator.ts
├── shared/calculator.ts
├── services/quote-payload.ts
├── services/quote-identity-service.ts
├── services/quote-repository.ts
│   └── services/quote-identity-service.ts
└── services/pdf-import-service.ts

renderer/app.ts (ESM)
├── shared/calculator.ts
├── services/quote-identity-service.ts
├── services/quote-payload.ts
└── renderer/vendor/gsap-lite.ts
```

## Key design decisions

**Bundled ESM pipeline with electron-vite.**
- Renderer is bundled by Vite.
- Main and preload are bundled through electron-vite's Node-side build pipeline.
- `npm run build` outputs to `out/`, then template assets are copied for runtime PDF rendering.

**TypeScript strict mode across the project.**
- `strict: true` is enforced in `tsconfig`.
- Policy checks enforce strict-mode retention and no `any` regressions.

**ESM modules end-to-end (no UMD globals).**
- Shared/service modules are imported via ESM from both renderer and main contexts.
- Legacy `window.BDCalculator` / `window.BDQuotePayload` / `window.BDQuoteIdentityService` globals are removed.

**SQLite via `node:sqlite`.**
Node 22 runtime support allows `node:sqlite` as built-in database integration without external native addons.

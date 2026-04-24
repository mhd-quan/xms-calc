# Architecture

## Process model

XMS Calculator is a standard two-process Electron application.

```
src/main/main.js          ← Node.js main process
  └── src/main/preload.js ← Context bridge (contextIsolation: true)
        └── src/renderer/ ← Chromium renderer (no Node access except via bridge)
```

`main.js` handles IPC, file I/O, SQLite persistence, and PDF export. The renderer calls into main exclusively via the IPC handlers exposed by `preload.js`. `nodeIntegration` is disabled in the renderer; all Node-side work goes through the bridge.

## Module map

| Module | Location | Role |
|---|---|---|
| `main.js` | `src/main/` | App lifecycle, window management, IPC dispatch |
| `preload.js` | `src/main/` | Exposes `window.electronAPI` to renderer via contextBridge |
| `index.html` / `app.js` | `src/renderer/` | UI shell and all renderer-side state |
| `styles.css` | `src/renderer/styles/` | Full app stylesheet (1279 LOC, Ableton-inspired dark theme) |
| `calculator.js` | `src/shared/` | Pure royalty math per ND 17/2023. No side effects, no I/O. Loaded in both renderer (script tag) and main process (require). |
| `quote-payload.js` | `src/services/` | Quote data shape and serialization. UMD — works in both renderer and Node. |
| `quote-identity-service.js` | `src/services/` | Quote code generation, revision numbering, fingerprinting. UMD. |
| `quote-exporter.js` | `src/services/` | PDF export: loads template in a hidden BrowserWindow, captures via print API, embeds manifest. |
| `pdf-import-service.js` | `src/services/` | PDF manifest extraction, fingerprint verification, revision conflict detection. |
| `quote-repository.js` | `src/services/` | SQLite-backed quote persistence via `node:sqlite`. |

## Data flow

```
User input (renderer/app.js)
  → IPC call (preload.js bridge)
    → main.js dispatch
      → calculator.js         (pure computation)
      → quote-payload.js      (build structured payload)
      → quote-repository.js   (persist to SQLite)
      → quote-exporter.js     (PDF export)
            └── src/templates/quote/template.html  (rendered in hidden BrowserWindow)
```

## Dependency graph

```
main.js
├── quote-exporter.js
│   └── pdf-import-service.js
│       ├── quote-identity-service.js
│       └── quote-payload.js
│           └── calculator.js (shared)
├── calculator.js (shared)
├── quote-payload.js
├── quote-identity-service.js
├── quote-repository.js
│   └── quote-identity-service.js
└── pdf-import-service.js

renderer/index.html (browser scripts, loaded as globals)
├── shared/calculator.js
├── services/quote-identity-service.js
└── services/quote-payload.js
```

## Key design decisions

**No bundler.** Files are loaded via Electron's native module resolution and direct script tags. This keeps the dev loop fast and the debug surface minimal. Acceptable for an internal tool with this scope.

**Shared modules as UMD.** `calculator.js`, `quote-payload.js`, and `quote-identity-service.js` use a UMD wrapper so they work both as Node.js CommonJS modules (in main) and as browser globals (in renderer via script tag). This avoids duplicating logic.

**SQLite via `node:sqlite`.** Node 22 ships `node:sqlite` as a built-in. No native addon, no external dependency.

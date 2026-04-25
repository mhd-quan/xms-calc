# XMS Calculator

Royalty calculator for XMusic Station (NCT) per Nghị định 17/2023/NĐ-CP, Vietnam. Calculates music copyright royalties for retail, F&B, hospitality, and franchise clients. Exports partner-ready quotation PDFs.

## Screenshot

<!-- Drop a screenshot here after first stable run -->

## Features

Desktop Electron app built for internal BD and key account management use. Calculates royalties across multiple business types and branch configurations per the ND 17/2023 coefficient table. Supports bulk branch input, quote versioning with PDF import/export, and a partner-ready quotation PDF with NCT branding. Quote state persists locally via SQLite.

## Tech stack

Electron 41, TypeScript (`strict: true`), electron-vite (Vite renderer + bundled main/preload), Node.js built-in test runner with `tsx`, pdf-lib, electron-builder.

## Install and run

```bash
npm install
npm run dev
```

## Scripts

- `npm run dev`: start Electron in development mode via `electron-vite`.
- `npm start`: alias of `npm run dev`.
- `npm run build`: build bundled output to `out/` and copy quote templates.
- `npm run pack`: build and package app directory.
- `npm run dist` / `npm run dist:mac`: build and generate distributables.
- `npm test`: run Node test runner against TypeScript tests through `tsx` loader.
- `npm run typecheck`: run TypeScript project reference checks.
- `npm run lint`: run ESLint.
- `npm run format`: format with Prettier.
- `npm run phase:gate`: run policy gate checks.

## Build

```bash
npm run dist:mac
```

Output: `dist/*.dmg`

## Directory layout

```text
xms-calculator/
├── src/
│   ├── main/          # Electron main process (main.ts, preload.ts)
│   ├── renderer/      # Browser-facing UI (index.html, app.ts, styles/, vendor/)
│   ├── services/      # Stateful services (quote export, import, repository, payload)
│   ├── shared/        # Pure logic shared across main and renderer (calculator.ts)
│   └── templates/     # PDF export template (HTML + CSS + fonts + assets)
│       └── quote/
├── assets/brand/      # Brand assets (NCT logo, signature)
├── build/icons/       # Electron-builder app icon
├── docs/reference/    # Legal and brand reference PDFs
├── archive/           # Dead code kept for historical reference
└── test/              # Node test runner test files
```

## Quality gates

Project policy is enforced by phase gates with stop-on-fail behavior:

- Commit convention: `build/refactor/docs/test/chore`
- Locked boundary: no UI change and no business logic change
- Locked type policy: strict mode and no `any`

Run:

```bash
npm run phase:gate
```

Detailed policy: [docs/phase-gate-policy.md](docs/phase-gate-policy.md).

## Versioning

See [CHANGELOG.md](CHANGELOG.md).

## License

Proprietary. See [LICENSE](LICENSE).

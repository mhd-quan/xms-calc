# XMS Calculator

Royalty calculator for XMusic Station (NCT) per Nghị định 17/2023/NĐ-CP, Vietnam. Calculates music copyright royalties for retail, F&B, hospitality, and franchise clients. Exports partner-ready quotation PDFs.

## Screenshot

<!-- Drop a screenshot here after first stable run -->

## Features

Desktop Electron app built for internal BD and key account management use. Calculates royalties across multiple business types and branch configurations per the ND 17/2023 coefficient table. Supports bulk branch input, quote versioning with PDF import/export, and a partner-ready quotation PDF with NCT branding. Quote state persists locally via SQLite.

## Tech stack

Electron 41, vanilla JavaScript (no framework), Node.js built-in test runner, pdf-lib, electron-builder.

## Install and run

```
npm install
npm start
```

## Test

```
npm test
```

## Build

```
npm run dist:mac
```

Output: `dist/*.dmg`

## Directory layout

```
xms-calculator/
├── src/
│   ├── main/          # Electron main process (main.js, preload.js)
│   ├── renderer/      # Browser-facing UI (index.html, app.js, styles/, vendor/)
│   ├── services/      # Stateful services (quote export, import, repository, payload)
│   ├── shared/        # Pure logic shared across main and renderer (calculator.js)
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

```
npm run phase:gate
```

Detailed policy: [docs/phase-gate-policy.md](docs/phase-gate-policy.md).

## Versioning

See [CHANGELOG.md](CHANGELOG.md).

## License

Proprietary. See [LICENSE](LICENSE).

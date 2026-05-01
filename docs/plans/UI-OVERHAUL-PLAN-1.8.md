# XMS-CALC × DESIGN A "DARK ABLETON" — DEFINITIVE OVERHAUL PLAN

**Branch:** `claude/redesign-app-interface-0IdMt` (cả hai repo)
**Source of truth:** `mhd-quan/xms-design-system` @ `01 - UI Overhaul Demo.html` artboard `id="ableton"` + `tokens.css` + `palette.css` + `components.css`
**Version target:** xms-calc v1.8.0 — "Dark Ableton"
**Decisions locked:** Adopt 1:1 tokens & class names · Vanilla TS · Add x-knob/x-infoview/x-vu · Visual diff + token audit + checklist

---

## 0. PRE-FLIGHT — RED LINES & DEFINITIONS

### 0.1 Source-of-truth invariants (immutable)

Bất kỳ rule nào dưới đây bị vi phạm trong code = task fail, redo từ đầu (không patch tại chỗ).

| # | Invariant | Why |
|---|-----------|-----|
| I1 | **Token namespace duy nhất** = `--shell-{0..5}`, `--inset-{0,1}`, `--line-{1..3}`, `--ink-{1..5}`, `--active(-hover/-press/-dim/-glow/-ink)`, `--data(-dim/-glow)`, `--alert(-dim)`, `--vu-{low,mid,high}`, `--p-{stone,rust,amber,moss,teal,indigo,mauve}-{1..10}`. Cấm mọi alias `--bg-*`, `--text-*`, `--daw-*`, `--border-*`, `--pear`, `--picton`. | Drift về tokens là drift về source of truth. |
| I2 | **Class prefix duy nhất** cho component-layer = `x-*` (theo `components.css`). Layout/feature classes vẫn được phép (`app`, `topbar`, `sidebar`, `work`, `bottombar`, `csection`, `line`) nhưng phải composing từ x-* primitives, không tự define visual style chồng chéo. | Component reuse chỉ có giá trị khi 1 selector = 1 visual contract. |
| I3 | **Border radius cap** = 2px cho controls/buttons/fields, 3px cho modals/panels, 50% chỉ cho dot tròn (`--r-pill 999px` chỉ dùng cho `.x-chip__dot` — KHÔNG dùng cho pill toggle/badge). | Square-first language. |
| I4 | **Box-shadow chỉ được dùng** ở 2 dạng đã document: `--focus-glow` (focus state) hoặc glass-focus extension cho overlay (`box-shadow: 0 0 0 1px var(--active-dim), 0 0 16px rgba(0,0,0,0.4)`). KHÔNG có drop shadow elevation. KHÔNG có pulse glow animation. | "No drop shadows" rule. |
| I5 | **Transition duration** ∈ `{0ms (--t-instant), 90ms (--t-quick), 140ms (--t-struct), 400ms (--t-meter)}`. Không có 150/180/200/300 lăn tăn. | Instrument feel = instant. Slow animations = mushy. |
| I6 | **Typography** = Inter (UI), Atkinson Hyperlegible (label/eyebrow), Inter mono fallback `'SF Mono', ui-monospace` cho tabular nums. Bắt buộc `font-feature-settings: 'tnum' 1, 'cv11' 1, 'ss03' 1` ở body. Cấm Space Grotesk, Lexend trong app shell (Lexend chỉ ở PDF template, riêng biệt). | Đặc trưng instrument-grade. |
| I7 | **Font sizes** chỉ dùng `--t-{tiny,label,body,control,section,readout,display}`. Cấm hardcoded `font-size: 13px;` rải rác. | Hierarchy thật. |
| I8 | **Spacing** chỉ dùng `--s-{0..10}`. Cấm `padding: 14px;` ngẫu nhiên (`14px` không nằm trong scale; `12px = --s-5`, `16px = --s-6`). | 4px grid discipline. |
| I9 | **Row heights** chỉ dùng `--row-{tight=22, default=28, input=32, button=28}`. | Predictable rhythm. |
| I10 | **Active accent (`--active`) chỉ owned 1 state**: hero focus, armed mode, primary CTA, selected row indicator, primary fill. Cấm dùng cho hover background, border của field idle, link hover, scrollbar… | Single hero accent — mất đi nếu lạm dụng. |

### 0.2 Definition of done — 1 phase = pass tất cả 5 cổng

```
G1  Tokens & class lint   →  scripts/policy/check-design-tokens.ts pass
G2  Visual diff           →  Playwright screenshot diff vs reference, ≤ 2% pixel diff
G3  Component checklist   →  từng item trong phase checklist tick
G4  Functional smoke      →  npm test pass, npm run typecheck pass, npm run lint pass
G5  Manual side-by-side   →  open Design A demo HTML cạnh app dev server, no jarring difference
```

Bất kỳ G1–G5 fail ở phase N → **revert phase N hoàn toàn (`git reset --hard <phase-N-1-tag>`)**, redo từ đầu của phase đó. KHÔNG patch.

### 0.3 Scope boundaries (out of plan)

- PDF template (`src/templates/quote/`) — giữ nguyên light variant. Không động.
- Calculation domain logic (`src/shared/calculator.ts`, `src/services/*`) — không refactor.
- Quote repository + persistence — không động.
- Electron main process (`src/main/main.ts`) — không động.
- IPC contract — không động.

### 0.4 Branch & commit cadence

- 1 phase = 1 commit. Title: `refactor(ui): phase N — <name>`. Body kèm checklist outcomes.
- Tag mỗi phase pass: `git tag overhaul/phase-N-pass` — để rollback granular.
- Push sau mỗi commit: `git push -u origin claude/redesign-app-interface-0IdMt`.
- KHÔNG mở PR cho đến phase 14 (final). Không spam reviewer.

---

## 1. ARCHITECTURE OVERVIEW

```
xms-calc/
├── src/renderer/
│   ├── styles/
│   │   ├── tokens.css         ← copy 1:1 từ xms-design-system/tokens.css
│   │   ├── palette.css        ← copy 1:1 từ xms-design-system/palette.css
│   │   ├── components.css     ← copy 1:1 từ xms-design-system/components.css
│   │   ├── app.css            ← layout + variant-specific (.app, .topbar, .sidebar, .work, .bottombar, .csection, .line, .x-statusbar)
│   │   └── index.css          ← @import order: tokens → palette → components → app
│   ├── index.html             ← refactor toàn bộ markup sang x-* + layout classes
│   ├── app.ts                 ← refactor thành render modules + InfoView event delegation + knob/VU controllers
│   └── modules/                ← MỚI: tách app.ts thành module
│       ├── render-topbar.ts
│       ├── render-sidebar.ts
│       ├── render-workbench.ts
│       ├── render-bottombar.ts
│       ├── render-modals.ts
│       ├── controllers/
│       │   ├── knob.ts        ← x-knob pointer-lock interaction
│       │   ├── infoview.ts    ← x-infoview event delegation
│       │   ├── vu.ts          ← x-vu render + peak hold
│       │   ├── datepicker.ts
│       │   ├── dropdown.ts
│       │   └── fader.ts
│       └── format.ts          ← formatVND etc. (move ra khỏi app.ts)
└── scripts/
    ├── policy/
    │   ├── check-design-tokens.ts   ← MỚI: token + radius + shadow + transition lint
    │   └── check-class-namespace.ts ← MỚI: ensure x-* prefix used
    └── visual/
        ├── snapshot-baselines/      ← reference PNGs từ Design A artboard
        └── snapshot-spec.ts         ← Playwright test harness
```

`app.ts` hiện 1519 dòng → tách ~6 module 200-300 dòng/file. State management vẫn module-scoped vars (đã có `renderScope`, `renderScheduled` flags); thêm `infoviewState`, `knobState` riêng.

---

## 2. PHASE-BY-PHASE PLAN

### Mỗi phase template

```
Phase N — <title>
├── Goal           : 1 câu, không nhiều hơn
├── Files touched  : danh sách path tuyệt đối
├── Dependencies   : phase nào phải pass trước
├── Implementation : code snippets exact-as-written
├── Restrictions   : red lines specific to this phase
├── Checklist      : pre-commit human-tickable
├── Test gate      : G1–G5 với threshold cụ thể
└── Rollback       : git command nếu fail
```

---

### **PHASE 0 — Tooling & Baseline Capture**

**Goal:** Setup design-token lint + Playwright + capture reference screenshots từ Design A artboard.

**Files touched:**
- `package.json` — thêm devDeps: `@playwright/test@^1.48`, `pixelmatch@^7`, `pngjs@^7`
- `scripts/policy/check-design-tokens.ts` — MỚI
- `scripts/policy/check-class-namespace.ts` — MỚI
- `scripts/visual/snapshot-spec.ts` — MỚI
- `scripts/visual/baseline/` — MỚI (chứa PNG references)
- `playwright.config.ts` — MỚI

**Dependencies:** none.

**Implementation:**

```typescript
// scripts/policy/check-design-tokens.ts
import { readFile } from 'node:fs/promises';
import { glob } from 'node:fs/promises'; // node 22 native glob

const ALLOWED_TOKENS = new Set([
  'shell-0','shell-1','shell-2','shell-3','shell-4','shell-5',
  'inset-0','inset-1',
  'line-1','line-2','line-3',
  'ink-1','ink-2','ink-3','ink-4','ink-5',
  'active','active-hover','active-press','active-dim','active-glow','active-ink',
  'data','data-dim','data-glow',
  'alert','alert-dim',
  'vu-low','vu-mid','vu-high',
  'font-ui','font-label','font-num',
  't-tiny','t-label','t-body','t-control','t-section','t-readout','t-display',
  'lh-tight','lh-control','lh-body',
  'track-tight','track-default','track-label','track-eyebrow',
  's-0','s-1','s-2','s-3','s-4','s-5','s-6','s-7','s-8','s-9','s-10',
  'row-tight','row-default','row-input','row-button',
  'r-0','r-1','r-2','r-3','r-pill',
  't-instant','t-quick','t-struct','t-meter',
  'ease-out','ease-meter',
  'focus-ring','focus-glow',
]);
const ALLOWED_PALETTE_PREFIX = /^p-(stone|rust|amber|moss|teal|indigo|mauve)-(10|[1-9])$/;
const FORBIDDEN_LEGACY = /--(bg-|text-|daw-|border-|pear|picton)/g;
const FORBIDDEN_RADIUS = /border-radius:\s*([4-9]|[1-9]\d+)px/g;  // > 3px
const FORBIDDEN_SHADOW_LARGE = /box-shadow:[^;]*\b(\d{2,}px)\s+(\d{2,}px)/g; // 2-digit blur ≥ 10px
const ALLOWED_TRANSITION = /transition:[^;]*\b(0|90|140|400)ms\b/;
const TRANSITION_DURATION = /transition[^;]*\b(\d+)ms\b/g;

const errors: string[] = [];

for (const file of await glob('src/renderer/styles/*.css')) {
  const content = await readFile(file, 'utf-8');
  const lines = content.split('\n');
  lines.forEach((line, i) => {
    // Legacy aliases
    const legacy = line.match(FORBIDDEN_LEGACY);
    if (legacy && !line.trim().startsWith('/*')) {
      errors.push(`${file}:${i+1} legacy token: ${legacy.join(', ')}`);
    }
    // Token usage validation
    const usedTokens = [...line.matchAll(/var\(--([a-z0-9-]+)\)/g)].map(m => m[1]);
    for (const t of usedTokens) {
      if (!ALLOWED_TOKENS.has(t) && !ALLOWED_PALETTE_PREFIX.test(t)) {
        errors.push(`${file}:${i+1} unknown token --${t}`);
      }
    }
    // Radius cap
    const r = line.match(FORBIDDEN_RADIUS);
    if (r) errors.push(`${file}:${i+1} radius > 3px: ${r[0]}`);
    // Transition duration whitelist
    const td = [...line.matchAll(TRANSITION_DURATION)];
    for (const m of td) {
      const ms = Number(m[1]);
      if (![0, 90, 140, 400].includes(ms)) {
        errors.push(`${file}:${i+1} non-canonical transition duration ${ms}ms`);
      }
    }
  });
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log('✓ design-token lint passed');
```

```typescript
// scripts/visual/snapshot-spec.ts (Playwright test)
import { test, expect, _electron as electron } from '@playwright/test';

const VIEWPORT = { width: 1440, height: 900 };
const REGIONS = [
  { name: 'topbar',     clip: { x: 0,    y: 0,   width: 1440, height: 44  } },
  { name: 'sidebar',    clip: { x: 0,    y: 44,  width: 240,  height: 790 } },
  { name: 'workbench',  clip: { x: 240,  y: 44,  width: 1200, height: 790 } },
  { name: 'bottombar',  clip: { x: 0,    y: 834, width: 1440, height: 44  } },
  { name: 'statusbar',  clip: { x: 0,    y: 878, width: 1440, height: 22  } },
];

test('phase visual diff', async ({}, info) => {
  const app = await electron.launch({ args: ['out/main/main.js'] });
  const win = await app.firstWindow();
  await win.setViewportSize(VIEWPORT);
  await win.waitForSelector('.x-statusbar');

  for (const region of REGIONS) {
    await expect(win).toHaveScreenshot(
      `${region.name}.png`,
      { clip: region.clip, maxDiffPixelRatio: 0.02, animations: 'disabled' }
    );
  }
  await app.close();
});
```

Capture baseline 1 lần đầu bằng cách render `01 - UI Overhaul Demo.html` artboard `#ableton` ở 1440×900 (xms-design-system local), screenshot 5 regions, lưu vào `scripts/visual/baseline/`.

```json
// package.json scripts thêm
"policy:tokens":  "node --import tsx scripts/policy/check-design-tokens.ts",
"policy:classes": "node --import tsx scripts/policy/check-class-namespace.ts",
"visual:test":    "playwright test scripts/visual/",
"visual:update":  "playwright test scripts/visual/ -u"
```

**Restrictions:**
- KHÔNG đụng vào `src/renderer/` ở phase 0.
- Baseline screenshots phải capture từ Design A artboard `#ableton` chứ không phải `#hybrid` hay `#lighter`.

**Checklist:**
- [ ] `npm install` thêm devDeps không lỗi
- [ ] `npm run policy:tokens` chạy được trên `src/renderer/styles/styles.css` hiện tại và **báo errors** (vì current code vẫn còn `--bg-*`, `--daw-*`) — chứng minh script work
- [ ] `playwright test` setup, có sample test pass với baseline images

**Test gate:** G4 only (tooling phase chưa có UI thay đổi).

**Rollback:** `git reset --hard HEAD~1` + `npm install` undo packages.

---

### **PHASE 1 — Foundation Layer (Tokens · Palette · Reset · Typography)**

**Goal:** App load với đúng tokens.css/palette.css/components.css từ design-system. Inter + Atkinson loaded. Body resets match.

**Files touched:**
- `src/renderer/styles/tokens.css` — copy 1:1 từ `xms-design-system/tokens.css` (189 dòng)
- `src/renderer/styles/palette.css` — copy 1:1 từ `xms-design-system/palette.css` (112 dòng)
- `src/renderer/styles/components.css` — copy 1:1 từ `xms-design-system/components.css` (965 dòng)
- `src/renderer/styles/app.css` — MỚI, chỉ chứa layout + variant overrides (~600 dòng, chiết xuất từ section `style#app-layout` của Demo HTML dòng 1282–1568)
- `src/renderer/styles/index.css` — MỚI, root entry
- `src/renderer/styles/styles.css` — DELETE (sau khi xác nhận index.css load OK)
- `src/renderer/index.html` — đổi `<link rel="stylesheet" href="styles/styles.css">` → `<link rel="stylesheet" href="styles/index.css">`. Đổi font preconnect/load.

**Dependencies:** Phase 0 pass.

**Implementation:**

```css
/* src/renderer/styles/index.css */
@import url('./tokens.css');
@import url('./palette.css');
@import url('./components.css');
@import url('./app.css');
```

```html
<!-- src/renderer/index.html: thay <head> -->
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>XMusic Station — Royalty Calculator</title>
  <meta name="description" content="Bảng tính phí bản quyền âm nhạc theo Nghị định 17/2023/NĐ-CP">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="styles/index.css">
</head>
```

(Font @import nằm trong `tokens.css` rồi nên không cần thêm `<link>` riêng — match design system pattern.)

`app.css` chỉ chứa các block layout-level (không component), trích từ Demo HTML §`/* App frame inside artboard */` đến hết §`.app--lighter`. Điều chỉnh:
- Bỏ `body { background: #0e1014; }` (chỉ dùng cho artboard demo).
- Ghim variant duy nhất: `.app { /* không có --hybrid, --lighter */ }` — drop hai variant kia.

```css
/* src/renderer/styles/app.css — extract chỉ phần Dark Ableton */
.app {
  display: grid;
  grid-template-rows: 44px 1fr 44px 22px;
  grid-template-columns: 240px 1fr;
  height: 100%;
  background: var(--shell-0);
  color: var(--ink-1);
  font-family: var(--font-ui);
  font-size: var(--t-body);
}

.topbar { /* ... copy từ Demo §.topbar */ }
.sidebar { /* ... */ }
.work { /* ... */ }
.csection { /* ... */ }
.line { /* ... */ }
.line-head { /* ... */ }
.bottombar { /* ... */ }
/* (KHÔNG copy .app--hybrid, .app--lighter — single variant) */
```

**Restrictions:**
- KHÔNG mở `index.html` body — phase này CHỈ thay đổi `<head>` link + create new CSS files.
- KHÔNG động vào `app.ts`.
- Trong `app.css`, không inline component styles — chỉ layout+frame. Component styles đã ở `components.css`.

**Checklist:**
- [ ] `tokens.css`, `palette.css`, `components.css` byte-exact với design-system @ commit `18af210` (verify bằng `diff`)
- [ ] App build & start không lỗi 404 font / CSS missing
- [ ] DevTools `getComputedStyle(document.body).fontFamily` = chứa `Inter`
- [ ] DevTools `getComputedStyle(document.body).backgroundColor` = `rgb(26, 28, 32)` = `#1a1c20` = `--shell-0`
- [ ] Old `styles.css` deleted, không còn reference từ `index.html`

**Test gate:**
- G1: `npm run policy:tokens` pass
- G4: build + typecheck + lint pass
- G2 SKIP (UI markup chưa migrate ở phase này — sẽ rất broken)
- G3: checklist pass

**Rollback:** `git reset --hard overhaul/phase-0-pass`.

---

### **PHASE 2 — Layout Shell (4-zone grid)**

**Goal:** App frame `topbar 44 / 1fr / bottombar 44 / statusbar 22` × `sidebar 240 / work 1fr` work pixel-perfect. Topbar + statusbar render content cũ tạm thời để verify framing đúng.

**Files touched:**
- `src/renderer/index.html` — wrap app trong `.app`, chia 4 zones với class names mới (`.topbar`, `.sidebar`, `.work`, `.bottombar`, `.x-statusbar`). Giữ children tạm thời.
- `src/renderer/app.ts` — không động (sẽ refactor ở phase 3+).

**Implementation:**

```html
<body>
  <div id="app" class="app">
    <header class="topbar">
      <!-- placeholder children, restyle sau -->
      <div class="topbar__brand"><span class="dot"></span> XMS // CALC</div>
      <div class="topbar__breadcrumb x-breadcrumb">
        <!-- breadcrumb spans, sẽ wire data-* sau -->
      </div>
      <div class="topbar__actions">
        <!-- buttons -->
      </div>
    </header>

    <aside class="sidebar">
      <!-- sidebar content -->
    </aside>

    <div class="work">
      <!-- workbench content -->
    </div>

    <div class="bottombar">
      <!-- bottombar content -->
    </div>

    <div class="x-statusbar">
      <!-- status cells -->
    </div>
  </div>
  <!-- modals giữ ngoài .app -->
  ...
</body>
```

**Restrictions:**
- Children content từ phase 1 giữ y nguyên (innerHTML), chỉ wrap thêm container class. Visual sẽ vỡ một phần — chấp nhận; phase này verify frame.
- Statusbar bắt buộc grid-row 4 (22px). KHÔNG được absolute-positioned.
- Sidebar `grid-row: 1` chỉ — KHÔNG span xuống bottombar (Design A: sidebar dừng trên bottombar).

**Checklist:**
- [ ] DevTools: `.app` computed `grid-template-rows` = `"44px 1fr 44px 22px"`
- [ ] DevTools: `.app` computed `grid-template-columns` = `"240px 1fr"`
- [ ] Topbar height đúng 44px (DevTools box model)
- [ ] Bottombar grid-column = `1 / -1` (full width)
- [ ] Statusbar grid-column = `1 / -1`, height 22px
- [ ] Sidebar height = `100vh - 44 - 44 - 22` = phần 1fr giữa topbar và bottombar

**Test gate:**
- G2: visual diff `topbar.png` width/height contour pass (content chưa cần match)
- G2: visual diff `statusbar.png` height contour pass

**Rollback:** `git reset --hard overhaul/phase-1-pass`.

---

### **PHASE 3 — Topbar**

**Goal:** Topbar 44px chính xác Design A: brand pill (orange dot 7px + monospace caps "XMS // CALC" + 14px right padding + 1px right border-line-1) | breadcrumb (flex 1) | action row (Customer | Settings | Bulk Add (active state) | Save (primary amber)).

**Files touched:**
- `src/renderer/index.html` — refactor `<header class="topbar">` markup
- `src/renderer/modules/render-topbar.ts` — MỚI: function `renderTopbar(state)`
- `src/renderer/app.ts` — import + call renderTopbar(state)
- `src/renderer/styles/app.css` — chỉ cần selector adjustments nếu Design A có rule local (không cần — đã có trong css copy phase 1)

**Implementation HTML:**

```html
<header class="topbar">
  <div class="topbar__brand"><span class="dot"></span> XMS // CALC</div>
  <div class="topbar__breadcrumb x-breadcrumb">
    <span class="x-breadcrumb__item" id="bcCustomer">—</span>
    <span class="x-breadcrumb__sep">/</span>
    <span class="x-breadcrumb__item" id="bcQuote">—</span>
    <span class="x-breadcrumb__sep">/</span>
    <span class="x-breadcrumb__item is-current">
      <span class="x-breadcrumb__color" id="bcBranchColor"></span>
      <span id="bcBranchName">—</span>
    </span>
  </div>
  <div class="topbar__actions">
    <button class="x-btn"           id="btnCustomer"  data-info="Customer|Mở dialog chỉnh sửa thông tin khách hàng.|⌘I">Customer</button>
    <button class="x-btn"           id="btnSettings"  data-info="Settings|Mở dialog cài đặt người lập báo giá.|⌘,">Settings</button>
    <button class="x-btn"           id="btnBulkAdd"   data-info="Bulk Add|Thêm nhiều chi nhánh cùng lúc với template.|⌘B">Bulk Add</button>
    <button class="x-btn x-btn--primary" id="btnSave" data-info="Save Quote|Lưu báo giá hiện tại.|⌘S">Save</button>
  </div>
</header>
```

**Implementation TS:**

```typescript
// src/renderer/modules/render-topbar.ts
import type { RenderSnapshot } from '../app';

export function renderTopbar(s: RenderSnapshot): void {
  const bc = (id: string) => document.getElementById(id)!;
  bc('bcCustomer').textContent = s.customer.companyName || 'Customer chưa đặt';
  bc('bcQuote').textContent    = s.activeDisplayQuoteNumber || '—';
  bc('bcBranchName').textContent = s.activeBranch.name;
  bc('bcBranchColor').style.background = paletteVar(s.activeBranch.hue, s.activeBranch.step);
}

const paletteVar = (hue: string, step: number) => `var(--p-${hue}-${step})`;
```

**Restrictions:**
- Buttons dùng `<button class="x-btn">` chứ KHÔNG `class="export-btn icon-action-btn"` legacy.
- Save = `x-btn--primary` (amber fill). Cấm wrap thêm SVG icon nếu Design A artboard không có (Design A demo Save không có icon — chỉ text).
- Bulk Add ở reference đang `is-active` (dùng để demo), nhưng app thực không có "armed Bulk Add mode" → đặt `class="x-btn"` neutral.
- `topbar__brand .dot` chính xác 7px × 7px, `background: var(--active)`, KHÔNG có `border-radius` (square dot — Design A reference dòng 1323).
- Padding topbar `0 16px`, gap 14px (`--s-5 + --s-1` ≈, hoặc hardcoded 14 — Design A dùng 14, accept 14 chứ không snap về s-6).

  **Exception document:** Topbar gap = 14px là single hard-coded exception, ghi rõ trong comment cạnh selector: `/* Design A artboard literal — falls between s-5 and s-6 */`. Token lint cần whitelist gap 14 cho `.topbar`.

**Checklist:**
- [ ] Topbar height = 44px (line 1288 reference)
- [ ] Brand dot `width: 7px; height: 7px; background: rgb(255, 180, 58)` (no radius)
- [ ] Brand text font-family contains `Inter` hoặc fallback to system mono — actually đọc lại spec: `font-family: var(--font-num)`, font-num = Inter primary, mono fallback. Verify.
- [ ] Breadcrumb sep `/` color = `var(--ink-5)` = `#3f434a`
- [ ] Active breadcrumb: color square 8×8px, vertical-align -1px, margin-right 4px
- [ ] Save button `background: var(--active)`, `color: var(--active-ink)` = `#1a1410`
- [ ] Hover Customer/Settings/Bulk Add: `background: var(--shell-3)`, `color: var(--ink-1)`, transition 0ms

**Test gate:**
- G2: `topbar.png` diff ≤ 2%
- G3: checklist pass
- G4: typecheck + lint pass

**Rollback:** `git reset --hard overhaul/phase-2-pass`.

---

### **PHASE 4 — Sidebar (Track Strip + Quote Chain header)**

**Goal:** Sidebar 240px wide, padding `12px 8px`. Markup theo Design A: header eyebrow `QUOTE CHAIN` + status chip · customer card · group label `Chi nhánh · N` + count chip · `.x-track` rows × N · "Add branch" `.x-btn` full-width.

**Files touched:**
- `src/renderer/index.html`
- `src/renderer/modules/render-sidebar.ts` — MỚI
- `src/renderer/app.ts` — drop `quote-history-panel` complex markup, thay bằng compact x-chip header
- Sidebar customer info nguồn = `customerProfile.companyName` + `activeQuoteCode`
- 70-color palette wiring: thêm `branchHue` + `branchStep` field cho Store type. Phase này: derive deterministically từ `id % 7 hue × (id % 10) step` tạm thời; phase 11 sẽ cho user pick.

**Implementation HTML structure:**

```html
<aside class="sidebar">
  <div class="sidebar__head">
    <div class="eyebrow">QUOTE CHAIN</div>
    <span class="x-chip" id="quoteStatusChip">
      <span class="x-chip__dot"></span><span id="quoteStatusText">SAVED</span>
    </span>
  </div>
  <div class="sidebar__customer">
    <div class="sidebar__customer__name" id="sidebarCustomerName">—</div>
    <div class="sidebar__customer__id">
      <span id="sidebarCustomerId">—</span> · QUOTE <span id="sidebarQuoteCode">—</span>
    </div>
  </div>
  <div class="sidebar__group-label">
    <span>Chi nhánh · <span id="branchCount">0</span></span>
    <span class="count tnum" id="branchLineCount">0 lines</span>
  </div>
  <div id="storeList"></div>
  <button id="addStoreBtn" class="x-btn" style="width:100%; margin-top:12px; justify-content:flex-start; gap:8px;"
          data-info="Add Branch|Thêm chi nhánh mới.|⌘N">
    <span style="font-size:14px; line-height:1; margin-top:-2px;">+</span>
    <span>Add branch</span>
  </button>
</aside>
```

Track row template:

```html
<div class="x-track" data-id="${id}" data-info="${name}|${stores} stores · ${lines} lines · ${total}|—">
  <div class="x-track__color" style="background: var(--p-${hue}-${step})"></div>
  <div class="x-track__body">
    <div class="x-track__head">
      <span class="x-track__badge" style="background: var(--p-${hue}-${step})">${badge}</span>
      <span class="x-track__name">${name}</span>
    </div>
    <div class="x-track__meta">
      ${stores} STORES <span class="dot">·</span> ${lines} LINES
      <span class="tnum" style="margin-left:auto; color: var(--ink-3)">${formatVND(total)}</span>
    </div>
    <div class="x-track__vu">
      <div class="x-vu" data-vu="${vu}" style="height:4px;">
        <div class="x-vu__fill"></div>
        <div class="x-vu__ladder"></div>
      </div>
    </div>
  </div>
</div>
```

**Implementation TS:**

```typescript
// src/renderer/modules/render-sidebar.ts
import { paletteToken } from './palette';
import { formatVND } from './format';
import type { Store } from '../../shared/types';

export function renderSidebar(stores: Store[], activeId: number, customer: CustomerProfile, quoteCode: string): void {
  // header
  setText('sidebarCustomerName', customer.companyName || 'Khách hàng chưa đặt');
  setText('sidebarCustomerId',  customer.contactName || '—');
  setText('sidebarQuoteCode',   quoteCode || '—');
  setText('branchCount',        String(stores.length));
  setText('branchLineCount',    `${stores.reduce((s,b)=>s+countLines(b),0)} lines`);

  const list = document.getElementById('storeList')!;
  list.innerHTML = stores.map(s => trackTemplate(s, s.id === activeId)).join('');

  // VU widths apply via CSS var
  list.querySelectorAll<HTMLElement>('.x-vu').forEach(vu => {
    vu.style.setProperty('--vu', vu.dataset.vu ?? '0');
  });
}
```

**Palette assignment helper:**

```typescript
// src/renderer/modules/palette.ts
const HUES = ['stone','rust','amber','moss','teal','indigo','mauve'] as const;
type Hue = typeof HUES[number];

export function paletteToken(seed: number): { hue: Hue; step: number } {
  // Skip indigo+mauve cho "default first tracks" theo DESIGN.md §6.2 rule
  // ("Store colors muted, varied, never pear/blue as default first tracks")
  const allowed: Hue[] = ['rust','amber','moss','teal','stone'];
  const hue = allowed[seed % allowed.length];
  const step = 4 + (seed * 3) % 4;  // step ∈ [4..7] — mid-range, not too pastel/dark
  return { hue, step };
}
```

**Restrictions:**
- KHÔNG kế thừa class `.store-item` cũ. Track row = `.x-track` thuần.
- Color chip = 4px width default, 5px khi `.is-active` (transition 90ms).
- VU row inside track = height 4px không phải 8px (Design A).
- Eyebrow `QUOTE CHAIN`: dùng `.eyebrow` class (đã có trong tokens.css), không tự style.
- Customer card border-radius = 2px (không 3, không 8).
- Cấm pulse animation trên status dot — Design A status chip dot là static color, không breathing.

**Checklist:**
- [ ] Sidebar width = 240px
- [ ] Padding = 12px 8px
- [ ] `x-track` min-height = 48px
- [ ] `x-track__color` width transition 4 → 5px on `.is-active`
- [ ] `x-track__badge` font-family `Inter` numeric, font-size 9px
- [ ] Customer card `--inset-0` background, 1px `--line-2` border
- [ ] Tất cả branch hue thuộc `{stone, rust, amber, moss, teal}` — KHÔNG có indigo/mauve mặc định
- [ ] `Add branch` button = full-width, justify-content: flex-start, gap 8px

**Test gate:**
- G2: `sidebar.png` diff ≤ 2% (lưu ý: số branches/data text sẽ khác, dùng masked region cho text content; clip frame + colors).
- G3: checklist pass

**Rollback:** `git reset --hard overhaul/phase-3-pass`.

---

### **PHASE 5 — Workbench Frame (Work head + Section grid)**

**Goal:** `.work` overflow-y auto, `padding: 14px 18px`, gap 10px. Work head: subtitle eyebrow (color square + badge + STORES + LINES), title h1 16px, x-seg trailing (Tháng / Quý / Năm) + date range x-btn.

**Files touched:**
- `src/renderer/index.html` — refactor toàn bộ `<main class="main">` → `<div class="work">`
- `src/renderer/modules/render-workbench.ts` — MỚI

**Implementation HTML:**

```html
<div class="work">
  <div class="work__head">
    <div>
      <div class="work__subtitle">
        <span class="x-breadcrumb__color" id="workBranchColor"></span>
        <span id="workBranchBadge">B-01</span> ·
        <span id="workStoreCount">0</span> STORES ·
        <span id="workLineCount">0</span> LINES
      </div>
      <input type="text" id="workBranchTitle" class="work__title" />
    </div>
    <div style="display:flex; gap:10px; align-items:center;">
      <div class="x-seg" id="cycleSeg" style="height:24px;">
        <button class="x-seg__btn is-active" data-cycle="m" style="min-width:44px; font-size:9px;"
                data-info="Per month|Hiển thị theo tháng.|M">Tháng</button>
        <button class="x-seg__btn" data-cycle="q" style="min-width:44px; font-size:9px;"
                data-info="Per quarter|Hiển thị theo quý.|Q">Quý</button>
        <button class="x-seg__btn" data-cycle="y" style="min-width:44px; font-size:9px;"
                data-info="Per year|Hiển thị theo năm.|Y">Năm</button>
      </div>
      <button class="x-btn" style="height:24px; font-size:9.5px;" id="workDateRangeBtn">
        <span class="tnum" id="workDateRangeText">—</span>
      </button>
    </div>
  </div>

  <div id="csectionList">
    <!-- 3 csection: Facility, Platform, Copyright. Render bằng JS -->
  </div>

  <div style="margin-top:4px; padding:10px 12px; background: var(--shell-1); border:1px solid var(--line-1); border-radius: var(--r-2); display:flex; align-items:center; justify-content:space-between; gap:12px;">
    <span class="eyebrow">Add new section</span>
    <div style="display:flex; gap:6px;">
      <button class="x-btn" style="font-size:9.5px;" id="btnAddSection">+ Section</button>
      <button class="x-btn" style="font-size:9.5px;" id="btnDuplicateBranch"
              data-info="Duplicate|Sao chép chi nhánh hiện tại.|⌘D">Duplicate branch</button>
    </div>
  </div>
</div>
```

**`work__title` styled như inline-editable input:**

```css
.work__title {
  font-size: 16px;
  font-weight: 600;
  color: var(--ink-1);
  letter-spacing: -0.005em;
  background: transparent;
  border: 1px solid transparent;
  outline: none;
  font-family: var(--font-ui);
  padding: 2px 4px;
  margin-left: -4px;
  border-radius: var(--r-2);
  transition: border-color var(--t-instant), background var(--t-instant);
}
.work__title:hover  { border-color: var(--line-2); }
.work__title:focus  { border-color: var(--active); box-shadow: var(--focus-glow); background: var(--inset-0); }
```

**Restrictions:**
- Work head margin-bottom = 4px, không 14px.
- `work__title` là input editable inline (NOT static text) — nhưng không có affordance (border) cho đến khi hover/focus. Đây là pattern Ableton clip-name editing.
- Section gap = 10px.

**Checklist:**
- [ ] `.work` padding `14px 18px`
- [ ] `.work` overflow-y auto
- [ ] `work__head` margin-bottom 4px
- [ ] `work__subtitle` font Atkinson Hyperlegible, 9.5px, letter-spacing 0.18em
- [ ] `work__title` 16px, weight 600, transparent border idle
- [ ] x-seg height 24px (đè default --row-button 28 vì compact mode)
- [ ] Cycle seg active = Tháng default

**Test gate:** G2 partial (chưa có csections nội dung)

**Rollback:** `git reset --hard overhaul/phase-4-pass`.

---

### **PHASE 6 — Calc Sections (csection × line table)**

**Goal:** Refactor 3 sections (Facility, Platform, Copyright) thành csection markup. Mỗi csection có header (idx pill + title + lines count + total) và body (line-head row + line rows). KHÔNG còn "platform-row", "copyright-row", "grid-12 col-X" markup.

**Quan trọng:** Domain hiện tại của xms-calc là KHÁC với demo của design system (demo show "Item · Qty · Rate · VAT · Mult · Total"). xms-calc thực tế là:
- Section 1 — Facility: business type dropdown + area input + start date + end date
- Section 2 — Platform: account fee toggle + fader; box mode segmented + counter + fader
- Section 3 — Copyright: QTG row (toggle + meta + fader + amount); QLQ row (idem)

Vì vậy line grid của design system KHÔNG mapping 1:1. Quyết định:

**Option A (Recommended): hybrid — structural csection wrapper + nội dung domain-specific.**

Tức là: dùng `.csection`, `.csection__head` (idx pill, title, total) làm container cho từng section. Bên trong `.csection__body`, dùng các x-* primitives (x-field-row, x-dropdown, x-fader-row, x-toggle-pill, x-counter, x-vbox, x-seg) để compose layout — không cần line-head grid.

Demo line grid (8 cột) chỉ áp dụng cho cases có "table of editable lines" — xms-calc không phải vậy. Section heading chrome thì áp dụng được.

**Files touched:**
- `src/renderer/index.html` — refactor 3 sections
- `src/renderer/modules/render-workbench.ts` — render section bodies
- `src/renderer/styles/app.css` — section internal grid (add `.csection-body__grid` thay cho .grid-12)

**Implementation Section 01 — Facility:**

```html
<div class="csection is-active">
  <div class="csection__head" data-section="01"
       data-info="Section 01 · Cơ sở vật chất|Mô hình kinh doanh + diện tích + chu kỳ.|—">
    <span class="csection__idx">01</span>
    <span class="csection__title">Cơ sở vật chất</span>
    <span style="display:flex; align-items:center; gap:8px;">
      <span class="eyebrow">Facility Profile</span>
    </span>
  </div>
  <div class="csection__body">
    <div class="csbody-grid csbody-grid--7-5">
      <div class="x-field-row">
        <label class="x-field-row__label">Mô hình kinh doanh</label>
        <div class="x-dropdown" id="businessType" data-value="" tabindex="0"
             data-info="Business type|Chọn mô hình kinh doanh để áp dụng hệ số.|—">
          <div class="x-dropdown__display">
            <span class="x-dropdown__value" id="businessTypeText">Chọn mô hình kinh doanh…</span>
            <span class="x-dropdown__caret"></span>
          </div>
          <div class="x-dropdown__menu">
            <div class="x-dropdown__item" data-value="cafe">Quán cà phê — giải khát</div>
            <div class="x-dropdown__item" data-value="restaurant">Nhà hàng, phòng hội thảo, hội nghị</div>
            <!-- ... -->
          </div>
        </div>
      </div>
      <div class="x-field-row">
        <label class="x-field-row__label">Diện tích phát nhạc</label>
        <div class="x-suffix-wrap">
          <input id="areaInput" type="number" min="1" class="x-field x-field--num" />
          <span class="x-suffix">m²</span>
        </div>
      </div>
    </div>
    <div class="csbody-grid csbody-grid--6-6" style="margin-top:14px;">
      <div class="x-field-row">
        <label class="x-field-row__label">Bắt đầu</label>
        <div class="x-datepicker" id="startDatePicker" tabindex="0">
          <div class="x-datepicker__display">
            <span class="x-datepicker__value tnum" id="startDateText">—</span>
            <span class="x-datepicker__icon"><!-- svg --></span>
          </div>
          <div class="x-datepicker__popup">
            <div class="x-datepicker__head">
              <button class="x-datepicker__nav" data-dir="-1">‹</button>
              <span class="x-datepicker__monthyear"></span>
              <button class="x-datepicker__nav" data-dir="1">›</button>
            </div>
            <div class="x-datepicker__weekdays">
              <span>T2</span><span>T3</span><span>T4</span><span>T5</span><span>T6</span><span>T7</span><span>CN</span>
            </div>
            <div class="x-datepicker__grid"></div>
          </div>
        </div>
      </div>
      <div class="x-field-row">
        <label class="x-field-row__label">Kết thúc</label>
        <div class="x-datepicker" id="endDatePicker" tabindex="0">
          <!-- same -->
        </div>
      </div>
    </div>
  </div>
</div>
```

CSS thêm vào `app.css`:

```css
.csbody-grid {
  display: grid;
  gap: var(--s-5);
}
.csbody-grid--7-5 { grid-template-columns: 7fr 5fr; }
.csbody-grid--6-6 { grid-template-columns: 1fr 1fr; }
.csbody-grid--4-5-3 { grid-template-columns: 4fr 5fr 3fr; }
```

**Implementation Section 02 — Platform (re-shaped):**

```html
<div class="csection">
  <div class="csection__head" data-section="02">
    <span class="csection__idx">02</span>
    <span class="csection__title">Nền tảng & Thiết bị</span>
    <span class="eyebrow" style="margin-left:auto;">Platform</span>
  </div>
  <div class="csection__body">

    <!-- Account Fee row -->
    <div class="x-row x-row--platform">
      <div class="x-row__lhs">
        <button class="x-toggle-pill is-on" id="accountToggle"
                data-info="Account Fee toggle|Bật/tắt phí tài khoản NCT 600.000₫/năm.|—">BẬT</button>
        <div class="x-row__info">
          <div class="x-row__name">Phí tài khoản NCT</div>
          <div class="x-row__desc">600.000 ₫ / năm · prorated theo chu kỳ</div>
        </div>
      </div>
      <div class="x-row__rhs">
        <div class="x-fader-row">
          <span class="label">Chiết khấu</span>
          <span class="x-fader-readout">
            <span class="x-fader-readout__val tnum" id="discountAccountVal">0</span>
            <span class="x-fader-readout__unit">%</span>
          </span>
        </div>
        <input type="range" class="x-fader" id="discountAccount" min="0" max="100" step="5" value="0"
               data-info="Discount · Account|Chiết khấu chung cho phí tài khoản.|—">
      </div>
    </div>

    <div class="x-divider" style="margin: var(--s-4) 0;"></div>

    <!-- Box mode row -->
    <div class="x-row x-row--platform">
      <div class="x-row__lhs">
        <div class="x-row__info">
          <div class="x-row__name">Box phát nhạc</div>
          <div class="x-row__desc" id="boxPriceDesc">Chọn hình thức trang bị</div>
        </div>
      </div>
      <div class="x-row__rhs">
        <div class="x-fader-row">
          <span class="label">Hình thức</span>
        </div>
        <div class="x-seg" id="boxModeSeg">
          <button class="x-seg__btn is-active" data-mode="none">Không</button>
          <button class="x-seg__btn"           data-mode="buy">Mua</button>
          <button class="x-seg__btn"           data-mode="rent">Thuê</button>
        </div>

        <div class="x-fader-row" id="boxQuantityRow" hidden style="margin-top:14px;">
          <span class="label">Số lượng</span>
          <div class="x-counter">
            <button class="x-counter__btn" id="boxMinus">−</button>
            <input class="x-counter__input tnum" id="boxCount" type="number" min="1" value="1" />
            <button class="x-counter__btn" id="boxPlus">+</button>
          </div>
        </div>

        <div id="boxDiscountRow" hidden style="margin-top:14px;">
          <div class="x-fader-row">
            <span class="label">Chiết khấu</span>
            <span class="x-fader-readout">
              <span class="x-fader-readout__val tnum" id="discountBoxVal">0</span>
              <span class="x-fader-readout__unit">%</span>
            </span>
          </div>
          <input type="range" class="x-fader" id="discountBox" min="0" max="100" step="5" value="0">
        </div>
      </div>
    </div>

  </div>
</div>
```

CSS row helper:

```css
.x-row {
  display: grid;
  grid-template-columns: 7fr 5fr;
  gap: var(--s-8);
  align-items: flex-start;
  padding: var(--s-5) 0;
}
.x-row__lhs { display: flex; gap: var(--s-6); align-items: flex-start; }
.x-row__info { flex: 1; }
.x-row__name { font-size: var(--t-control); font-weight: 500; color: var(--ink-1); margin-bottom: var(--s-3); }
.x-row__desc { font-size: var(--t-body); color: var(--ink-3); }
```

**Restrictions:**
- KHÔNG copy class `.copyright-row`, `.platform-row`, `.platform-left`, `.platform-right`, `.copyright-mid`, `.copyright-right`, `.headline-row`, `.headline-stats`, `.stat-block` — tất cả thay bằng `.x-row`, `.x-row__lhs`, `.x-row__rhs`, `.x-row__info`.
- `.toggle-btn` cũ → `.x-toggle-pill`. Bỏ pulse animation. Bỏ `--glow-color`.
- Segmented `.segmented-control` → `.x-seg`. Bỏ active animation `pulse-active-btn`. Khi active = solid amber fill, không pulse.
- Counter `.box-counter` → `.x-counter`. Buttons 26px width, input 44px width.
- `.toggle-btn.on` → `.x-toggle-pill.is-on`. Active state instant fill, no animation.

**Checklist:**
- [ ] csection padding header 8px 12px
- [ ] csection idx pill: font-num 9.5px, weight 700, padding 1px 5px, border-radius 2px
- [ ] csection title 13px, 600
- [ ] csection total = font-num + tnum, 13px, 600. Khi `.is-active` color = `var(--active)`
- [ ] csection.is-active head border-left = 2px solid `var(--active)`
- [ ] x-toggle-pill height 20px (compact, < 22px row-tight)
- [ ] x-seg active state = solid `--active` fill, KHÔNG có animation
- [ ] Section 03 (Copyright) row uses 4-5-3 grid (info | discount fader | amount)

**Test gate:**
- G2: `workbench.png` diff ≤ 2% (Design A ref artboard scale)
- G1: token lint pass
- G3: checklist pass

**Rollback:** `git reset --hard overhaul/phase-5-pass`.

---

### **PHASE 7 — Bottombar (InfoView · Breakdown · Grand Total VU)**

**Goal:** Bottombar grid 320 / 1fr / 280, no shadow. InfoView left bottom-left contextual; breakdown 4 cells (QTG · QLQ · Account · Box); grand total right with VU + LED + peak.

**Files touched:**
- `src/renderer/index.html`
- `src/renderer/modules/render-bottombar.ts` — MỚI
- `src/renderer/modules/controllers/infoview.ts` — MỚI
- `src/renderer/modules/controllers/vu.ts` — MỚI

**Implementation HTML:**

```html
<div class="bottombar">
  <!-- InfoView -->
  <div class="x-infoview" id="infoview" style="border-right:1px solid var(--line-1); border-top:none;">
    <div class="x-infoview__head">
      <span class="x-infoview__name" id="infoName">XMS Calculator</span>
      <span class="x-infoview__shortcut" id="infoShortcut"></span>
    </div>
    <div class="x-infoview__desc" id="infoDesc">Hover bất kỳ control nào để xem mô tả + phím tắt.</div>
  </div>

  <!-- Breakdown -->
  <div class="bottombar__breakdown">
    <div class="bottombar__breakdown__cell" data-info="Quyền tác giả|VCPMC.|—">
      <div class="bottombar__breakdown__label">Q. Tác Giả</div>
      <div class="bottombar__breakdown__val tnum" id="totalQTG">0 ₫</div>
    </div>
    <div class="bottombar__breakdown__cell" data-info="Quyền liên quan|NCT.|—">
      <div class="bottombar__breakdown__label">Q. Liên Quan</div>
      <div class="bottombar__breakdown__val tnum" id="totalQLQ">0 ₫</div>
    </div>
    <div class="bottombar__breakdown__cell">
      <div class="bottombar__breakdown__label">Tài khoản</div>
      <div class="bottombar__breakdown__val tnum" id="totalAccount">0 ₫</div>
    </div>
    <div class="bottombar__breakdown__cell">
      <div class="bottombar__breakdown__label">Box</div>
      <div class="bottombar__breakdown__val tnum" id="totalBox">0 ₫</div>
    </div>
  </div>

  <!-- Grand Total -->
  <div class="bottombar__total">
    <div class="bottombar__total__label">Grand total · monthly</div>
    <div class="bottombar__total__big">
      <span class="tnum" id="grandTotal">0</span>
      <span style="font-size:14px; color: var(--ink-2)">₫</span>
    </div>
    <div class="bottombar__total__vu">
      <div class="x-vu" id="grandVu" style="height:4px;">
        <div class="x-vu__fill"></div>
        <div class="x-vu__ladder"></div>
        <div class="x-vu__peak"></div>
      </div>
    </div>
  </div>
</div>
```

`infoview.ts` — single delegated listener:

```typescript
// src/renderer/modules/controllers/infoview.ts
const DEFAULT = {
  name: 'XMS Calculator',
  desc: 'Hover bất kỳ control nào để xem mô tả + phím tắt.',
  shortcut: ''
};

let lastTarget: Element | null = null;
let resetTimer: number | null = null;

export function attachInfoView(root: HTMLElement) {
  const nameEl = document.getElementById('infoName')!;
  const descEl = document.getElementById('infoDesc')!;
  const shortcutEl = document.getElementById('infoShortcut')!;

  root.addEventListener('mouseover', (e) => {
    const el = (e.target as Element).closest<HTMLElement>('[data-info]');
    if (!el || el === lastTarget) return;
    lastTarget = el;
    if (resetTimer) clearTimeout(resetTimer);

    const [name, desc, shortcut] = (el.dataset.info ?? '').split('|');
    nameEl.textContent = name || DEFAULT.name;
    descEl.textContent = desc || DEFAULT.desc;
    shortcutEl.innerHTML = shortcut && shortcut !== '—' ? renderShortcut(shortcut) : '';
  });

  root.addEventListener('mouseout', (e) => {
    if (!(e.target instanceof Element)) return;
    const related = e.relatedTarget as Element | null;
    if (related && related.closest('[data-info]')) return;  // moved into another data-info
    if (resetTimer) clearTimeout(resetTimer);
    resetTimer = window.setTimeout(() => {
      lastTarget = null;
      nameEl.textContent = DEFAULT.name;
      descEl.textContent = DEFAULT.desc;
      shortcutEl.innerHTML = '';
    }, 60);  // small debounce avoids flicker
  });
}

function renderShortcut(spec: string): string {
  // "Cmd + S" → <span class="x-infoview__key">⌘</span><span class="x-infoview__key">S</span>
  return spec.split('+').map(k => `<span class="x-infoview__key">${k.trim()}</span>`).join('');
}
```

`vu.ts` — VU meter renderer with peak hold:

```typescript
// src/renderer/modules/controllers/vu.ts
type VuState = {
  value: number;     // 0..1
  peak: number;
  peakAt: number;
};
const stateMap = new WeakMap<HTMLElement, VuState>();
const PEAK_DECAY_MS = 800;
const PEAK_HOLD_MS = 400;

export function setVu(el: HTMLElement, value: number) {
  const v = Math.max(0, Math.min(1, value));
  const now = performance.now();
  const s = stateMap.get(el) ?? { value: 0, peak: 0, peakAt: 0 };

  s.value = v;
  if (v > s.peak) {
    s.peak = v;
    s.peakAt = now;
  }
  stateMap.set(el, s);

  el.style.setProperty('--vu', String(v));
  el.style.setProperty('--vu-peak', String(s.peak));

  // schedule peak decay
  scheduleDecay(el);
}

function scheduleDecay(el: HTMLElement) {
  requestAnimationFrame(() => {
    const s = stateMap.get(el);
    if (!s) return;
    const now = performance.now();
    if (now - s.peakAt > PEAK_HOLD_MS && s.peak > s.value) {
      const dt = (now - s.peakAt - PEAK_HOLD_MS) / PEAK_DECAY_MS;
      s.peak = Math.max(s.value, s.peak - dt);
      el.style.setProperty('--vu-peak', String(s.peak));
      if (s.peak > s.value) scheduleDecay(el);
    }
  });
}
```

**Restrictions:**
- Bottombar grid `320px 1fr 280px`. KHÔNG dùng `minmax()` 4-column legacy layout.
- InfoView background = `var(--inset-0)`, border-top none, border-right `1px solid var(--line-1)`.
- InfoView desc default text Vietnamese: "Hover bất kỳ control nào để xem mô tả + phím tắt." (literal).
- Grand total `font-num` (Inter), 22px (NOT 30px legacy), letter-spacing -0.01em, line-height 1.05.
- Grand currency = 14px `--ink-2` (cùng font), không bao giờ đứng riêng span lớn.
- VU height 4px (line 1530 reference).
- Peak hold dùng pixel-perfect `:after` pseudo, transition 200ms (note: 200ms KHÔNG nằm trong allowed set; document exception cho VU peak: hardcode `transition: left 200ms linear` cho `.x-vu__peak`).

**Exception:** VU peak `transition: left 200ms` được whitelisted trong token lint script (peak decay UX requirement, ≠ instant feedback).

**Checklist:**
- [ ] Bottombar grid 320 / 1fr / 280 explicit
- [ ] InfoView left, breakdown center, grand right
- [ ] Hover topbar Save → InfoView shows "Save Quote" + desc + ⌘S keys (verify via DOM textContent change)
- [ ] Hover sidebar track → InfoView shows branch name + total + breakdown
- [ ] Mouse out → InfoView resets to default after ~60ms
- [ ] Grand total `--vu` CSS var updates với data; LED ladder hairlines mỗi 4px (line 614 reference)
- [ ] Peak hold visible khi total tăng nhanh

**Test gate:**
- G2: `bottombar.png` diff ≤ 2%
- G3: InfoView hover smoke test (Playwright: hover `[data-info]`, expect `#infoName` text changes)
- G1: token lint passes (with VU peak exception)

**Rollback:** `git reset --hard overhaul/phase-6-pass`.

---

### **PHASE 8 — Statusbar**

**Goal:** Statusbar 22px, cells với separator pattern (border-left + padding-left).

**Files touched:**
- `src/renderer/index.html`
- `src/renderer/modules/render-statusbar.ts` — MỚI

**Implementation HTML:**

```html
<div class="x-statusbar">
  <div class="x-statusbar__cell">
    <span class="x-chip">
      <span class="x-chip__dot" id="statusDot"></span>
      <span id="statusRevisionState">SAVED · 14:32</span>
    </span>
  </div>
  <div class="x-statusbar__cell tnum" id="statusQuoteNumber">QUOTE Q-2026-0184</div>
  <div class="x-statusbar__cell tnum" id="statusBranchSummary">3 BRANCHES · 12 LINES</div>
  <div class="x-statusbar__cell" id="statusCycle">CYCLE · MONTHLY</div>
  <div class="x-statusbar__cell" id="statusVersion" style="margin-left:auto; border-left:none;">XMS v1.8 · DARK ABLETON</div>
</div>
```

**Restrictions:**
- Cells dùng `+` selector pattern: `.x-statusbar__cell + .x-statusbar__cell { border-left: 1px solid var(--line-1); padding-left: var(--s-5); }`. Last cell needs `margin-left: auto; border-left: none;` inline override.
- Status chip dot mapping: `--vu-low` (green) khi saved, `--ink-3` (gray) khi draft, `--alert` khi error, `--data` (cyan) khi sent.
- Font Atkinson Hyperlegible 9.5px, letter-spacing 0.06em (đã trong components.css).

**Checklist:**
- [ ] Statusbar height = 22px, padding `0 12px`
- [ ] Background = `var(--shell-0)` (deepest)
- [ ] Cell separators 1px `--line-1`
- [ ] Chip dot color reactive theo state

**Test gate:** G2: `statusbar.png` diff ≤ 2%

**Rollback:** `git reset --hard overhaul/phase-7-pass`.

---

### **PHASE 9 — x-knob bank (vertical drag · pointer lock · double-click reset · shift fine)**

**Goal:** Add x-knob component. Replace discount faders với knob bank (4 knobs: QTG discount, QLQ discount, Account discount, Box discount). Hệ số (coefficient) hiển thị giá trị-only, không drag.

**Files touched:**
- `src/renderer/modules/controllers/knob.ts` — MỚI
- `src/renderer/index.html` — replace `<input type="range" class="x-fader">` chunks bằng `<div class="x-knob">` markup
- `src/renderer/styles/components.css` — đã có x-knob từ phase 1, không thêm

**Implementation TS:**

```typescript
// src/renderer/modules/controllers/knob.ts
type KnobSpec = {
  el: HTMLElement;
  min: number;
  max: number;
  step: number;
  defaultVal: number;
  onChange: (v: number) => void;
};

const knobMap = new WeakMap<HTMLElement, KnobSpec>();
let dragging: KnobSpec | null = null;
let dragStartY = 0;
let dragStartVal = 0;
let usingPointerLock = false;

export function attachKnob(spec: KnobSpec): void {
  knobMap.set(spec.el, spec);

  // Initial render
  setKnob(spec.el, spec.defaultVal);

  spec.el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    dragging = spec;
    dragStartY = e.clientY;
    dragStartVal = currentValue(spec);
    spec.el.classList.add('is-dragging');

    // Pointer lock for infinite drag
    spec.el.requestPointerLock?.();
    usingPointerLock = document.pointerLockElement === spec.el;

    document.addEventListener('pointermove', onMove, { passive: false });
    document.addEventListener('pointerup', onUp, { once: true });
  });

  spec.el.addEventListener('dblclick', () => setKnob(spec.el, spec.defaultVal, true));

  spec.el.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = -Math.sign(e.deltaY);
    const nudge = e.shiftKey ? spec.step : spec.step * 5;
    setKnob(spec.el, currentValue(spec) + delta * nudge, true);
  }, { passive: false });
}

function onMove(e: PointerEvent) {
  if (!dragging) return;
  const dy = usingPointerLock ? -e.movementY : (dragStartY - e.clientY);
  const range = dragging.max - dragging.min;
  const sensitivity = e.shiftKey ? 0.4 : 1;  // shift = fine
  const pixelsPerFullRange = 200;
  const newVal = dragStartVal + (dy / pixelsPerFullRange) * range * sensitivity;
  setKnob(dragging.el, newVal, true);
  if (!usingPointerLock) dragStartY = e.clientY;  // accumulate
  dragStartVal = currentValue(dragging);
}

function onUp() {
  if (!dragging) return;
  dragging.el.classList.remove('is-dragging');
  document.exitPointerLock?.();
  document.removeEventListener('pointermove', onMove);
  dragging = null;
  usingPointerLock = false;
}

function setKnob(el: HTMLElement, val: number, fire = false) {
  const spec = knobMap.get(el)!;
  const clamped = Math.max(spec.min, Math.min(spec.max, val));
  const norm = (clamped - spec.min) / (spec.max - spec.min);
  el.style.setProperty('--val', String(norm));
  const readout = el.querySelector<HTMLElement>('.x-knob__readout');
  if (readout) readout.textContent = formatKnobValue(clamped, spec);
  el.dataset.value = String(clamped);
  if (fire) spec.onChange(clamped);
}

function currentValue(spec: KnobSpec): number {
  return Number(spec.el.dataset.value ?? spec.defaultVal);
}

function formatKnobValue(v: number, spec: KnobSpec): string {
  const unit = spec.el.dataset.unit ?? '';
  const fmt = spec.el.dataset.format ?? 'int';
  const display = fmt === 'int' ? Math.round(v).toString() : v.toFixed(1);
  return display + (unit ? unit : '');
}
```

**HTML update — Section 03 Copyright with knobs:**

```html
<div class="csection">
  <div class="csection__head" data-section="03">
    <span class="csection__idx">03</span>
    <span class="csection__title">Bản quyền</span>
    <span class="eyebrow" style="margin-left:auto;">Nhà nước</span>
  </div>
  <div class="csection__body">

    <div class="x-row">
      <div class="x-row__lhs">
        <button class="x-toggle-pill is-on" id="qtgToggle">BẬT</button>
        <div class="x-row__info">
          <div class="x-row__name">Quyền Tác giả</div>
          <div class="x-row__desc">VCPMC · Hệ số <span id="qtgCoef" class="tnum">1.75</span> · <span id="qtgDur" class="tnum">12.0m</span></div>
        </div>
      </div>
      <div class="x-row__rhs" style="display:flex; gap:24px; align-items:center;">
        <div class="x-knob" id="discountQtgKnob"
             data-min="0" data-max="100" data-default="0" data-format="int" data-unit="%"
             tabindex="0"
             data-info="Discount QTG|Drag dọc · Shift = fine · Double-click reset · Wheel scroll.|—">
          <div class="x-knob__dial"><div class="x-knob__indicator"></div></div>
          <div class="x-knob__readout">0%</div>
          <div class="x-knob__label">Discount</div>
        </div>
        <div class="x-vbox" id="qtgAmount" style="font-size: var(--t-readout); padding: 4px 8px; min-width: 110px;">0 ₫</div>
      </div>
    </div>

    <div class="x-divider" style="margin: var(--s-4) 0;"></div>

    <!-- QLQ same shape -->

  </div>
</div>
```

**Restrictions:**
- Knob size default 44px (var). Có thể giảm xuống 36px ở dense rows nếu cần — set qua `--size` inline.
- Indicator chỉ render bằng CSS gradient + transform — KHÔNG canvas, KHÔNG SVG <path>.
- KHÔNG có animation transition trên rotation — instant feedback.
- Knob phải accessible: `tabindex="0"`, focus shows glass-focus border, keyboard arrow up/down nudges (step), pgup/pgdn = ±10*step.
- Pointer lock graceful fallback: nếu `requestPointerLock` không có (hoặc lockchange fail), fallback dùng client coords accumulate. Test trên Electron mac/win.

**Checklist:**
- [ ] Knob dial 44px circle
- [ ] Indicator rotation -135° → +135° (270° span)
- [ ] Vertical drag changes --val 0..1
- [ ] Double-click → defaultVal
- [ ] Shift+drag = 0.4× sensitivity
- [ ] Wheel = step nudge
- [ ] Focus shows `var(--focus-glow)` ring
- [ ] Pointer lock active during drag (cursor disappears) — verify via `document.pointerLockElement`
- [ ] Reset cursor visible after drag end

**Test gate:**
- G3: knob interaction smoke (Playwright: pointerdown + move + up, expect dataset.value changed)
- G2: knob region screenshot diff ≤ 2% với Design A close-up `Knob bank`

**Rollback:** `git reset --hard overhaul/phase-8-pass`.

---

### **PHASE 10 — Modals (Bulk Add · Settings · Customer · Import)**

**Goal:** All 4 modals dùng x-modal frame. Glass-focus 1px outer ring + 16-20px box-shadow đen (darkroom effect). Bulk Add modal layout match Design A close-up `Bulk Add modal`.

**Files touched:**
- `src/renderer/index.html` — refactor 4 modals
- `src/renderer/modules/render-modals.ts` — MỚI

**Implementation Bulk Add (compact theo close-up):**

```html
<div id="bulkAddModal" class="x-modal hidden">
  <div class="x-modal__overlay"></div>
  <div class="x-modal__panel" style="min-width: 580px;">
    <div class="x-modal__head">
      <div>
        <div class="x-modal__title">Bulk Add</div>
        <div class="x-modal__sub">Branch input grid · template-driven</div>
      </div>
      <button class="x-modal__close" id="closeBulkAdd">×</button>
    </div>
    <div class="x-modal__body" style="padding: var(--s-6); max-height: none;">

      <div class="x-field-row" style="margin-bottom: var(--s-5);">
        <label class="x-field-row__label">Template / Mô hình</label>
        <div class="x-dropdown" id="bulkBusinessType">
          <div class="x-dropdown__display">
            <span class="x-dropdown__value">Chọn mô hình…</span>
            <span class="x-dropdown__caret"></span>
          </div>
          <div class="x-dropdown__menu"><!-- options --></div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: var(--s-5); margin-bottom: var(--s-5);">
        <div class="x-field-row">
          <label class="x-field-row__label">Số stores</label>
          <div class="x-counter">
            <button class="x-counter__btn" id="bulkStoresMinus">−</button>
            <input class="x-counter__input tnum" id="bulkStoresCount" type="number" min="1" value="3">
            <button class="x-counter__btn" id="bulkStoresPlus">+</button>
          </div>
        </div>
        <div class="x-field-row">
          <label class="x-field-row__label">m² / store</label>
          <div class="x-suffix-wrap">
            <input class="x-field x-field--num" id="bulkArea" type="number" value="120">
            <span class="x-suffix">m²</span>
          </div>
        </div>
        <div class="x-field-row">
          <label class="x-field-row__label">Tháng</label>
          <div class="x-counter">
            <button class="x-counter__btn">−</button>
            <input class="x-counter__input tnum" type="number" value="12">
            <button class="x-counter__btn">+</button>
          </div>
        </div>
      </div>

      <div style="margin-top: var(--s-5); padding: var(--s-4); background: var(--inset-0); border: 1px solid var(--line-1); border-radius: var(--r-2); display: flex; justify-content: space-between; align-items: baseline;">
        <span class="label">Estimated total</span>
        <span class="tnum" style="font-family: var(--font-num); font-size: var(--t-readout); font-weight: 600; color: var(--active);" id="bulkEstTotal">0 ₫</span>
      </div>
    </div>

    <div class="x-modal__foot">
      <button class="x-btn" id="cancelBulkAdd">Cancel</button>
      <button class="x-btn x-btn--primary" id="applyBulkAdd">Add 3 stores</button>
    </div>
  </div>
</div>
```

**Settings, Customer, Import modals**: same `x-modal__panel` frame, body uses `.x-field-row` grid.

**Restrictions:**
- Modal panel `border-radius: var(--r-3)` = 3px ceiling. KHÔNG 6px.
- Overlay = `rgba(0,0,0,0.7)`. KHÔNG `backdrop-filter: blur` (Design A spec: no glass blur).
- Panel `box-shadow: 0 0 0 1px var(--active-dim);` (single 1px outer amber-dim ring) ONLY. KHÔNG `0 20px 40px rgba(0,0,0,…)`.
- Cancel/Save text inline (KHÔNG icon).

**Checklist:**
- [ ] All 4 modals refactored
- [ ] Border-radius ≤ 3px verified
- [ ] No drop shadow on panel
- [ ] Glass focus ring on input/dropdown inside modal

**Test gate:**
- G2: `bulk-add-modal.png` diff ≤ 2% với close-up reference
- G1: shadow lint passes (1 panel exception whitelisted)

**Rollback:** `git reset --hard overhaul/phase-9-pass`.

---

### **PHASE 11 — Datepicker · Dropdown · Counter polish**

**Goal:** Verify x-datepicker, x-dropdown, x-counter components rendering chính xác match close-up `Datepicker · open state` + Demo modal dropdown.

**Files touched:**
- `src/renderer/modules/controllers/datepicker.ts` — refactor existing
- `src/renderer/modules/controllers/dropdown.ts` — refactor existing
- `src/renderer/modules/controllers/counter.ts` — MỚI thực ra current code đã có pattern, gather lại

**Datepicker week start = Monday** (Design A reference: `T2 T3 T4 T5 T6 T7 CN`).

**Restrictions:**
- Datepicker popup width 240px (Design A line 486).
- Cells aspect-ratio 1, gap 2px.
- Today indicator: 1px solid `--line-3` border (KHÔNG dashed).
- Selected: `var(--active)` fill, `var(--active-ink)` text, font-weight 700.
- Dim cells (other month): `var(--ink-4)`.
- Dropdown menu max-height 280px, overflow-y auto. Item `padding: 8px 12px`. Selected: `var(--active-dim)` background + `border-left 2px solid var(--active)`.
- Counter button width 26px (KHÔNG 28).

**Checklist:**
- [ ] Datepicker popup 240px
- [ ] Today border `--line-3`
- [ ] Selected fill amber
- [ ] Week starts Monday (T2 first)
- [ ] Dropdown caret rotates -135deg open
- [ ] Counter +/- buttons 26px

**Test gate:**
- G2: `datepicker.png` diff ≤ 2%
- G3: keyboard nav (arrow keys) on datepicker works

**Rollback:** `git reset --hard overhaul/phase-10-pass`.

---

### **PHASE 12 — Faders polish (thumb 3px, instant feedback)**

**Goal:** Existing faders đã có `--val` background fill từ phase 1. Adjust thumb từ 8px rounded → 3px sharp Design A spec.

**Files touched:**
- `src/renderer/styles/components.css` is canonical. **Verify** matches:

```css
.x-fader::-webkit-slider-thumb {
  width: 3px;       /* NOT 8 */
  height: 18px;
  background: var(--ink-1);
  border-radius: 0; /* NOT 2 */
  margin-top: -8px;
  border: none;
}
.x-fader:hover::-webkit-slider-thumb { transform: scaleX(1.6); }
.x-fader:focus-visible::-webkit-slider-thumb { background: var(--active); transform: scaleX(2); }
```

**Restrictions:**
- KHÔNG có drop shadow trên thumb.
- Track `4px` height (NOT 6).
- Active fader fill = `var(--active)` (amber), data fader variant = `var(--data)` cyan.

**Checklist:**
- [ ] Thumb 3px wide × 18px tall
- [ ] Track 4px tall
- [ ] Hover thumb scaleX(1.6)
- [ ] Focus thumb amber + scaleX(2)
- [ ] Var --val drives gradient fill

**Test gate:** G2 fader region

**Rollback:** `git reset --hard overhaul/phase-11-pass`.

---

### **PHASE 13 — Motion sweep (kill 200ms / pulse / shadow remnants)**

**Goal:** Audit toàn bộ codebase, đảm bảo I4/I5 invariants. Strip mọi `transition: 200ms`, `transition: 150ms`, `animation: pulse-active-btn`, `animation: vat-active-breathe`, drop shadow vendor chrome.

**Files touched:**
- Run `npm run policy:tokens`. Mọi violation → fix tại chỗ → re-run cho đến pass.
- `src/renderer/styles/app.css` — deep audit
- `src/renderer/styles/components.css` — should be clean (copy nguồn)

**Restrictions:**
- Không có animation block ngoài VU peak decay.
- Không có `box-shadow` ngoài `--focus-glow` và glass overlay extension.
- Tất cả `transition` chỉ chứa `0ms`, `90ms`, `140ms`, `400ms`, hoặc 200ms-VU-peak whitelisted.

**Checklist:**
- [ ] `grep -r "200ms\|150ms\|180ms\|300ms" src/renderer/styles/` returns empty (sau strip)
- [ ] `grep -r "animation:" src/renderer/styles/` chỉ xuất hiện trong VU peak (nếu có)
- [ ] `grep -r "rgba(0, *0, *0, *0\.[1-9]" src/renderer/styles/` empty trừ overlay backdrop

**Test gate:**
- G1: token lint pass full
- G2: visual diff all 5 regions pass

**Rollback:** `git reset --hard overhaul/phase-12-pass`.

---

### **PHASE 14 — Quote chain panel reflow (revisions)**

**Goal:** Current sidebar có `quote-history-panel` với revision-list 3-column item — không match Design A. Refactor revisions thành **secondary modal** (Cmd+R) hoặc fold vào dropdown trên topbar.

**Decision:** Move revisions UI từ sidebar sang topbar dropdown gắn với breadcrumb middle item. Sidebar chỉ giữ "QUOTE CHAIN" eyebrow + active revision number compact.

**Files touched:**
- `src/renderer/index.html`
- `src/renderer/modules/render-revisions.ts` — MỚI
- `src/renderer/styles/app.css` — drop `.quote-history-panel`, `.revision-list`, `.revision-item` rules

**Restrictions:**
- Revision list dùng `.x-track` repurposed pattern (color rail + name + meta). KHÔNG re-define new visual.

**Checklist:**
- [ ] Sidebar height freed up (no large quote history block)
- [ ] Topbar breadcrumb quote item shows revision badge `R3` + caret → opens dropdown of revisions
- [ ] Dropdown uses `.x-dropdown__menu` + `.x-dropdown__item` styling
- [ ] Active revision marked with `.is-selected`

**Test gate:**
- G2: sidebar.png + topbar.png diff
- G3: revision dropdown click → switches active revision

**Rollback:** `git reset --hard overhaul/phase-13-pass`.

---

### **PHASE 15 — Final QA · DESIGN.md update · CHANGELOG**

**Goal:** Update `DESIGN.md` để document Dark Ableton + glass-focus extension + 70-color palette + x-* component contract. Capture before/after screenshots. Open PR.

**Files touched:**
- `DESIGN.md` — rewrite sections 2 (Color Palette), 3 (Components), 4 (Constraints) để khớp với tokens.css/palette.css/components.css. Thêm section "Glass Focus Extension" và "70-Color Branch Palette".
- `CHANGELOG.md` — entry "1.8.0 — Dark Ableton design language overhaul"
- `DESIGN-AUDIT.md` — refresh audit ngày mới, expect zero high-severity findings

**Final checklist (mọi item phải tick):**
- [ ] All 5 visual diff regions ≤ 2%
- [ ] `npm run policy:tokens` exit 0
- [ ] `npm run policy:classes` exit 0
- [ ] `npm test` pass
- [ ] `npm run typecheck` pass
- [ ] `npm run lint` pass
- [ ] `npm run build` produces working `out/` dir, smoke open in Electron
- [ ] Knob: drag, double-click reset, shift fine, wheel — all work
- [ ] InfoView: hover any `[data-info]` updates name/desc/shortcut, blur resets
- [ ] VU peak hold: spike grand total → bar grows + peak indicator stays 400ms before decaying
- [ ] All 4 modals open/close, focus trap working
- [ ] Side-by-side review live app vs Design A demo HTML at 1440×900 — no jarring difference
- [ ] DESIGN.md zero stale references to old palette (`--bg-*`, Space Grotesk, pear, picton)

**Test gate:** G1 + G2 + G3 + G4 + G5 ALL PASS.

**PR open command:**

```bash
mcp__github__create_pull_request \
  --owner mhd-quan --repo xms-calc \
  --base main --head claude/redesign-app-interface-0IdMt \
  --title "feat(ui): v1.8 Dark Ableton overhaul (Design A 1:1)" \
  --body <see template below>
```

PR body template:

```
## Summary
- Adopts xms-design-system tokens.css/palette.css/components.css 1:1 (no aliases)
- Refactors layout to x-* prefix component contract
- Adds x-knob bank (pointer-lock vertical drag, double-click reset, shift fine)
- Adds x-infoview (bottom-left contextual hover with shortcut keys)
- Adds x-vu meter w/ peak hold for grand total
- Strips drop shadows, pulse animations, 200ms transitions
- Migrates Space Grotesk → Inter + Atkinson Hyperlegible
- Caps border-radius at 3px (panel ceiling)

## Test plan
- [ ] `npm run policy:tokens` exits 0
- [ ] `npm run visual:test` all 5 regions ≤ 2% diff vs Design A baseline
- [ ] `npm test && npm run typecheck && npm run lint` pass
- [ ] Knob smoke: hover discount knob, drag, dbl-click reset
- [ ] InfoView smoke: hover any control, info updates
- [ ] Side-by-side at 1440×900 vs Design A demo HTML — visually identical chrome
```

---

## 3. ADDITIONAL DESIGN-SYSTEM ELEMENTS TO INTEGRATE

User cho phép đề xuất thêm. Đây là 5 elements phù hợp với scope, mức effort thấp, ROI cao:

### 3.1 `x-vbox` value boxes everywhere

Thay tất cả inline numeric displays (hệ số, duration in months, totals) thành `<span class="x-vbox tnum">…</span>`. Pattern khá nhỏ (28px min-width, 1px line-2 border, inset-0 background, font-num) nhưng cực kỳ legibility-boosting cho number-heavy UI. **Effort:** 1h. **Phase:** 6 (cùng csection refactor).

### 3.2 Eyebrow strip cho mỗi section

Mỗi csection head có eyebrow tag right-aligned. Đã có trong markup phase 6, just verify usage of `.eyebrow` class consistently. **Effort:** included.

### 3.3 Pointer-lock scrubbable `x-vbox--scrub`

Cho phép user drag bất kỳ `.x-vbox` numeric nào (area, salary, duration) như scrub pad — same pattern as knob nhưng horizontal. Ableton cho phép scrub mọi value field. **Effort:** 3h. **Phase:** 9 extension. Recommend opt-in qua attribute `data-scrub="true"` để không bừa bãi.

### 3.4 Status chip variants for revision states

`.x-chip--status-draft` (gray dot), `.x-chip--status-saved` (green/vu-low), `.x-chip--status-sent` (cyan/data), `.x-chip--status-accepted` (amber/active), `.x-chip--status-rejected` (red/alert). Wire vào sidebar header + statusbar. **Effort:** 30min. **Phase:** 4+8.

### 3.5 Glass focus ring on `work__title` inline edit

Branch name inline-edit hiện tại là input không affordance — hover/focus shows full glass-focus extension. Pattern document trong design system Section "Glass Focus Extension — documented departure". **Effort:** included Phase 5.

**Khuyến nghị:** Include 3.1, 3.2, 3.4, 3.5 ở các phase tương ứng (zero extra phase). 3.3 (scrub) defer sang v1.9 vì cần riêng UX testing.

---

## 4. RISK REGISTER

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Pointer Lock API broken on some Electron versions | Med | Med | Fallback pattern trong knob.ts; smoke test mac+win |
| Inter font CDN slow on cold start | Low | Low | Self-host font files in `assets/fonts/` (defer to v1.9) |
| Visual diff threshold 2% quá strict cho text-content variation | High | Med | Dùng `mask` regions cho text content fields, only assert chrome shapes/colors |
| Vanilla TS module split breaks `renderScope` dirty-flag invariants | Med | High | Keep render orchestration in app.ts; modules expose pure render functions taking state |
| Knob conflicts with native focus-visible on tab nav | Low | Low | `tabindex=0` + arrow key handling explicitly |
| User keyboard shortcuts (Cmd+S etc.) collide with Electron menus | Med | Med | Register only via `data-info` for InfoView display, hook actual handlers in app.ts main keymap |
| Refactor breaks IPC quote save/load | Med | High | Domain logic untouched; only DOM markup changes; smoke via `npm test` quote-payload tests |

---

## 5. EFFORT ESTIMATE

| Phase | Hours |
|-------|-------|
| 0  Tooling + baseline | 4 |
| 1  Foundation CSS | 2 |
| 2  Layout shell | 2 |
| 3  Topbar | 3 |
| 4  Sidebar | 5 |
| 5  Workbench frame | 3 |
| 6  csections refactor | 8 |
| 7  Bottombar + InfoView + VU | 6 |
| 8  Statusbar | 1 |
| 9  Knobs | 6 |
| 10 Modals | 4 |
| 11 Datepicker/Dropdown polish | 3 |
| 12 Faders | 1 |
| 13 Motion sweep | 2 |
| 14 Revisions reflow | 3 |
| 15 Final QA + docs | 4 |
| **Total** | **57 hours** |

Realistic 1.5-2 weeks for one engineer FT, hoặc 3-4 weeks part-time với buffer cho redo task fail gates.

---

## 6. STARTING ORDER (NEXT ACTIONS)

Khi plan này được approve:

1. **Phase 0** — setup tooling (Playwright + lint scripts), capture baselines từ Design A artboard. **Không touch UI.**
2. Run G1 (token lint trên current code) → expect failures → script verified working.
3. Tag `overhaul/phase-0-pass`, push.
4. Open Phase 1.

---

*End of plan. Source of truth: `xms-design-system @ 18af210` · Plan version 1.0 · Author: Senior FE/UX, XMS · Date: 2026-04-30.*

# DESIGN-AUDIT.md - XMS Calculator v1.8.0

**Date:** 2026-05-02
**Scope:** Dark Ableton renderer overhaul, Phase 0 through Phase 15.
**Sources:** `UI-OVERHAUL-PLAN-1.8.md`, `DESIGN.md`,
`src/renderer/styles/tokens.css`, `src/renderer/styles/palette.css`,
`src/renderer/styles/components.css`, `src/renderer/styles/app.css`,
`src/renderer/index.html`, and renderer controllers/modules.

## 1. Executive Summary

The renderer now implements the v1.8 Dark Ableton direction as the active design
system. The old audit findings have been resolved or superseded by the new
contract:

- The renderer uses a closed token namespace built around `shell`, `inset`,
  `line`, `ink`, `active`, `data`, `alert`, `vu`, and `p-*` branch colors.
- Component primitives use the `x-*` namespace; layout classes compose those
  primitives instead of redefining visual language from scratch.
- Active state is a restrained amber accent. Data state is a secondary cyan
  accent. Branch colors come from the 70-color palette and remain content-led.
- Shadows are limited to focus/ring affordances. No elevation shadows remain in
  renderer CSS.
- Motion is limited to instant, quick, structural, and meter durations.

**High-severity findings:** 0.

## 2. Token Audit

`npm run policy:tokens` exits 0.

Current token families:

| Family | Contract |
|---|---|
| `--shell-*` | app and panel depth |
| `--inset-*` | recessed fields and meter troughs |
| `--line-*` | 1px border hierarchy |
| `--ink-*` | text hierarchy |
| `--active*` | selected, focus, CTA, active fill |
| `--data*` | secondary data accent |
| `--alert*` | error states |
| `--vu-*` | VU meter gradient |
| `--p-*` | branch identity palette |

No legacy renderer token aliases are used in active CSS.

## 3. Class Namespace Audit

`npm run policy:classes` exits 0 after tightening the checker to parse CSS
comments and imports correctly and to allow documented utility namespaces.

Allowed selector groups:

- `x-*` component primitives.
- App layout namespaces: `app`, `topbar`, `sidebar`, `work`, `bottombar`,
  `csection`, `line`, and `csbody-grid`.
- Utilities: `eyebrow`, `label`, `title`, `tnum`, `num`, `dot`, `count`,
  `hidden`, `is-*`, and `palette-matrix*`.

The policy now matches invariant I2 from the overhaul plan instead of treating
layout selectors as component namespace violations.

## 4. Component Audit

| Component | Status | Notes |
|---|---|---|
| Shell grid | Pass | 44px topbar, work area, 44px bottombar, 22px statusbar |
| Sidebar tracks | Pass | `x-track` with branch color rail, badge, meta, VU |
| Bottombar | Pass | full-width info view, totals, VAT, VU meter |
| Statusbar | Pass | compact cells, separators, reactive status dot |
| Knobs | Pass | drag, wheel, shift fine, double-click reset |
| Datepicker | Pass | 240px popup, Monday-first grid, keyboard navigation |
| Dropdowns | Pass | 280px max menu, keyboard selection, active left rail |
| Counters | Pass | 26px buttons, spinbutton semantics |
| Modals | Pass | four modal frames use `x-modal`, scrim, focus trap |
| Revision chooser | Pass | topbar breadcrumb dropdown using `x-track` rows |

## 5. Motion And Shadow Audit

No CSS `animation:` or `@keyframes` blocks remain in renderer styles. Pattern
checks for `150ms`, `180ms`, `200ms`, and `300ms` in renderer styles return no
matches.

Approved durations:

- `--t-instant`: 0ms, hover/active feedback.
- `--t-quick`: 90ms, tiny indicator motion.
- `--t-struct`: 140ms, structural show/hide.
- `--t-meter`: 400ms, VU and value motion.

Box-shadow usage is limited to:

- `var(--focus-glow)` for focus-visible states.
- `0 0 0 1px var(--active-dim)` for popup/modal rings.

The modal scrim remains a black overlay and is the only approved black alpha
separation layer.

## 6. Documentation Audit

`DESIGN.md` has been rewritten to match the shipped v1.8 renderer contract. It
now documents:

- Dark Ableton direction.
- Structural neutral palette.
- Semantic accent contracts.
- 70-color branch palette.
- `x-*` component namespace.
- Glass focus extension.
- PDF output variant separation.

The document no longer describes the superseded app palette or typography.

## 7. Remaining Non-Blocking Risks

- The visual baseline test currently captures the Design A reference artboard,
  not a full app-vs-reference diff harness. It is still useful as a regression
  signal, but manual side-by-side review remains necessary for final release.
- Several workflow buttons are currently optional in `app.ts` and absent from
  the topbar (`newQuoteBtn`, `newRevisionBtn`, `importPdfBtn`). This is not a
  visual regression from Phase 15, but final product workflow review should
  decide whether they should return as compact icon actions.
- The package version remains at the repo's release baseline until an explicit
  version bump/release flow is requested.

## 8. Audit Verdict

Phase 15 closes the design documentation debt for the v1.8 overhaul. The active
renderer CSS, component contract, token policies, and DESIGN documentation now
describe the same system.

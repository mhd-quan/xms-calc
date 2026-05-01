# XMS Calculator Design System

## 1. Direction

XMS Calculator v1.8 uses a Dark Ableton operating language: dense, flat,
instrument-grade controls for quote calculation work. The UI is not a marketing
surface. It is a single-window desktop tool optimized for scanning, repeated
editing, and fast quote-chain decisions.

The source of truth for renderer UI is:

- `src/renderer/styles/tokens.css`
- `src/renderer/styles/palette.css`
- `src/renderer/styles/components.css`
- Layout composition in `src/renderer/styles/app.css`

The active app variant is `XMS v1.8 - Dark Ableton`.

## 2. Color Palette

### 2.1 Structural Neutrals

Depth is created through adjacent charcoal layers and 1px borders, not elevation
shadows.

| Token | Value | Contract |
|---|---:|---|
| `--shell-0` | `#1a1c20` | Outermost app frame, status bar |
| `--shell-1` | `#22252a` | Default workbench and track row base |
| `--shell-2` | `#2a2d33` | Sidebar, topbar, bottom bar, popup bodies |
| `--shell-3` | `#32363d` | Active rows and section headers |
| `--shell-4` | `#3c4047` | Hover and pressed neutral state |
| `--shell-5` | `#494e57` | Medium stroke or disabled active state |
| `--inset-0` | `#14161a` | Recessed inputs and data fields |
| `--inset-1` | `#0e1014` | Deep troughs and meter bases |

### 2.2 Lines And Ink

| Token | Value | Contract |
|---|---:|---|
| `--line-1` | `#2e3138` | Default hairline separator |
| `--line-2` | `#3c4047` | Strong control border |
| `--line-3` | `#5b6069` | Strong neutral focus border |
| `--ink-1` | `#e6e8ec` | Primary text and active labels |
| `--ink-2` | `#b6bac1` | Secondary labels |
| `--ink-3` | `#878c95` | Units, meta text, tertiary labels |
| `--ink-4` | `#5d6168` | Disabled and dim text |
| `--ink-5` | `#3f434a` | Ghost dividers and low-emphasis dots |

### 2.3 Semantic Accents

| Token | Value | Contract |
|---|---:|---|
| `--active` | `#ffb43a` | Primary selected state, CTA fill, focus border |
| `--active-hover` | `#ffc257` | Hover over active fill |
| `--active-press` | `#f0a420` | Pressed active fill |
| `--active-dim` | `rgba(255, 180, 58, 0.14)` | Active tint and overlay ring |
| `--active-glow` | `rgba(255, 180, 58, 0.28)` | Approved focus glow extension |
| `--active-ink` | `#1a1410` | Text on active fill |
| `--data` | `#5cd4c4` | Secondary data accent and sent state |
| `--alert` | `#ff5c5c` | Error and rejected state only |
| `--vu-low` | `#4ade80` | Safe meter range |
| `--vu-mid` | `#fde047` | Caution meter range |
| `--vu-high` | `#ef4444` | High meter range |

### 2.4 70-Color Branch Palette

Branch identity colors are content accents, not chrome. The matrix is
`--p-{stone,rust,amber,moss,teal,indigo,mauve}-{1..10}`: seven hue families,
ten steps each. Use these for branch rails, badges, swatches, and track rows.
Do not use them for global button states, focus, or app frame color.

## 3. Typography

The renderer uses three font roles:

| Token | Stack | Usage |
|---|---|---|
| `--font-ui` | `Inter`, system UI fallback | Primary controls and labels |
| `--font-label` | `Atkinson Hyperlegible`, `Inter` fallback | Eyebrows, dense labels, microcopy |
| `--font-num` | `Inter`, `SF Mono`, monospace fallback | Tabular numbers and quote identifiers |

The body must keep `font-feature-settings: 'tnum' 1, 'cv11' 1, 'ss03' 1`.
Letter spacing is controlled by `--track-*` tokens and must not be negative in
compact UI containers.

## 4. Components

### 4.1 Component Contract

Reusable component selectors live in `components.css` and use the `x-*`
namespace. Layout and workflow selectors live in `app.css` and may use
`app`, `topbar`, `sidebar`, `work`, `bottombar`, `csection`, `line`, and
feature-specific descendants.

Shared primitives:

- `x-btn`: rectangular command, toggle, and primary action buttons.
- `x-field`, `x-field-row`, `x-suffix-wrap`: form controls and labels.
- `x-dropdown`: menu chooser with keyboard selection and active left rail.
- `x-datepicker`: 240px calendar popup, Monday-first grid, keyboard navigation.
- `x-counter`: 26px +/- controls with spinbutton input semantics.
- `x-knob`: vertical drag, wheel, shift fine-adjust, double-click reset.
- `x-vu`: real-time meter with 400ms peak hold/decay behavior.
- `x-infoview`: bottom-left contextual help driven by `[data-info]`.
- `x-modal`: modal frame with focus trap and scrim separation.
- `x-track`: reusable row pattern for branches and revision dropdown items.

### 4.2 Quote Chain UI

The sidebar remains compact: quote chain eyebrow, active revision chip, customer
summary, and branch track list. Revision selection lives in the topbar
breadcrumb quote item. The dropdown reuses `x-dropdown__menu`,
`x-dropdown__item`, and `x-track`; the active revision must be marked
`.is-selected`.

## 5. Constraints

- Token namespace is closed. Additions require updating token policy and this
  document in the same change.
- Radius ceiling is 2px for controls and 3px for panels/modals. Circular dots
  are the only exception.
- Box shadow is limited to `--focus-glow` and the documented glass focus ring.
  There are no elevation shadows.
- Motion durations are limited to `0ms`, `90ms`, `140ms`, and `400ms`.
- Active amber is reserved for selected state, primary CTA, focus, and active
  meter/readout signals.
- The app shell is dense by default. Avoid decorative cards, hero sections,
  floating page panels, or copy that explains the UI inside the UI.

## 6. Glass Focus Extension

The only approved decorative departure from strict flatness is the glass focus
extension:

- `--focus-glow`: active border plus 8px active glow for focused controls.
- `box-shadow: 0 0 0 1px var(--active-dim)`: popup and modal panel ring.

This is a focus affordance, not elevation. It must not be used for hover chrome,
ambient glow, decorative panels, or inactive surfaces.

## 7. PDF Output Variant

The quote PDF template remains a separate light output variant. It is optimized
for exported documents, printing, and client review. Do not force the dark app
palette into `src/templates/quote/`. Shared brand tone is achieved through
layout discipline, typography hierarchy, and quote identity metadata rather than
matching renderer colors.

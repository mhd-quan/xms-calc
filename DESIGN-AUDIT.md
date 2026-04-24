# DESIGN-AUDIT.md — XMS Calculator v1.6.6

**Auditor:** automated pass per REORG-PLAN.md §Phase 6.
**Date:** 2026-04-24.
**Scope:** read-only. No CSS edits in this pass.
**Sources:** `DESIGN.md`, `src/renderer/styles/styles.css`, `src/templates/quote/template.css`, `src/renderer/index.html`, `src/templates/quote/template.html`.

---

## 1. Executive Summary

The app and PDF template do not cohere as a single design system. The app uses a dark Ableton-adjacent theme centered on `#1e1e22` backgrounds, Space Grotesk, and three distinct accent colors (pear `#CFF533`, picton `#44CCFF`, DAW orange `#FF8B00`). The PDF template uses a light neutral palette (`#f8f8f6` base), Lexend as the display font, and system fonts for body text. The split is tonally intentional — light output for print, dark interface for screen — but it is undocumented: `DESIGN.md` has no "PDF variant" section, and `template.css` has no comment acknowledging the departure.

Against the spec in `DESIGN.md`, the shipped app is adjacent but non-compliant across all four measurable dimensions: color, typography, flatness, and border radius. The deviations are systematic, not accidental — they represent deliberate design evolution post-spec. The honest resolution is to update `DESIGN.md` to reflect what was actually shipped, then lock both variants explicitly.

---

## 2. Color Palette Compliance

**DESIGN.md spec:**

| Token | Spec value | Usage |
|---|---|---|
| Background (Deep) | `#212121` | Main canvas |
| Panel Surface | `#323232` | Device racks, browser |
| Control Surface | `#454545` | Inactive buttons |
| Text (Primary) | `#cccccc` | Labels, values |
| Active Accent | `#ff9e00` | Active state |

**`styles.css` actual** (lines 8–31):

| Token | Actual value | Delta from spec |
|---|---|---|
| `--bg-root` | `#1e1e22` | Darker than `#212121`; purple-shifted |
| `--bg-surface` | `#1a1a1e` | Significantly darker than `#323232` |
| `--bg-elevated` | `#28282e` | No spec equivalent |
| `--text-primary` | `#e8e8ec` | Lighter than `#cccccc`; also purple-shifted |
| `--daw-orange` | `#FF8B00` | Close to spec `#ff9e00`; slightly warmer |
| `--pear` | `#CFF533` | **Not in spec.** Chartreuse accent used for primary focus, active states, selection highlight |
| `--picton` | `#44CCFF` | **Not in spec.** Cyan accent used for datepicker, counter inputs, bulk actions |
| `--daw-yellow` | `#FFD300` | **Not in spec.** Used for secondary faders |

**Verdict:** Non-compliant. The shipped palette is tonally darker, more purple-shifted, and uses three accent colors against the spec's one. The grays read as a purple-near-black theme rather than a neutral dark gray. Pear and picton are the dominant interactive accents in practice; the spec's orange plays a supporting role. This is a coherent design language — it just is not the one described in `DESIGN.md`.

---

## 3. Typography Compliance

**DESIGN.md spec:** Condensed sans-serif (Ableton Sans or tight Inter/Helvetica), 9–14px, uppercase section headers.

**`styles.css` actual** (line 34):
```
--font: 'Space Grotesk', 'Lexend', system-ui, -apple-system, sans-serif;
```
Space Grotesk is a geometric sans-serif with moderate weight contrast and low-x-height. It is not condensed. `letter-spacing: -0.01em` is applied globally (line 45), which slightly tightens it but does not substitute for a condensed typeface.

Sizes in use: 9px (line 85), 10px (lines 80, 183, 196), 11px (lines 80, 137, 178, 318, 388), 12px (lines 178, 265), 13px (line 210), 14px (lines 126, 251), 15px (line 560), 16px (line 76), 18px (line 76 brand name). Upper end exceeds the 14px spec ceiling.

**`template.css` actual** (lines 37–38):
```
--title-font: 'Lexend', 'SF Pro Display', 'Avenir Next', system-ui, sans-serif;
--body-font: 'SF Pro Text', 'Avenir Next', 'Helvetica Neue', Arial, sans-serif;
```
Two separate font stacks in the template: Lexend for titles (self-hosted .ttf, lines 1–20), system fonts for body. Sizes range from 6.8px (line 46) to 24px (line 174) — tighter than the app, calibrated for PDF print density.

**Font inventory across the product:**

| Context | Primary font | Secondary font | Status |
|---|---|---|---|
| App UI | Space Grotesk (Google Fonts CDN) | system-ui fallback | Not condensed; not in spec |
| PDF titles | Lexend (self-hosted) | SF Pro Display fallback | Not in spec |
| PDF body | SF Pro Text | Helvetica Neue fallback | Not in spec |

Three fonts across two contexts. The `--font` variable in `styles.css` lists Lexend as a fallback (line 34), meaning if Space Grotesk fails to load, the app falls back to Lexend — the same typeface the PDF uses. This is an accidental partial consistency that is not intentional.

**Verdict:** Non-compliant. No condensed typeface in use. Spec's typography section is aspirational, not descriptive of the shipped product.

---

## 4. Visual Flatness Compliance

**DESIGN.md spec (§4.5):** "No Drop Shadows. The UI is completely flat. Depth is created through value changes and thin borders."

**`styles.css` box-shadow inventory:**

| Line | Value | Component | Severity |
|---|---|---|---|
| 91–92 | `0 0 2px…10px var(--glow-color)` | Pulse animation keyframes | Low — ambient glow, animated |
| 102 | `0 0 6px var(--pear-glow)` | Sidebar status dot | Low — decorative |
| 365 | `0 14px 36px rgba(0,0,0,0.35)` | Dropdown panel card | **High** — large elevation shadow |
| 431 | `0 1px 0 var(--pear), 0 4px 12px rgba(207,245,51,0.15)` | Bulk action bar | Medium — accent underline + glow |
| 453 | `0 0 0 1px … 0 0 12px var(--bulk-action-glow)` | Bulk grid container | Medium — outer glow ring |
| 564 | `0 0 0 2px var(--pear-dim)` | Field focus ring | Medium — focus indicator |
| 582–583 | `0 0 0 1px var(--pear), 0 0 8px rgba(207,245,51,0.2)` | Dropdown focus/open | Medium — glow ring |
| 596 | `0 10px 30px rgba(0,0,0,0.5)` | Dropdown options panel | **High** — strong drop shadow |
| 617–618 | `0 0 0 1px var(--picton), 0 0 8px rgba(68,204,255,0.2)` | Datepicker focus/open | Medium — glow ring |
| 632 | `0 10px 30px rgba(0,0,0,0.5)` | Datepicker panel | **High** — strong drop shadow |
| 741 | `inset 0 0 10px var(--glow-color)` | Fader track inset | Low — inner glow |
| 785–786 | `0 0 4px…8px var(--pear-glow)` | Fader thumb hover/active | Low — thumb glow |
| 938 | `0 20px 40px rgba(0,0,0,0.5)` | Modal content | **High** — heaviest shadow |
| 1044 | `0 0 8px color-mix(…)` | Bulk row highlight | Low — row glow |

**Verdict:** Non-compliant at four high-severity points (lines 365, 596, 632, 938). The dropdown panels and modal use conventional elevation shadows that contradict the flat spec explicitly. The glow rings on focus states (lines 564, 582, 617) are a deliberate departure: Ableton Live uses flat border-highlight focus indicators, not radial glows. Glows are closer to a "glass/neon" aesthetic than Ableton's flat-mechanical one.

The focus glows are not random — they are a coherent secondary design decision, using accent colors as luminosity indicators. If kept, they should be documented in `DESIGN.md` as a conscious extension ("glass focus system").

---

## 5. Rounded Corners Compliance

**DESIGN.md spec (§4.1):** "No rounded corners (or extremely minimal, e.g., 2px for buttons)."

**`styles.css` border-radius inventory (non-compliant instances):**

| Line | Value | Component | Compliant? |
|---|---|---|---|
| 54 | `4px` | Scrollbar thumb | Borderline |
| 100 | `50%` | Sidebar pulse dot | Justified (dot must be circular) |
| 112 | `10px` | Profile/client card | **No** |
| 154 | `8px` | Business type selector card | **No** |
| 192 | `999px` | Business type badge (pill) | **No** |
| 354 | `999px` | Topbar action pill chip | **No** |
| 363 | `12px` | Dropdown card container | **No** |
| 384 | `8px` | Dropdown option item | **No** |
| 938 | `6px` | Modal content | **No** |

Compliant instances (2–3px): lines 228, 235, 245, 271, 283, 297, 438, 497, 529, 560, 578, 596, 613, 632, 642, 656, 682, 695, 710, and throughout bulk grid. The majority of interactive controls are 3px or below, which is within the spirit of the spec.

The violations cluster at two component types: floating panels (dropdowns, modal) using 10–12px radii, and pill shapes (999px) used for badge and topbar chips. The pill shapes read as "tag/badge" affordance rather than Ableton-style rectangular controls.

**Verdict:** Non-compliant at nine instances. The 2–3px convention is followed for most controls; the violations are concentrated in overlay containers and badge components.

---

## 6. Information Density

No screenshot available in this audit pass. Qualitative observation based on CSS structure: sidebar is fixed at `280px` (line 67) with a `480px` minimum window height. The main panel uses flex layout with a top controls area and a scrollable content zone. Padding values throughout are moderate (8–16px on panels, 10–12px on inputs). The bulk grid component appears to maximize density — rows are compact with small padding and tightly spaced faders. The quote card panel at the bottom uses `12–16px` padding. Overall density appears medium-high for a desktop app, consistent with the spec's intent, though not as compressed as Ableton Live's actual interface where 8px or less is common for internal spacing.

---

## 7. Component-Level Gap List

| Component | DESIGN.md rule violated | File:line | Severity | Suggested fix |
|---|---|---|---|---|
| Topbar action chips | No rounded corners (§4.1): uses `999px` | `styles.css:354` | High | Replace pill with `border-radius: 2px`; use fill color change for active state |
| Business type badge | No rounded corners (§4.1): uses `999px` | `styles.css:192` | Medium | Cap at `3px`; pill affordance not needed for a status tag |
| Dropdown panel card | No drop shadows (§4.5): `0 14px 36px …` and `border-radius: 12px` | `styles.css:363–365` | High | Remove elevation shadow; use 1px border + slightly lighter background for separation; cap radius at 3px |
| Dropdown option items | No rounded corners (§4.1): `8px` | `styles.css:384` | Medium | Reduce to `2px` or `0` |
| Dropdown/datepicker focus | No drop shadows (§4.5): glow rings on focus | `styles.css:582, 617` | Medium | Document as "glass focus" extension, or replace with flat `border-color` only |
| Floating panel (datepicker/dropdown list) | No drop shadows (§4.5): `0 10px 30px …` | `styles.css:596, 632` | High | Remove shadow; border `1px solid var(--border-dim)` is sufficient at this background darkness |
| Modal | No drop shadows (§4.5): `0 20px 40px …`, `border-radius: 6px` | `styles.css:938` | High | Remove shadow; scrim overlay (`rgba(0,0,0,0.6)` backdrop) creates separation without elevation |
| Client card | No rounded corners (§4.1): `10px` | `styles.css:112` | Medium | Reduce to `3px` |
| Business type selector | No rounded corners (§4.1): `8px` | `styles.css:154` | Medium | Reduce to `3px` |
| PDF template header | Not in DESIGN.md scope (light variant) | `template.css:63, 79` | N/A — intentional | Document light variant explicitly in DESIGN.md |

---

## 8. PDF Template vs. App Divergence

The PDF template is a deliberate light-theme variant for print output. This is functionally correct — dark backgrounds print poorly and increase ink usage. The divergence is intentional. The problem is it is not documented anywhere.

**App design language:**
- Background: near-black purple-gray (`#1e1e22`)
- Accents: pear, picton, DAW orange
- Font: Space Grotesk (screen-optimized, variable weight)
- Mode: interactive, state-driven, high contrast for low-light screens

**PDF template design language** (`template.css`):
- Background: warm off-white (`#f8f8f6`, line 29)
- Accents: black header bar (`#000`, line 79), dark footer (`#222`, line 189), table shading in warm grays
- Font: Lexend (display), SF Pro Text (body) — both legible at small PDF sizes
- Mode: static, print-density layout, light background for physical and digital viewing

These are genuinely two separate design systems serving different output contexts. That is defensible. What is not defensible is having no documentation of this split, which means a new contributor has no basis for knowing whether the template is supposed to match the app or diverge.

**Required addition to `DESIGN.md`:** A "PDF Output Variant" section with its own palette and typography table, explicitly acknowledging the dark/light split and locking the Lexend + warm-gray stack as the standard for all exported documents.

---

## 9. Recommendations Ranked by Leverage

### Tier 1 — Cheap, high leverage

1. **Update `DESIGN.md` to match shipped code.** The spec describes an intended design; the code is the actual design. Write a 20-line addendum to `DESIGN.md` that (a) documents the actual palette tokens with hex values, (b) names Space Grotesk as the official app font, (c) names the glass-focus system as a deliberate extension, (d) adds a "PDF Output Variant" section for Lexend + warm-gray. This costs one hour and closes the entire documentation debt.

2. **Cap border-radius at 3px for rectangular controls.** Find-replace `border-radius: 12px` (line 363) → `3px`, `border-radius: 10px` (line 112) → `3px`, `border-radius: 8px` (lines 154, 384) → `3px`, `border-radius: 6px` (line 938) → `3px`. Spot-review each change visually. The pill shapes (999px) are a separate decision — see Tier 2.

### Tier 2 — Medium effort

3. **Consolidate typography.** Space Grotesk is loaded from Google Fonts CDN (line 9–11 of `index.html`), which creates a network dependency on startup. Self-hosting Space Grotesk alongside Lexend would eliminate the dependency and give the product a fully offline-capable font stack. Also: the `--font` fallback chain (Space Grotesk → Lexend → system-ui) creates accidental Lexend rendering if Google Fonts is unreachable. Either remove Lexend from the app fallback, or make the split intentional and documented.

4. **Decide on pill shapes.** The 999px pill badges (lines 192, 354) are a non-Ableton pattern. They currently serve a useful affordance as "tags." If keeping them, document in `DESIGN.md` as a "pill badge" component with explicit use restrictions (badge/chip only; not for navigation or action buttons). If removing, replace with 2px rectangular chips and rely on background color for differentiation.

5. **Remove elevation shadows from floating panels** (lines 596, 632, 938). At the current background darkness, a 1px `border-color: var(--border-dim)` is sufficient to separate a floating panel from the canvas. The `0 10px 30px rgba(0,0,0,0.5)` shadows are legacy from a lighter or less refined iteration and add visual weight inconsistent with the flat direction.

### Tier 3 — Heavy, defer to dedicated milestone

6. **Full palette realignment.** Deciding whether `--bg-root: #1e1e22` (purple-shifted dark) vs. the spec's neutral `#212121` is the right base — and propagating the decision consistently — is a full visual QA pass. Not urgent; the current palette is coherent.

7. **Focus system unification.** Replacing the glow-ring focus indicators with flat border-highlight (Ableton-style) across all interactive controls (inputs, dropdowns, datepicker, counters) touches 10+ components. Appropriate for a dedicated "flatness pass" milestone, not a patch.

8. **Font condensing.** If strict Ableton compliance is desired, replacing Space Grotesk with a condensed typeface (Barlow Condensed, Roboto Condensed, or a custom narrow) is a full design system change affecting all text metrics, all container widths, and all padding relationships. Scope to a v2.0 design milestone.

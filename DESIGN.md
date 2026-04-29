# Ableton Live Design Language Specification (DESIGN.md)

## 1. Design Philosophy
The Ableton Live interface is built on the principles of **high-density functionalism**, **flat hierarchy**, and **non-destructive visual focus**. It is designed for professional music production and live performance, where clarity, precision, and speed are paramount.

- **Non-Standardized UI:** Eschews OS-native widgets for custom, high-performance elements.
- **Context-Aware Layout:** A modular "Shell" architecture where panels collapse and expand based on workflow.
- **Color as Information:** Color is rarely decorative; it denotes track grouping, clip status, or parameter activity.

---

## 2. Visual Foundation

### 2.1 Color Palette (Dark Theme / Neutral)
The interface uses a multi-layered gray-scale system with high-saturation functional accents.

| Category | Hex/Value | Usage |
| :--- | :--- | :--- |
| **Background (Deep)** | `#212121` | Main background, empty spaces. |
| **Panel Surface** | `#323232` | Device racks, browser background. |
| **Control Surface** | `#454545` | Buttons, knobs, sliders (inactive). |
| **Borders/Dividers** | `#1a1a1a` | Hairline separators (1px). |
| **Text (Primary)** | `#cccccc` | Main labels, active values. |
| **Text (Secondary)** | `#8a8a8a` | Units, inactive labels, headers. |

**Functional Accents:**
- **Active State:** Vibrant Orange (`#ff9e00`) / Yellow (`#f2ca30`).
- **Signal/Audio:** Green (`#00ffc8`) to Red (`#ff4d4d`) for meters.
- **Automation:** Red/Pink (`#e04a4a`).
- **Selection:** Light Gray/Blueish Highlight.

### 2.2 Typography
- **Font Family:** A custom, condensed sans-serif (e.g., *Ableton Sans* or a tight-kerning *Inter/Helvetica* variant).
- **Sizing:**
    - Small: 9-10px (Labels, secondary info).
    - Medium: 11-12px (Main UI text).
    - Large: 14px (Track names, large readouts).
- **Style:** Always crisp, no anti-aliasing issues. High contrast against dark backgrounds. Uppercase is used frequently for section headers.

### 2.3 Iconography
- **Style:** 1px stroke weight, strictly geometric.
- **Geometry:** 12x12px or 16x16px bounding boxes.
- **Icons:** Folders, play/stop triangles, circle/record buttons, and custom waveforms.

---

## 3. UI Components & Patterns

### 3.1 The "Control" Pattern (Knobs & Sliders)
- **Knobs:** Radial progress indicators around a central point.
- **Sliders:** Minimalist vertical/horizontal bars with a numeric readout usually nearby.
- **Interaction:** Single-click to select, click-drag to adjust. Double-click returns to default.

### 3.2 Buttons
- **Toggle Buttons:** Flat rectangles. Background changes from dark to bright (usually orange/yellow) when active.
- **Momentary Buttons:** Inset effect or color change on hover.

### 3.3 Panels & Layout (Modular Grid)
- **Header:** Global transport controls (Tempo, Signature, CPU meter).
- **Center:** The Workspace (Session View grid or Arrangement View timeline).
- **Bottom:** Detail View (Instrument/Effect racks).
- **Left/Side:** Browser (Samples, Plugins, Instruments).
- **Separators:** 1-2px draggable borders.

---

## 4. Specific Design Requirements (Constraints)

1. **Pixel-Perfect Alignment:** All elements must align to a strict grid. There are no rounded corners (or extremely minimal, e.g., 2px for buttons).
2. **High Information Density:** Maximum UI surface area should be usable. Minimize whitespace.
3. **Responsive Scaling:** UI components must scale linearly without losing text legibility.
4. **Visual Hierarchy via Contrast:** Active parameters should "pop" against the muted gray background.
5. **No Drop Shadows:** The UI is completely flat. Depth is created through value changes (lighter/darker grays) and thin borders.

---

## 5. Interaction Design
- **Single-Window Workflow:** Avoid pop-up windows. Content should appear in the lower Detail View or the Side Browser.
- **Hover States:** Subtle brightening of buttons or borders to indicate interactivity.
- **Drag & Drop:** The UI is built around dragging samples/effects from the browser into tracks/racks.

---

## 6. XMS Calculator Live Variant

The shipped calculator UI is a specific operating skin for XMS, not a generic Ableton clone. It keeps the Ableton logic but biases the shell toward charcoal and amber, with pear and blue confined to the brand mark / identity linework rather than repeated chrome states.

### 6.1 Live App Tokens

| Token | Value | Usage |
| :--- | :--- | :--- |
| `--bg-root` | `#1a1c20` | App frame / outer canvas |
| `--bg-surface` | `#22252a` | Sidebar, panels, dropdown bodies |
| `--bg-elevated` | `#2a2d33` | Active rows, section headers |
| `--bg-inset` | `#14161a` | Inputs and recessed tracks |
| `--text-primary` | `#e6e8ec` | Main labels and values |
| `--text-secondary` | `#b6bac1` | Secondary labels and metadata |
| `--daw-orange` | `#FFB43A` | Active, focus, confirm, export-ready states |
| `--data` | `#5cd4c4` | Muted data trace for low-volume summary markers |

### 6.2 Live Rules

- Rectangular controls stay at 3px radius or below.
- Floating surfaces stay flat and border-led; no elevation shadow.
- Amber owns active/focus in the shell.
- Pear and blue do not own repeated states; they remain in the XMS mark and rare identity linework.
- Store colors are muted and varied, not neon-heavy, and never use pear/blue as the default first tracks.
- Workbench density follows the Direction A mockup: compact topbar, bordered calculation sections, bottom info/status layers.
- Bottom and status bars span the entire application frame; sidebar and workbench stop above them.
- Faders use amber active fill with a right-side value box, matching the Design Language fader pattern.

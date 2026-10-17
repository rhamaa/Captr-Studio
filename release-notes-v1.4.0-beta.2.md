# 🎥 Captr Studio v1.4.0-beta.2

Welcome to **Captr Studio v1.4.0-beta.2**! This release significantly refines the editing experience with an interactive transform keyframe engine, live canvas gizmo synchronization, a redesigned left sidebar navigation bar, an expanded shape and highlight studio, standardized timeline track architecture, and unified design system dark scrollbars.

---

### 🌟 Key Highlights

#### 💎 Interactive Transform Keyframe Engine & Gizmo
- **Inspector Property Diamonds (`◆` / `◇`)**: Quickly enable or disable keyframe animation for Position (X/Y), Scale (X/Y), and Rotation directly on clip transform cards in the Inspector.
- **Timeline Clip Keyframe Glyphs**: Keyframe positions are rendered as distinct diamond glyphs directly on timeline clip tracks with millisecond precision.
- **Live Canvas Gizmo Auto-Keyframing**: Dragging or resizing overlay objects on the video preview canvas directly records or updates keyframes at the playhead position without position jumps or desynchronized bounding boxes.
- **Keyframe Navigation**: Toggle keyframes using hotkey `K`, or step through keyframes with Previous / Next Keyframe controls in the timeline toolbar.

#### 🎨 Redesigned Left Sidebar & Integrated Card Top Rail
- **Reclaimed Canvas Space**: Eliminated the fixed 48px left rail column to give video previews and the timeline maximum horizontal breadth.
- **Top Bar Tabs**: Quick tabs embedded inside the sidebar card header for effortless switching between **Assets** (`Folder`), **Shapes & Highlights** (`Square+`), **Text Overlays** (`TextT`), and **Templates** (`CopySimple`).
- **Cohesive Design Tokens**: Fully styled using Captr Studio tokens (`--editor-surface`, `--editor-panel`, `--captr-blue`).

#### 📐 Rich Shape & Highlight Studio
- **Visual SVG Cards**: Replaced generic text buttons with rich visual SVG representation cards for intuitive shape selection.
- **Diverse Shape Presets**: Rectangle, Ellipse, Line, Arrow, Star, Callout Bubbles, and Privacy Blur masks.
- **Granular Customization**: Interactive controls for Fill Color, Stroke Color, Stroke Width, Corner Radius, Opacity, and Blur Radius.
- **One-Click Timeline Placement**: Instantly places customized shapes onto the timeline at current playhead time.

#### 🎚️ Standardized Timeline Track Architecture
- **Simplified Track Hierarchy**: Clean distinction between visual Media tracks and Audio tracks.
- **Contextual Track Naming**: Tracks dynamically adopt contextual labels based on their content (e.g. `Shape`, `Shape 1`, `Track 1`, `Track 2`, `Audio 1`, `Audio 2`).

#### 🖱️ Studio Design System Custom Dark Scrollbars
- **Native Polish**: Custom 6px dark pill scrollbars across Timeline, Inspector, Asset Grid, and Dialogs.
- **Windows Cleanup**: Suppressed harsh native white scrollbar gutters and OS arrow buttons on Windows platforms.

#### 🛡️ Story Editor Finishing & Baseline Stability
- **Complete Feature Foundations**: Story-owned captions, placement source-clock mapping, independent Artboard anchors, shared Canvas burn-in for preview/MP4 export, filmstrips, clip clipboard, and group/link selections.
- **Passing Test Suite**: Verified across 1,670+ unit and integration tests with 0 TypeScript compiler errors.

---

### 📦 Installation & Upgrade

Download the appropriate installer for your operating system below:

- **Windows**: `Captr Studio-1.4.0-beta.2-Setup.exe` (x64)
- **macOS**: `Captr Studio-1.4.0-beta.2.dmg` (Universal: Apple Silicon & Intel)
- **Linux**: `Captr Studio-1.4.0-beta.2.AppImage` (x64)

Verify artifact integrity using the published `SHA256SUMS.txt` checksum file.

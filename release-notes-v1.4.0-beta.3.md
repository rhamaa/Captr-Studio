# 🎥 Captr Studio v1.4.0-beta.3

Welcome to **Captr Studio v1.4.0-beta.3**! This release brings major enhancements to the Record Editor, including a full-featured Frame Appearance studio with visual theme presets, outward border geometry, responsive micro-stepper controls, and interactive canvas zoom and pan navigation.

---

### 🌟 Key Highlights

#### 🎨 Record Editor Frame Appearance Studio
- **Dedicated Appearance Tab**: Style screen recordings and webcam frames with an independent configuration panel directly in the Record Editor sidebar.
- **Rich Visual Style Presets**: Choose between live visual cards for **Brutalism**, **Claymorphism**, **Glassmorphism**, **Retro Arcade**, **Clean Minimal**, and **Modern Dark**.
- **User Preset Management**: Save custom appearance styles, rename, delete, and import/export preset configurations as JSON files.
- **Outward Border Expansion**: Border strokes are rendered expanding outward, guaranteeing borders never encroach on or clip into recorded media.
- **Responsive Micro-Steppers**: Custom dark mini step buttons (`▲`/`▼`) with native spinner suppression, keyboard arrow stepping (`↑`/`↓` ±1, Shift: ±5), and hex color pickers.

#### 🔍 Interactive Preview Zoom & Pan (Geser)
- **Mouse Wheel Zoom**: Smoothly zoom in and out (`0.25x` to `5x`) anchored directly to the mouse cursor position.
- **Pan Mode (`Hand`) & Middle-Click**: Easily drag and pan the canvas using the Pan tool or by clicking and dragging with the middle mouse button.
- **Transport Zoom Controls**: Integrated Zoom In, Zoom Out, Pan Toggle, and 1-click 100% reset badge on the transport bar.

#### 🛡️ Streamlined Surface & Feature Flags
- **Centralized Feature Flags (`src/core/featureFlags.ts`)**: Consolidated experimental features behind a unified toggle (`FEATURE_AI_ENABLED = false`) while AI workflows undergo architectural re-planning.
- **Pure Code Mode for Hyperframe**: Hyperframe Studio defaults cleanly to Direct HTML Source editing.

---

### 📦 Installation & Upgrade

Download the appropriate installer for your operating system:

- **Windows**: `Captr Studio-windows-x64.exe` (x64 NSIS Installer)
- **macOS**: `Captr Studio-1.4.0-beta.3.dmg` (Universal: Apple Silicon & Intel)
- **Linux**: `Captr Studio-1.4.0-beta.3.AppImage` (x64)

#### Checksums (`SHA256SUMS.txt`)
```text
d99c6c665db2e0d8499cf65348d14030486d65741647bfafbd94fc01729eb7fc  Captr Studio-windows-x64.exe
fe8838695d0a1e49b80dae0e92df69252cddd4899ac2481997b5d28aeff2595a  Captr Studio-windows-x64.exe.blockmap
fd304c8e2173ea9a13aea8f33ffa5bf58f2f38d88d6f910770f67fbe14aa40b6  latest.yml
```

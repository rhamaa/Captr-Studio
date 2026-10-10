# 🎨 Captr Studio Design System

Captr Studio menggunakan filosofi desain **Soft Pastel Glassmorphism & Weightless Depth**. Desain ini mengutamakan ketenangan visual, elegan, kejelasan tipografi, dan kedalaman spatial tanpa elemen neon/cyberpunk yang menyilaukan.

---

## 🌸 1. Brand Color Palette (Soft Pastel)

Captr Studio memiliki 6 warna aksen inti berbasis **Soft Pastel**. Seluruh komponen UI, badge, timeline track, gizmo, dan animasi harus mengacu pada token ini:

| Token Name | Hex Code | HSL / RGB | Karakter & Penggunaan |
|---|---|---|---|
| `--captr-blue` / `captr-blue` | `#6FA8FF` | `hsl(216, 100%, 72%)` / `rgb(111, 168, 255)` | **Primary Brand Color**: Video track, selection gizmo, primary CTA, active states |
| `--captr-purple` / `captr-purple` | `#A879F5` | `hsl(263, 87%, 72%)` / `rgb(168, 121, 245)` | **Secondary Accent**: Text overlays, AI badges, special features |
| `--captr-green` / `captr-green` | `#8DDB9B` | `hsl(131, 53%, 71%)` / `rgb(141, 219, 155)` | **Success & Audio**: Audio tracks, microphone indicators, success feedback |
| `--captr-yellow` / `captr-yellow` | `#F6C768` | `hsl(40, 89%, 69%)` / `rgb(246, 199, 104)` | **Warning & Overlays**: Shapes, overlays, cautions, scale keyframes |
| `--captr-red` / `captr-red` | `#FF6B81` | `hsl(351, 100%, 71%)` / `rgb(255, 107, 129)` | **Destructive & Recording**: Recording indicator, playhead line, delete actions |
| `--captr-ink` / `captr-ink` | `#344054` | `hsl(218, 24%, 27%)` / `rgb(52, 64, 84)` | **Neutral Ink**: Text primer (light mode), slate accents |

---

## 🌑 2. Surface & Background Tokens

### Dark Mode (Studio Default)
- **App Shell Canvas**: `#111214` (Deep matte charcoal)
- **Panel / Card Background**: `#1C1F26` (`--card`)
- **Subtle Surface**: `#242832` (`--secondary`, `--muted`)
- **Borders & Dividers**: `#343A46` / `rgba(255, 255, 255, 0.08)` (`--border`)
- **Text Primary**: `#F5F6F8` (`--foreground`)
- **Text Muted**: `#A8AFBD` / `#8d8d95` (`--muted-foreground`)

### Light Mode
- **App Background**: `#F8F9FC` (`--background`)
- **Panel / Card**: `#FFFFFF` (`--card`)
- **Subtle Surface**: `#F1F3F7` (`--secondary`)
- **Borders & Dividers**: `#E4E7EC` (`--border`)
- **Text Primary**: `#344054` (`--foreground`)
- **Text Muted**: `#667085` (`--muted-foreground`)

---

## 🪟 3. Glassmorphism & Elevation (Antigravity Vibe)

1. **Subtle Frosted Translucency**:
   - `backdrop-filter: blur(16px) saturate(180%)`
   - Background semi-transparan yang lembut: `rgba(28, 31, 38, 0.85)`
2. **Weightless Diffused Shadows**:
   - Hindari shadow hitam pekat. Gunakan multi-layer diffused shadow:
     `box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.3), 0 0 20px rgba(111, 168, 255, 0.08)`
3. **Soft Borders**:
   - Garis tepi tipis berestetika kaca: `border: 1px solid rgba(255, 255, 255, 0.1)` atau `border: 1px solid rgba(111, 168, 255, 0.2)`

---

## 🚫 4. Anti-Patterns (Aturan yang Dilarang)

- ❌ **Dilarang menggunakan Neon Cyan / Sky Blue yang menyilaukan**:
  Jangan gunakan `#00ffff`, `#06b6d4`, `#38bdf8`, `bg-cyan-400`, `text-sky-400` dengan glowing shadow radioaktif (`shadow-[0_0_12px_rgba(6,182,212,0.8)]`).
- ❌ **Dilarang menggunakan pure stark black / white tanpa blending**:
  Gunakan charcoal `#111214` / `#1C1F26` bukan `#000000` pekat untuk panel UI.
- ❌ **Dilarang animasi mendadak**:
  Semua hover dan active transition minimal `150ms ease-out`.

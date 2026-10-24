# Generative AI Styling & Natural Language Prompt Execution Plan

## 1. Overview
User feedback:
> "di beberapa posisi seperti pengaturan preset gaya visual itu, rasanya pengaturannya tidak di generate oleh LLM tapi dia justru malah terlihat seperti preset setting video"

Pengguna menginginkan pengalaman AI yang **benar-benar generative (bukan sekadar daftar preset video statis)**:
Ketika pengguna mengetik prompt bebas di `AiCommandBar` (`Ctrl+K`) seperti:
- *"Ubah style frame jadi tema cyberpunk neon dengan border magenta dan glow halus"*
- *"Gaya minimalis monokrom dengan sudut membulat 24px dan bayangan deep"*
- *"Retro terminal warna hijau matrix dengan border tebal"*
- *"Buang semua jeda hening lebih dari 0.8 detik dan beri auto-zoom ke klik"*

Sistem harus mampu menginterpretasikan maksud estetika & pengeditan pengguna secara dinamis dan menghasilkan nilai parameter parametrik nyata (`borderWidth`, `borderColor`, `borderOpacity`, `cornerRadius`, `surfaceColor`, `surfaceOpacity`, `backdropBlur`, `headerStyle`, `shadow`, `wallpaper`), serta mutasi timeline (`remove_silence`, `auto_zoom_to_clicks`, `split_clip`).

---

## 2. Architecture & Dual-Tier Execution

```mermaid
flowchart TD
    User([Pengguna Ctrl+K]) --> CmdBar[AiCommandBar]
    CmdBar --> |Prompt Text| PromptRouter[executeNaturalLanguageAiCommand]
    
    PromptRouter --> ModeCheck{Preferred Runner CLI Configured?}
    
    ModeCheck -->|Yes & Available| AgentRunner[agentRunner.ts: Run External CLI / MCP]
    AgentRunner -->|Prompt + CONTEXT.md + MCP Tools| LLM[Local LLM CLI: agy / claude / opencode]
    LLM -->|Draft JSON / Tool Calls| SpecDraft[Speculative Draft & Ghost Diff]
    
    ModeCheck -->|No / Fallback / Instant| LocalEngine[aiIntentParser & aiStyleSynthesizer]
    LocalEngine -->|Zero-shot Semantic Design Synthesis| SynthesizedStyle[Dynamic RecordingFrameAppearance + Wallpaper]
    LocalEngine -->|Timeline Action Mapping| TimelineMutations[applyRemoveSilence / applyAutoZoom / etc.]
    
    SynthesizedStyle --> SpecDraft
    TimelineMutations --> SpecDraft
    
    SpecDraft --> Drawer[AiSpeculativeDrawer: Accept (Enter) / Discard (Esc)]
```

---

## 3. Implementation Tasks

### Task 1: Semantic Design Token & Generative Style Synthesizer
- **File**: `src/core/timeline/aiStyleSynthesizer.ts`
- **Test File**: `src/core/timeline/aiStyleSynthesizer.test.ts`
- **Capabilities**:
  - Semantic Color Palettes: Cyberpunk/Neon, Retro/Matrix, Minimalist/Nordic, Sunset/Warm, Ocean/Cyber, Monochrome/Brutal, Pastel/Playful, Corporate/Modern, Golden/Luxury, etc.
  - Natural Language Parameter Extraction:
    - Hex colors (`#ff0055`, `#00ffff`, etc.) & color names (merah, biru, ungu, hijau, kuning, putih, hitam, cyan, magenta, orange, gold).
    - Border width ("tebal" -> 6-8px, "tipis" -> 1-2px, "sedang" -> 3-4px, or explicit "X px").
    - Corner radius ("bulat/rounded" -> 18-24px, "tajam/sharp/kotak" -> 0px, "pill" -> 32px, or explicit "X px").
    - Header style ("macos" -> macos, "windows" -> windows, "linux" -> linux, "clean/tanpa header" -> none).
    - Shadow glow & blur ("glow" -> high blur with border color, "deep" -> 40px blur, "flat" -> 0 blur).
    - Wallpaper affinity mapping (matching theme keywords to built-in wallpapers: `energy-19`, `midnight-8`, `glassmorphism-3`, `tahoe-dark`, `sequoia-blue`, etc.).
  - Output: Full, type-safe `RecordingFrameAppearance` + suggested `wallpaper`.

### Task 2: Natural Language Command & Intent Parser
- **File**: `src/core/timeline/aiIntentParser.ts`
- **Test File**: `src/core/timeline/aiIntentParser.test.ts`
- **Capabilities**:
  - Classifies user prompt into action categories:
    - `style`: Visual framing & appearance.
    - `silence`: Removal of speech pauses.
    - `zoom`: Cursor click auto-zoom keyframing.
    - `split`: Split clip at playhead or timestamp.
    - `compound`: Combined style and timeline actions.
  - Applies mutations to `TimelineProject` without mutating media files or disk.
  - Returns `{ success: boolean, project: TimelineProject, diff: AgentDiffSummary, summary: string }`.

### Task 3: MCP Server & Agent Runner Context Enrichment
- **Files**:
  - `electron/ipc/agent/agentRunner.ts`
  - `src/core/timeline/agentPayload.ts`
  - `electron/ipc/agent/mcpServer.ts`
- **Capabilities**:
  - `assembleAgentEditingContext`: enrich with composition frame settings, window appearance schema, and built-in wallpapers.
  - `formatAgentTaskPrompt`: explicitly instruct the LLM on how to edit visual appearance and call `set_frame_appearance` with dynamic colors, borders, and shadows.
  - Register `generate_frame_style` or extend `set_frame_appearance` in MCP server tool schemas with rich descriptions.
- **Tests**:
  - `src/core/timeline/agentTools.test.ts`
  - `electron/ipc/agent/agentRunner.test.ts`
  - `electron/ipc/agent/mcpServer.test.ts`

### Task 4: UI Integration in ProjectEditor & AiCommandBar
- **Files**:
  - `src/components/editor/ProjectEditor.tsx`
  - `src/components/editor/AiCommandBar.tsx`
  - `src/components/editor/AiCommandBar.test.tsx`
- **Capabilities**:
  - Connect `handleSubmitAiPrompt` to `executeNaturalLanguageAiCommand`:
    - First attempts external CLI runner if configured and online.
    - If no runner or fallback, uses local generative synthesizer.
    - Generates speculative ghost draft, updates `AiSpeculativeDrawer`.
  - Add quick prompt suggestion pills in `AiCommandBar` when prompt input is empty:
    - `"✨ Cyberpunk Neon"`
    - `"🎨 Minimalist Dark"`
    - `"🪟 macOS Glass"`
    - `"✂️ Cut Silence & Pauses"`
    - `"🔍 Auto-Zoom to Clicks"`
  - Polish keyboard navigation and error messaging.

### Task 5: End-to-End Verification, TypeScript Checks & Documentation
- **Steps**:
  - Run all Vitest suites.
  - Run `node ./node_modules/typescript/bin/tsc --noEmit`.
  - Refresh graph with `graft build`.
  - Update `docs/features/ai-copilot.md` and log to `ISSUE.md`.

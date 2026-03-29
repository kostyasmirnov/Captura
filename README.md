# Captura

A fast, minimal screenshot tool for macOS — inspired by Lightshot. Lives in the menu bar, stays out of your way.

![Platform](https://img.shields.io/badge/platform-macOS-lightgrey)
![License](https://img.shields.io/badge/license-MIT-blue)

## Features

- **Area capture** — drag to select any region, annotate inline, then copy or save
- **Fullscreen capture** — one hotkey, full screen with toolbar ready
- **Annotation tools** — pen, arrow, rectangle, ellipse, marker, text
- **Pixel magnifier** — shows exact pixel color and coordinates while selecting
- **Multi-monitor support** — captures across all screens at Retina resolution
- **Screenshot history** — browse, reopen, and delete past screenshots
- **Configurable output** — PNG / JPEG / WebP, custom save folder, filename template
- **Menu bar app** — no Dock icon, runs silently in the background

## Hotkeys

| Action | Shortcut |
|---|---|
| Area capture | `⌘ Shift 1` |
| Fullscreen capture | `⌘ Shift 2` |
| Copy result & close | `⌘ C` or `Enter` |
| Undo last annotation | `⌘ Z` |
| Cancel / go back | `Esc` |

Tools inside the capture overlay also have single-key shortcuts: `P` pen, `A` arrow, `R` rect, `E` ellipse, `M` marker, `T` text.

## Installation

Download the latest `.dmg` from the [Releases page](../../releases/latest), open it, drag **Captura.app** to your Applications folder, and launch.

On first launch macOS will ask for **Screen Recording** permission — required to capture the screen. Grant it in **System Settings → Privacy & Security → Screen Recording**.

## Building from source

**Requirements**

| Tool | Version |
|---|---|
| Rust | 1.77+ (`rustup` recommended) |
| Node.js | 18+ |
| npm | 9+ |
| Xcode Command Line Tools | any recent |

```bash
# 1. Clone
git clone https://github.com/YOUR_USERNAME/captura.git
cd captura

# 2. Install JS dependencies
npm install

# 3. Dev mode (hot-reload frontend + Rust backend)
npm run tauri dev

# 4. Production build → produces .app and .dmg
npm run tauri build
```

The `.dmg` appears at:
```
src-tauri/target/release/bundle/dmg/Captura_0.1.0_aarch64.dmg
```

> **Note:** if `cargo` is not in your PATH after installing Rust, run `source "$HOME/.cargo/env"` first.

## Tech stack

| Layer | Technology |
|---|---|
| App framework | [Tauri v2](https://tauri.app) (Rust + WebView) |
| Frontend | React 18 + TypeScript + Vite |
| Annotation canvas | [Konva.js](https://konvajs.org) / react-konva |
| State management | [Zustand](https://zustand-demo.pmnd.rs) |
| Screen capture | [`screenshots`](https://crates.io/crates/screenshots) crate |
| Clipboard | [`arboard`](https://crates.io/crates/arboard) via Tauri plugin |
| Image encoding | [`image`](https://crates.io/crates/image) crate (PNG / JPEG / WebP) |
| Global hotkeys | `tauri-plugin-global-shortcut` |
| Styling | Tailwind CSS |

## Project structure

```
captura/
├── src/                      # Frontend (React + TypeScript)
│   ├── windows/
│   │   ├── CaptureOverlay.tsx  # Fullscreen overlay: select + annotate
│   │   ├── Editor.tsx          # Standalone editor (history items)
│   │   ├── History.tsx         # Screenshot history browser
│   │   └── Settings.tsx        # Settings panel
│   ├── components/
│   │   └── FloatingToolbar.tsx # Compact annotation toolbar
│   └── store/
│       └── useAppStore.ts      # Zustand state (tools, annotations, undo)
└── src-tauri/                # Backend (Rust)
    ├── src/
    │   ├── capture.rs        # Screen capture + image processing
    │   ├── commands.rs       # Tauri commands (IPC)
    │   ├── history.rs        # Screenshot history persistence
    │   ├── settings.rs       # App settings (JSON)
    │   ├── tray.rs           # Menu bar tray icon + menu
    │   └── lib.rs            # App setup, global shortcuts
    ├── capabilities/
    │   └── default.json      # Tauri permission declarations
    ├── icons/                # App icons (all sizes)
    └── tauri.conf.json       # Tauri configuration
```

## License

MIT

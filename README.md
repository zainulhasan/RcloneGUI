# RcloneGUI

> **Free, open-source desktop GUI for [rclone](https://rclone.org)** — the no-cost alternative to Mountain Duck, ExpanDrive and CloudMounter with the deepest feature set of any rclone front-end.

[![CI](https://github.com/zainulhasan/RcloneGUI/actions/workflows/ci.yml/badge.svg)](https://github.com/zainulhasan/RcloneGUI/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-0.4.0-informational)](#)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey)](#)

Built with **Tauri 2**, **React 19** and **TypeScript**. All rclone interaction goes through its
Remote Control (RC) HTTP API — no CLI output parsing, no fragile shell wrappers.

---

## Screenshots

| Dashboard (dark) | File browser (dark) | Transfers |
|---|---|---|
| ![Dashboard](screenshots/dark-dashboard.png) | ![Browser](screenshots/dark-browser.png) | ![Transfers](screenshots/dark-transfers.png) |

| Remotes | Media library | Scheduler |
|---|---|---|
| ![Remotes](screenshots/light-remotes.png) | ![Media](screenshots/light-media.png) | ![Scheduler](screenshots/light-scheduler.png) |

---

## Features

### File Browser
Dual-pane commander with multi-select, drag-and-drop between panes, context-menu operations
(copy / move / sync / bisync / delete), dry-run preview, per-operation filter and flags editor,
rename, double-click to open local files, and native folder-picker upload from disk.

### Sync & Transfers
Copy, sync, move and bidirectional bisync with full rclone flag support. Live speed and ETA
dashboard, per-job progress bars, combined throughput sparkline, SQLite-backed transfer history
that survives restarts.

### Cloud Mounts
Mount any remote as a local drive. VFS cache controls (mode, size, age, read-only, volume name).
Saved mounts that persist across sessions; auto-mount on app launch.

### Serve
Start and stop `rclone serve http | webdav | dlna` per remote with a LAN URL ready for media
players and DLNA receivers.

### Scheduler
Cron jobs with one-click presets (hourly, daily, weekly). Jobs run in the background while the
window is closed — the app lives in the system tray and can launch at login.

### Remote Hosts
Connect to a remote `rclone rcd` daemon running on a NAS or server. Switch between local and
remote daemon from the top bar without restarting.

### Media Library
Scan a cloud folder recursively, show TMDB poster art, and track watched status:
- **Stream** — open the file's cloud URL directly in your system player or browser
- **Download** — copy to a local Watch Folder with inline progress and automatic resume on flaky connections
- **Auto-clean** — delete local copies after N hours or when a configurable size cap is hit; every deletion is recorded in the Activity log

### Remotes Wizard
Every rclone backend is supported. Popular ones (Google Drive, S3, Dropbox, OneDrive, …) have
guided curated setup; the full catalog of 70+ providers is searchable and uses auto-generated
forms from rclone's own provider metadata. OAuth remotes open the browser auth flow natively.

---

## Requirements

| Requirement | Notes |
|---|---|
| [rclone](https://rclone.org/downloads/) | Must be on your `PATH` or configured in Settings |
| macFUSE (macOS) / WinFsp (Windows) / fuse3 (Linux) | Only for mount features |
| [TMDB API key](https://www.themoviedb.org/settings/api) | Only for media library poster art — free |

The app detects rclone on launch and offers a download link if it is missing.

---

## Download

Pre-built installers are attached to every [GitHub Release](https://github.com/zainulhasan/RcloneGUI/releases):

| Platform | Format |
|---|---|
| macOS (Apple Silicon + Intel) | `.dmg` universal binary |
| Windows | `.msi` or NSIS `.exe` |
| Linux | `.AppImage` or `.deb` |

Auto-updates are delivered through the built-in updater (signed releases, Tauri updater plugin).

---

## Development

### Prerequisites

- **Node.js 22+** — `node --version`
- **Rust stable** — `rustup update stable`
- **Tauri system dependencies** for your OS:
  - macOS: Xcode Command Line Tools
  - Windows: Microsoft C++ Build Tools + WebView2
  - Linux: `libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf`
  - Full list: [tauri.app/start/prerequisites](https://tauri.app/start/prerequisites/)

### Getting started

```bash
git clone https://github.com/zainulhasan/RcloneGUI.git
cd RcloneGUI
npm install
npm run tauri dev       # launches the desktop app with hot-reload
```

The Rust backend spawns `rclone rcd --rc-no-auth --rc-addr=127.0.0.1:<free-port>` on launch and
kills it on exit. The React frontend talks to it through a typed RC client (`src/lib/rc-client`)
proxied over a Tauri command — it never calls rclone directly.

> **Note:** Always test UI changes in the native Tauri app, not a browser. The Tauri IPC bridge
> (`window.__TAURI_INTERNALS__`) only exists in the native webview — `localhost:1420` in Chrome
> will show invoke errors.

### Quality gate

Run this before every commit and PR. CI mirrors it exactly.

```bash
npm run check
```

| Step | Command |
|---|---|
| TypeScript | `npm run check-types` — `tsc --noEmit`, strict mode |
| Lint | `npm run lint` — ESLint |
| Format | `npm run format-check` — Prettier |
| Frontend tests | `npm run test` — Vitest + Testing Library |
| Rust | `npm run check:rust` — `cargo fmt --check && cargo clippy -D warnings && cargo test` |

Other useful commands:

```bash
npm run test:e2e                    # Playwright smoke (Vite only, no real rclone needed)
npm run format                      # auto-format everything
cargo test -- --include-ignored     # also run the real rclone daemon lifecycle test
```

### Building installers

```bash
npm run tauri build
```

Output is in `src-tauri/target/release/bundle/`: `.app`/`.dmg` (macOS), `.msi`/NSIS `.exe`
(Windows), `.AppImage`/`.deb` (Linux). Production releases are cut by CI from a `v*` tag — see
[RELEASING.md](RELEASING.md).

---

## Architecture

```
src/                       React frontend
  components/
    ui/                    shadcn/ui primitives (Radix UI, Tailwind v4)
    layout/                app shell, sidebar, page header
  features/
    dashboard/             overview, stats, sparklines
    browser/               dual-pane file commander, drag-and-drop
    operations/            copy, move, sync, bisync, delete dialogs
    remotes/               wizard, provider presets, OAuth flow
    transfers/             live transfer list, history, sparkline
    mounts/                mount manager, VFS options
    serve/                 HTTP / WebDAV / DLNA serve manager
    scheduler/             cron job editor and runner
    media/                 TMDB library, download/stream, auto-clean
    settings/              preferences, host switcher, bandwidth
    logs/                  daemon stderr + structured activity log
    health/                daemon status, version probe
    updater/               in-app update checker
  lib/
    rc-client/             typed rclone RC API client (transport-injected)
  store/                   Zustand stores (settings, jobs, navigation, theme…)
  theme/                   MD3 design tokens (CSS variables, light/dark)
src-tauri/                 Rust backend
  rclone/
    detect.rs              find and probe the rclone binary
    daemon.rs              spawn rcd, capture stderr ring buffer, kill-on-drop
    proxy.rs               POST JSON to the RC HTTP API
    port.rs                pick a free local port
  commands.rs              Tauri commands exposed to the frontend
  disk.rs                  disk-space queries
tests/                     Playwright E2E smoke test
```

**Data flow:** `feature hook → rc client → invoke("rc_call") → Rust proxy → rclone RC HTTP API`

**State:** TanStack Query v5 for all server-side data (keys: `["remotes"]`, `["listing", fs, path]`,
`["media", …]`). Zustand stores for UI state. Long operations use `_async: true` and return a
job ID polled by `useJobCompletionWatcher`.

**Boot sequence:** `App.tsx` → `DaemonGate` (hydrate settings → detect rclone → start daemon) →
renders the normal UI or onboarding/error screens. `BackgroundServices` mounts session-long
hooks: job watcher, cron scheduler runner, auto-cleanup, update check.

---

## Contributing

All contributions are welcome — bug fixes, new features, design improvements, docs and tests.

### Before you start

1. **Check for an existing issue or PR** for what you want to build. If none exists, open an
   issue first so we can discuss the approach before you invest significant time.
2. For anything larger than a single-screen change, describe the design and API in the issue
   before writing code.

### Workflow

```bash
# 1. Fork the repo on GitHub, then clone your fork:
git clone https://github.com/<your-username>/RcloneGUI.git
cd RcloneGUI
git remote add upstream https://github.com/zainulhasan/RcloneGUI.git

# 2. Create a branch off main
git checkout main && git pull upstream main
git checkout -b feat/my-feature    # or fix/my-bug, docs/my-doc, refactor/…

# 3. Develop with hot-reload
npm run tauri dev

# 4. Verify the full quality gate passes
npm run check

# 5. Commit with a clear imperative message
git commit -m "Add per-job bandwidth cap to the flags editor"

# 6. Push and open a PR against main
git push origin feat/my-feature
```

### PR checklist

- [ ] `npm run check` passes (TypeScript, lint, Prettier, Vitest, Rust)
- [ ] Tested in the native Tauri desktop app — not just in a browser
- [ ] New behaviour has unit tests (Vitest) or Playwright smoke coverage where reasonable
- [ ] Design tokens only — no raw color values, no one-off inline styles (see [DESIGN.md](DESIGN.md))
- [ ] PR description explains *what* changed and *why*, not just *how*

### Code style

Formatting is enforced automatically. Conventions to know:

| Area | Rule |
|---|---|
| Formatting | Prettier (`npm run format`), enforced in CI |
| Linting | ESLint — no `any`, no unused imports |
| CSS / styles | Tailwind utilities referencing design tokens only; no `style={{color: …}}` |
| Server state | TanStack Query — hooks live in `src/features/<area>/use-<thing>.ts` |
| UI state | Zustand store in `src/store/` |
| RC calls | Always through `src/lib/rc-client/client.ts`; never call `invoke("rc_call")` from a component |
| Tests | Colocate unit tests next to source; mock `@tauri-apps/api/core` via `src/test/setup.ts` |
| Comments | Only when the *why* is non-obvious; never restate what the code says |

### Where new code goes

| What you're adding | Where it lives |
|---|---|
| New rclone RC method | `src/lib/rc-client/client.ts` + type in `types.ts` |
| New React Query hook | `src/features/<area>/use-<thing>.ts` |
| New page | `src/features/<area>/<area>-view.tsx` + entry in `src/store/navigation.ts` |
| New design token | `src/theme/tokens.css` (both `:root` and `.dark`) |
| New shadcn component | `src/components/ui/` — follow the existing pattern |
| New Tauri command | `src-tauri/src/commands.rs` + register in `lib.rs` |
| New Zustand store | `src/store/<name>.ts` |

### Reporting bugs

Open a [GitHub Issue](https://github.com/zainulhasan/RcloneGUI/issues/new) and include:

- OS and version (macOS 15.x, Windows 11, Ubuntu 24.04 …)
- RcloneGUI version (Help → About, or `git log -1 --oneline`)
- rclone version (`rclone version`)
- Steps to reproduce
- What you expected vs what happened
- Daemon log if relevant (Settings → Logs)

### Feature requests

Open an issue with the **enhancement** label. Describe the use case, not just the feature —
"I want to [do X] so that [Y]" is more useful than "please add button Z".

---

## Docs

| File | Contents |
|---|---|
| [DESIGN.md](DESIGN.md) | Color tokens, typography, spacing, component conventions |
| [MEDIA.md](MEDIA.md) | Media library rules: watched state, auto-clean, download resume |
| [RELEASING.md](RELEASING.md) | How to cut a release, updater signing, CI secrets |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Shipped milestones and planned work |

---

## License

MIT — see [LICENSE](LICENSE).

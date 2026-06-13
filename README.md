# RcloneGUI

A polished, cross-platform desktop GUI for [rclone](https://rclone.org) — built with Tauri 2,
React and TypeScript. **Free and open source** — a no-cost alternative to paid cloud-storage
apps like Mountain Duck, ExpanDrive and CloudMounter, aiming for the best feature set of any
rclone front-end.

- **macOS** (Apple Silicon + Intel), **Windows**, **Linux**
- All rclone interaction via its Remote Control (RC) HTTP API — never by parsing CLI output
- Auto-updates from GitHub Releases
- Docs: [DESIGN.md](DESIGN.md) · [MEDIA.md](MEDIA.md) · [RELEASING.md](RELEASING.md) · [docs/ROADMAP.md](docs/ROADMAP.md)

## Features

**File browser** — dual-pane browser with multi-select, copy/move/sync/bisync/delete, dry-run
preview, filters and flags editor, rename, double-click to open local files.

**Transfers** — live speed/ETA dashboard, per-job progress bars, combined throughput sparklines,
SQLite-backed history that survives restarts.

**Mounts** — VFS cache controls, saved mounts, auto-mount on launch, one-click unmount.

**Serve** — start/stop `rclone serve http|webdav|dlna` per remote with a LAN URL for media
players and DLNA receivers.

**Scheduler** — cron jobs with presets; runs while the window is closed (tray + launch-at-login).

**Remote hosts** — connect to a remote `rclone rcd` (NAS, server) from Settings; switch between
local and remote daemon from the top bar.

**Media library** — scan a cloud folder recursively, show TMDB poster art, track watched status:

- **Stream** — open the file's cloud public link directly in your system player/browser
- **Download** — copy to a local Watch Folder with inline progress; retries on flaky connections
- **Auto-clean** — delete local copies after N hours or when a size cap is hit; every deletion
  is logged to the Activity log

## Requirements

- [rclone](https://rclone.org/downloads/) on your `PATH` (or configure its path in Settings).
  The app detects it on launch and offers a download link if missing.
- For mounts: FUSE (macFUSE on macOS, WinFsp on Windows, fuse3 on Linux).
- For media poster art: a free [TMDB API key](https://www.themoviedb.org/settings/api).

## Development

Prerequisites: Node 22+, Rust stable, and the
[Tauri prerequisites](https://tauri.app/start/prerequisites/) for your OS
(on Linux: `libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf`).

```bash
npm install
npm run tauri dev      # run the desktop app with hot reload
```

The Rust backend spawns `rclone rcd --rc-no-auth --rc-addr=127.0.0.1:<free-port>` on launch and
kills it on exit; the frontend talks to it through a typed RC client (`src/lib/rc-client`)
proxied over a Tauri command.

## Quality gate

One command runs everything CI runs:

```bash
npm run check
```

| Step           | Command                                                                              |
| -------------- | ------------------------------------------------------------------------------------ |
| TypeScript     | `npm run check-types` (`tsc --noEmit`, strict)                                       |
| Lint           | `npm run lint` (ESLint)                                                              |
| Format         | `npm run format-check` (Prettier)                                                    |
| Frontend tests | `npm run test` (Vitest + Testing Library)                                            |
| Rust           | `npm run check:rust` (`cargo fmt --check && cargo clippy -D warnings && cargo test`) |

Extras:

```bash
npm run test:e2e        # Playwright smoke test (boots the UI with a stubbed Tauri IPC)
npm run format          # auto-format everything
cargo test -- --include-ignored   # in src-tauri: also run the real-rclone daemon test
```

CI (`.github/workflows/ci.yml`) runs the full gate plus a Linux `tauri build` on every push and
pull request.

## Building installers

```bash
npm run tauri build
```

Produces platform packages under `src-tauri/target/release/bundle/`:
`.app`/`.dmg` (macOS), `.msi`/NSIS `.exe` (Windows), `.AppImage`/`.deb` (Linux).
Releases are normally cut by CI from a `v*` tag — see [RELEASING.md](RELEASING.md).

## Project structure

```
src/                    # React frontend
  components/           # design-system primitives (shadcn/ui) + layout
  features/             # remotes, browser, operations, transfers, mounts,
                        # serve, scheduler, media, settings, logs, updater, health
  lib/rc-client/        # typed rclone RC API client (transport-injected for tests)
  store/                # Zustand stores (settings, jobs, navigation, …)
  theme/                # design tokens (CSS variables, light/dark)
src-tauri/              # Rust backend: daemon manager, RC proxy, disk checks
tests/                  # Playwright E2E smoke test
```

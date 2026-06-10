# RcloneGUI

A polished, cross-platform desktop GUI for [rclone](https://rclone.org) — built with Tauri 2,
React and TypeScript. Browse remotes side by side, run copy/sync/move/bisync with dry-run and
filters, watch live transfer stats, mount remotes, schedule jobs, and use the **Watch &
Auto-Clean** media workflow: sync a movie locally, watch it in your own player, and let the app
clean up after you.

- **macOS** (Apple Silicon + Intel), **Windows**, **Linux**
- All rclone interaction via its Remote Control (RC) HTTP API — never by parsing CLI output
- Auto-updates from GitHub Releases
- Docs: [DESIGN.md](DESIGN.md) (design system) · [MEDIA.md](MEDIA.md) (media workflow) ·
  [RELEASING.md](RELEASING.md) (releases & updater)

## Requirements

- [rclone](https://rclone.org/downloads/) on your `PATH` (or set its path in Settings).
  The app detects it on launch and offers a download link if missing.
- For mounts: FUSE (macFUSE on macOS, WinFsp on Windows, fuse3 on Linux).

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
                        # scheduler, logs, media, settings, updater, health
  lib/rc-client/        # typed rclone RC API client
  store/                # Zustand stores (settings, jobs, navigation, …)
  theme/                # design tokens (light/dark)
src-tauri/              # Rust backend: daemon manager, RC proxy, disk checks
tests/                  # Playwright E2E smoke test
```

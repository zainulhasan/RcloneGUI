# RcloneGUI Roadmap

Competitive notes vs [rclone-ui/rclone-ui](https://github.com/rclone-ui/rclone-ui)
(Tauri + React + HeroUI; tray-centric "light transparent layer on top of rclone").

## Where RcloneGUI is already ahead

| Area           | RcloneGUI                                                             | rclone-ui                                                   |
| -------------- | --------------------------------------------------------------------- | ----------------------------------------------------------- |
| File browsing  | Dual-pane browser with multi-select, context menus, breadcrumbs       | No full browser (file commander is a paid/unlockable extra) |
| Media workflow | Watch & Auto-Clean, watched DB, TMDB poster library, disk-space guard | None                                                        |
| Operations UX  | Per-operation dry-run + filters/flags editor, settings defaults       | Raw command oriented                                        |
| Logs           | Daemon log + structured activity log with level filters               | Minimal                                                     |
| Quality        | Typed RC client, ~110 tests, CI on every PR                           | Lighter test surface                                        |

## Adopted from rclone-ui (this release)

- **Full provider catalog** — every rclone backend, with forms generated from rclone's own
  `config/providers` metadata (basic + collapsible advanced options), not a hand-picked subset.
  Curated, friendlier forms remain for the 9 most popular backends.
- **Mount VFS cache controls** — cache mode (off/minimal/writes/full), max size, max age,
  read-only, volume name. Without `writes`/`full` many apps can't stream or edit mounted files.
- **Saved mounts + auto-mount on launch** — remembered mount configurations that can re-mount
  automatically when the app starts (rclone-ui's "start on boot" use case, minus the daemonless
  background mode for now).

## Next (ordered)

1. **System tray** — transfer summary, quick mount/unmount of saved mounts, pause/resume
   bandwidth, open app. (tauri tray API)
2. **Launch at login** — `tauri-plugin-autostart`; with saved auto-mounts this completes the
   "mounts available right after boot" story.
3. **Connect to a remote rclone daemon** — Settings → host/port/user/pass so the app can manage
   a NAS or server rcd instead of (or alongside) the local one. rclone-ui's multi-host is its
   strongest power feature.
4. **Operation presets/templates** — save a configured copy/sync (src/dst/flags) and rerun in
   one click; presets become schedulable jobs directly.
5. **Serve manager** — start/stop `rclone serve` (http/webdav/dlna/smb) per remote with a URL
   you can hand to a media player on the LAN.
6. **Bandwidth schedule** — time-of-day bwlimit rules (rclone supports schedule syntax in
   `core/bwlimit`).
7. **Config export/encrypted-config support** — handle `RCLONE_CONFIG_PASS`-protected configs
   and one-click config backup to a remote.

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

## Shipped (v0.1 line)

- ✅ **Full provider catalog** — every rclone backend, forms generated from `config/providers`
  metadata; curated guided forms for the 9 popular backends; searchable.
- ✅ **Mount VFS cache controls** — cache mode/size/age, read-only, volume name.
- ✅ **Saved mounts + auto-mount on app launch.**
- ✅ **Home-folder browsing** — `~` breadcrumb, Up/Home buttons, native folder picker.
- ✅ **Prod-grade shell** — official shadcn Sidebar (collapsible icon rail, grouped nav,
  topbar), redesigned dashboard/transfers/browser, Inter, dark mode, screenshot-reviewed.

## v0.2 — "Always there" (background presence)

The biggest functional gap vs rclone-ui: everything stops when the window closes.

1. **System tray** (tauri tray API) — live transfer summary in the menu, quick mount/unmount of
   saved mounts, pause/resume bandwidth, Open / Quit. Closing the window hides to tray instead
   of exiting (setting-controlled).
2. **Launch at login** — `tauri-plugin-autostart` toggle in Settings; combined with auto-mounts
   and the tray, mounts and schedules survive reboots without the window ever opening.
3. **Scheduler reliability banner** — surface "jobs run only while RcloneGUI is running" with a
   one-click enable of tray+autostart.

## v0.3 — Browser power features (found in the app walkthrough)

4. **Rename** (operations/movefile within the same dir) and **double-click to open** local
   files with the OS default app.
5. **Pane filter** — type-to-filter the current listing (big folders are painful today).
6. **Remote usage on Remotes page** — `operations/about` per remote: used/free with a small
   bar, where the backend supports it.
7. **Persistent transfer history** — keep finished jobs (status, bytes, duration) in SQLite so
   the Transfers page has a History tab that survives restarts.

## v0.4 — Power workflows

8. **Connect to a remote rclone daemon** — Settings → hosts (host/port/user/pass); manage a NAS
   or server rcd alongside the local one. rclone-ui's strongest power feature.
9. **Operation presets/templates** — save a configured copy/sync (src/dst/flags), rerun in one
   click, convert to a scheduled job.
10. **Serve manager** — start/stop `rclone serve` (http/webdav/dlna/smb) per remote, showing
    the LAN URL for media players.

## Later

11. **Bandwidth schedule** — time-of-day bwlimit rules (`core/bwlimit` schedule syntax).
12. **Encrypted-config support** — `RCLONE_CONFIG_PASS` prompt flow; one-click config backup
    to a remote.
13. **Localization** and keyboard-shortcut palette (cmd-K navigation).

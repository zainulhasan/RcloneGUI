# v0.4 — Power Workflows

## Mission context

These three features are the paid-tier differentiators of commercial apps (ExpanDrive's
multi-server, Mountain Duck's sharing) — shipping them free is the point of RcloneGUI.

## Scope

1. Operation presets (save/rerun/schedule configured transfers)
2. Serve manager (share a remote over HTTP / WebDAV / DLNA)
3. Host switcher (manage a remote rclone daemon, e.g. on a NAS)

Build order: presets → serve → hosts (riskiest last).

## 1. Operation presets

- `Preset = { id, name, kind: copy|sync|move|bisync, srcFs, dstFs, flags: FlagsValue }`,
  persisted via tauri-store (`presets.json`), Zustand store mirroring saved-mounts.
- **Save**: the operation dialog gains "Save as preset…" (name prompt) after configuring.
- **Use**: Scheduler page gains a **Presets** card above the cron table. Row actions:
  - _Run now_ → starts the operation via the existing `useRunOperation`, tracked like any job.
  - _Schedule…_ → opens the existing job dialog pre-filled from the preset.
  - _Edit / Delete_.
- Pure helper `presetToScheduledJob(preset)` (tested) keeps the conversion honest.

## 2. Serve manager

**Mechanism** — rclone's RC has no dedicated serve API; serves run as **async daemon jobs**
via `core/command`:

```
core/command { command: "serve", arg: ["http", "gdrive:films"],
               opt: { addr: ":8080", ... }, _async: true } → { jobid }
```

Stop = `job/stop`. Serves die with the daemon — saved configs (mirroring saved mounts) can
auto-start on launch.

- Protocols: **http, webdav, dlna** (v1; smb/ftp later). Options per serve: remote+path,
  protocol, port (default 8080, "auto" picks a free one via a new Rust `free_port` command),
  read-only toggle, optional basic-auth user/pass (http/webdav only; DLNA is open by design).
- New **Serve** view under Files (icon: Share2): create form on top (mirrors Mounts layout),
  active serves table (protocol badge, URL, copy-URL, Stop), saved serves table (auto-start
  switch, start, delete).
- **Shareable URL**: a new Rust command `lan_ip()` (UDP-connect trick, no new deps) builds
  `http://<lan-ip>:<port>` so the user can hand the link to a TV/phone on the LAN.

## 3. Host switcher

**Model** — `Host = { id, name, url, user?, pass? }` in settings; the implicit first entry is
**Local** (the managed daemon). One host is _active_ at a time and the whole app follows it.

**Plumbing**

- Rust `rc_call` gains an optional `host: { url, user, pass }` parameter. When present it
  proxies to that URL with basic auth instead of the local daemon (reuses `proxy::rc_call`
  with a base-URL + auth variant; unit-tested URL/auth shaping).
- Frontend: `useHostStore` holds `activeHostId`; the rc-client transport injects the active
  host's params. A **host picker** sits in the topbar next to the theme toggle, with a
  connectivity dot (background `core/version` ping, 10 s interval).
- **Cache isolation**: every TanStack Query key gains the active host id via one shared
  helper (`hostKey(...parts)`), so listings/stats/remotes never bleed between hosts.

**Semantics & limitations (by design)**

- Browser "Local" pane on a remote host = _that machine's_ filesystem (correct for NAS use).
- Mounts/serves started on a remote host run on that machine.
- The **media Watch flow is Local-only** (it writes to this machine's watch folder); Watch
  actions and the Media view are hidden while a remote host is active.
- The daemon gate only manages the local daemon; remote hosts that fail to ping show the
  connectivity dot red and surface errors per-call, never blocking app boot.
- Settings → Hosts: add/edit/delete/test-connection (`core/version`).

## Error handling

- Serve start failures (port busy, unsupported backend) toast the RC error and leave the form
  intact; auto-start failures log to the activity log like auto-mounts.
- Remote-host auth failures (401) get a dedicated message ("check user/password for <host>").
- Switching to an unreachable host keeps the UI navigable; queries error inline per view.

## Testing

- Pure: `presetToScheduledJob`, serve `core/command` argument shaping per protocol,
  `hostKey` cache-key composition.
- Rust: remote `rc_call` URL + basic-auth header shaping; `lan_ip` returns a parseable IPv4.
- Component: presets card renders/converts; serve form validates port; host picker renders
  hosts and switches the store.
- E2E: Serve view renders; host picker visible with Local default.

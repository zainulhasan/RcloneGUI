# v0.4 Power Workflows Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the v0.4 spec: operation presets, a serve manager (http/webdav/dlna), and a remote-host switcher.

**Architecture:** Three PRs in risk order (presets → serve → hosts). Presets and serves mirror the existing saved-mounts pattern (tauri-store + Zustand). Serves run as `core/command` async jobs inside the daemon. Multi-host adds an optional `host` param to the Rust `rc_call` proxy and a host-id prefix on every TanStack Query key.

**Tech Stack:** as v0.3, plus `core/command` RC endpoint and reqwest basic-auth in the Rust proxy.

**Conventions:** identical to the v0.3 plan (gate `npm run check` before each commit; branch off fresh main; PR + auto-merge monitor; no AI attribution in commits).

---

### Task 1: Presets — store + pure conversion (branch `feature/presets`)

- Create `src/store/presets.ts`: `Preset { id, name, kind: "copy"|"sync"|"move"|"bisync", srcFs, dstFs, flags: FlagsValue }`; Zustand store with `hydrate/upsert/remove` persisted to `presets.json` (copy the saved-mounts store shape exactly).
- Create `src/features/scheduler/preset-utils.ts`:

```ts
import type { Preset } from "@/store/presets";
import { newScheduledJob, type ScheduledJob } from "@/store/scheduled-jobs";

/** Seed a schedulable job from a preset (bisync schedules as copy). */
export function presetToScheduledJob(preset: Preset, id: string): ScheduledJob {
  return {
    ...newScheduledJob(),
    id,
    name: preset.name,
    kind: preset.kind === "bisync" ? "copy" : preset.kind,
    srcFs: preset.srcFs,
    dstFs: preset.dstFs,
    flags: preset.flags,
  };
}
```

- Test `preset-utils.test.ts`: maps fields; bisync downgrades to copy; cron/enabled come from defaults.

### Task 2: Presets — save from operation dialog, Presets card in Scheduler

- `operation-dialog.tsx`: footer gains a left-aligned ghost button "Save as preset…" which reveals an inline name `Input` + Save button; saving calls `usePresetsStore.upsert` with the current kind/srcFs/dstFs/flags and toasts.
- `scheduler-view.tsx`: hydrate presets; above the jobs table render a **Presets** Card (hidden when empty) listing name, kind badge, src→dst mono, with actions **Run now** (`useRunOperation`), **Schedule…** (opens JobDialog with `template: presetToScheduledJob(p, crypto.randomUUID())`), **Delete**. JobDialog gains optional `template?: ScheduledJob` used as the draft initializer when `job` is null (title stays "New scheduled job").
- Gate, commit "Add operation presets", PR, auto-merge.

### Task 3: Serve — pure command shaping + client `command()` (branch `feature/serve`)

- Add to `RcClient`: `command(command: string, arg: string[], opt: Record<string, string>): Promise<RcAsyncJob>` → `core/command` with `{ command, arg, opt, returnType: "STREAM_ONLY_STDERR", _async: true }`; client test asserts shaping.
- Create `src/features/serve/serve-options.ts`:

```ts
export type ServeProtocol = "http" | "webdav" | "dlna";
export interface ServeConfig {
  id: string;
  fs: string;
  protocol: ServeProtocol;
  port: number;
  readOnly: boolean;
  user: string;
  pass: string;
  autoStart: boolean;
}
export function buildServeArgs(c: ServeConfig): { arg: string[]; opt: Record<string, string> } {
  const opt: Record<string, string> = { addr: `:${c.port}` };
  if (c.readOnly) opt["read-only"] = "true";
  if (c.protocol !== "dlna" && c.user.trim()) {
    opt.user = c.user.trim();
    opt.pass = c.pass;
  }
  return { arg: [c.protocol, c.fs], opt };
}
export function serveUrl(c: ServeConfig, lanIp: string): string {
  return `http://${lanIp}:${c.port}`;
}
```

- Test: per-protocol args, auth only for http/webdav, read-only flag, URL building.

### Task 4: Serve — Rust `lan_ip` + `free_port` commands

- `src-tauri/src/commands.rs`: `#[tauri::command] pub fn lan_ip() -> Option<String>` via UDP-connect trick (`UdpSocket::bind("0.0.0.0:0")` → `connect("8.8.8.8:80")` → `local_addr`), and `#[tauri::command] pub fn free_port() -> Result<u16, String>` wrapping `port::pick_free_port`. Register both. Rust test: `lan_ip` (if Some) parses as IPv4; `free_port` returns >0.

### Task 5: Serve — stores, runtime, view, nav

- `src/store/saved-serves.ts`: persisted saved configs (mirror saved-mounts; `serves.json`).
- `src/features/serve/use-serves.ts`: Zustand map `jobid → ServeConfig` for active serves (session-only); `startServe(config)` = `rc.command("serve", ...buildServeArgs)` then track; `stopServe(jobid)` = `rc.jobStop`; `useAutoServes()` starts `autoStart` configs on launch (mirror auto-mounts, dedupe by config id already running); job-completion watcher must IGNORE serve jobids (they run forever) — track serves outside the jobs store.
- `src/features/serve/serve-view.tsx`: create form (remote select + path input merged as fs string, protocol select, port input + "auto" button calling `free_port`, read-only switch, auth fields for http/webdav, "Remember" switch), **Active serves** table (protocol badge, fs, URL from `lan_ip` + copy button, Stop), **Saved serves** table (auto-start switch, Start, Forget).
- Nav: `View` union gains `"serve"`; sidebar Files section gets `{ view: "serve", label: "Serve", icon: Share2 }`; App routes it.
- E2E: navigate to Serve, assert heading. Gate, commit "Add serve manager (http/webdav/dlna)", PR, auto-merge.

### Task 6: Hosts — Rust remote proxy (branch `feature/remote-hosts`)

- `src-tauri/src/rclone/proxy.rs`: add

```rust
/// Join a remote daemon base URL and an RC method path.
pub fn join_rc_url(base: &str, method: &str) -> String {
    format!("{}/{}", base.trim_end_matches('/'), method.trim_matches('/'))
}

pub async fn rc_call_url(
    base: &str, user: Option<&str>, pass: Option<&str>, method: &str, params: Value,
) -> Result<Value, String> { /* reqwest POST json, basic_auth when user set, same error shaping as rc_call */ }
```

- `commands.rs`: `rc_call` gains `host: Option<HostParam>` (`{ url, user, pass }` Deserialize); when Some → `rc_call_url`, else local daemon. Rust tests: `join_rc_url` trims slashes.

### Task 7: Hosts — frontend plumbing + picker + settings

- `AppSettings.hosts: Host[]` (`{ id, name, url, user, pass }`, default `[]`).
- `src/store/host.ts`: `useHostStore` with `activeHostId` ("local" default, persisted via zustand/persist localStorage), `activeHost(settings)` resolver returning `Host | null` (null = local).
- `transport.ts`: `tauriTransport` reads the active host (via `useHostStore.getState()` + `useSettingsStore.getState()`) and passes `host` to `invoke("rc_call")` when remote.
- `src/lib/rc-client/host-key.ts`: `hostKey(...parts)` prepends the active host id; unit test. Apply to query keys in: `use-listing`, `use-remotes`, mounts `useMounts`, `useCoreStats`, `useJobStats`, `remote-about`, `providers`, serve actives.
- Topbar (app-shell header): host `Select` (Local + named hosts) with a connectivity dot — green when a 10s-interval `core/version` query succeeds, red otherwise. Hidden when no hosts configured.
- Settings → **Hosts** section: table + "Add host" dialog (name, url with placeholder `http://nas.local:5572`, optional user/pass), test-connection button per host, delete. 401 errors surface "check user/password for <name>".
- Media is Local-only: hide the Media nav item, `WatchMenuItems`, and `WatchedBadge` when a remote host is active (one `useIsLocalHost()` helper).
- Component test: host picker switches store; `hostKey` test. E2E: picker hidden by default (no hosts). Gate, commit "Add remote rclone daemon hosts", PR, auto-merge.

### Task 8: Wrap-up

- ROADMAP: mark v0.4 SHIPPED. Version bumps → 0.4.0. PR, merge, tag `v0.4.0`, auto-publish release with notes.

## Self-review

- Spec coverage: presets (1–2), serve incl. lan URL + auto-start (3–5), hosts incl. cache isolation, picker, settings, media-local-only (6–7), release (8). Error handling embedded per spec (serve toast-on-fail, 401 message, unreachable host non-blocking).
- Serve jobs deliberately bypass the jobs store so the completion watcher and history don't see never-ending jobs.
- Types align: `FlagsValue` from operations/flags; `ScheduledJob`/`newScheduledJob` from store/scheduled-jobs; `RcAsyncJob` exists in rc-client types.

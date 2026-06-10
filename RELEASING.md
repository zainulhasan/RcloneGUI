# Releasing RcloneGUI

## One-time setup

### 1. Updater signing keypair

Update artifacts are signed with a Tauri updater keypair; the app refuses any update whose
signature doesn't match the public key baked into `src-tauri/tauri.conf.json`
(`plugins.updater.pubkey`).

Generate a keypair (only needed when rotating keys):

```bash
npm run tauri signer generate -- -w ~/.tauri/rclonegui.key --password ""
```

- The **public key** (`~/.tauri/rclonegui.key.pub`) goes into `tauri.conf.json` under
  `plugins.updater.pubkey`. It is safe to commit.
- The **private key** (`~/.tauri/rclonegui.key`) must stay secret. Never commit it. If it is
  lost, shipped apps can no longer be updated (the pubkey would have to change, requiring a
  manual reinstall).

### 2. GitHub secrets

In the repo settings → Secrets and variables → Actions, add:

| Secret                               | Value                                   |
| ------------------------------------ | --------------------------------------- |
| `TAURI_SIGNING_PRIVATE_KEY`          | Contents of `~/.tauri/rclonegui.key`    |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | The key password (empty string if none) |

### 3. OS code signing (optional, later — no code changes needed)

The app ships unsigned initially. To add signing, only set secrets and uncomment the marked
`TODO(signing/...)` lines in `.github/workflows/release.yml`:

- **macOS (signing + notarization):** `APPLE_CERTIFICATE` (base64 Developer ID Application
  .p12), `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_PASSWORD`
  (app-specific password), `APPLE_TEAM_ID`.
- **Windows (Authenticode):** `WINDOWS_CERTIFICATE` (base64 .pfx), `WINDOWS_CERTIFICATE_PASSWORD`.

## Cutting a release

1. Bump the version in **three files** (keep them identical):
   `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`.
2. Run the full gate locally: `npm run check`.
3. Commit, tag and push:

   ```bash
   git commit -am "Release v0.2.0"
   git tag v0.2.0
   git push origin main --tags
   ```

4. The **Release** workflow (`.github/workflows/release.yml`) builds on the tag for:
   - macOS Apple Silicon (`aarch64-apple-darwin`) and Intel (`x86_64-apple-darwin`) → `.app` + `.dmg`
   - Windows → `.msi` + NSIS `.exe`
   - Linux → `.AppImage` + `.deb`

   Each updater artifact is signed with `TAURI_SIGNING_PRIVATE_KEY`, and a **draft GitHub
   Release** is created with all installers plus the **`latest.json`** updater manifest.

5. Review the draft release on GitHub, edit the release notes (they become the update dialog's
   text), and **publish** it. Publishing makes `latest.json` available at the updater endpoint.

## How auto-update works end to end

1. The app's updater endpoint (in `tauri.conf.json`) is
   `https://github.com/zainulhasan/RcloneGUI/releases/latest/download/latest.json`,
   which always redirects to the manifest of the **latest published release**.
2. On launch (3 s after start, silent) — and on **Settings → Check for updates** (loud) — the
   app fetches `latest.json` (`src/features/updater/use-updater.ts`).
3. `latest.json` lists the new version, release notes, and per-platform download URLs +
   signatures.
4. If the version is newer than the running one, a dialog shows the version and notes with
   **Update now / Later**.
5. On accept, the platform package is downloaded, its signature verified against the embedded
   pubkey, installed, and the app relaunches. Failures surface as toasts and are written to the
   Activity log.

## Version sanity checklist

- [ ] `package.json`, `tauri.conf.json`, `Cargo.toml` versions match the tag
- [ ] `npm run check` green
- [ ] CI green on `main`
- [ ] Draft release artifacts include `latest.json`, `.dmg` ×2, `.msi`, `.exe`, `.AppImage`, `.deb`
- [ ] Release published (not left as draft)

// Screenshot every app view against the running dev server (vite :1420)
// using the same Tauri IPC stub as the Playwright smoke test.
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const OUT = "screenshots";
mkdirSync(OUT, { recursive: true });

const VIEWS = [
  "Dashboard",
  "Remotes",
  "Browser",
  "Transfers",
  "Mounts",
  "Scheduler",
  "Media",
  "Logs",
  "Settings",
];

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 2,
});

await page.addInitScript(() => {
  const rcResponses = (method, params) => {
    switch (method) {
      case "config/dump":
        return {
          gdrive: { type: "drive" },
          s3media: { type: "s3", provider: "AWS" },
          nas: { type: "sftp", host: "nas.local" },
        };
      case "config/listremotes":
        return { remotes: ["gdrive", "s3media", "nas"] };
      case "core/stats":
        return {
          bytes: 734003200,
          speed: 12582912,
          transfers: 2,
          errors: 0,
          eta: 220,
          totalBytes: 4294967296,
          transferring: [
            {
              name: "films/Interstellar.2014.2160p.mkv",
              size: 3221225472,
              bytes: 644245094,
              percentage: 20,
              speed: 9437184,
              speedAvg: 9437184,
              eta: 180,
            },
            {
              name: "shows/Silo.S02E01.mkv",
              size: 1073741824,
              bytes: 89759040,
              percentage: 8,
              speed: 3145728,
              speedAvg: 3145728,
              eta: 40,
            },
          ],
        };
      case "config/paths":
        return { config: "/Users/zain/.config/rclone/rclone.conf", cache: "", temp: "" };
      case "operations/list": {
        const dirs = ["Documents", "Downloads", "Movies", "Music", "Pictures"].map((n) => ({
          Path: `Users/zain/${n}`,
          Name: n,
          Size: 0,
          MimeType: "inode/directory",
          ModTime: "2026-06-10T10:00:00Z",
          IsDir: true,
        }));
        const files = [
          ["notes.md", 4523],
          ["backup-2026.tar.gz", 1073741824],
          ["wedding-video.mp4", 4294967296],
        ].map(([n, s]) => ({
          Path: `Users/zain/${n}`,
          Name: n,
          Size: s,
          MimeType: "application/octet-stream",
          ModTime: "2026-06-09T18:30:00Z",
          IsDir: false,
        }));
        return { list: [...dirs, ...files] };
      }
      case "mount/listmounts":
        return {
          mountPoints: [
            {
              Fs: "gdrive:",
              MountPoint: "/Users/zain/mnt/gdrive",
              MountedOn: "2026-06-11T09:12:00Z",
            },
          ],
        };
      case "config/providers":
        return {
          providers: [
            {
              Name: "drive",
              Description: "Google Drive",
              Prefix: "drive",
              Options: [
                {
                  Name: "token",
                  Help: "OAuth token",
                  Provider: "",
                  Default: "",
                  Value: null,
                  Required: false,
                  IsPassword: false,
                  Advanced: false,
                  Type: "string",
                },
              ],
            },
            {
              Name: "azureblob",
              Description: "Microsoft Azure Blob Storage",
              Prefix: "azureblob",
              Options: [],
            },
            { Name: "mega", Description: "Mega", Prefix: "mega", Options: [] },
            { Name: "pcloud", Description: "pCloud", Prefix: "pcloud", Options: [] },
          ],
        };
      default:
        return {};
    }
  };

  let callbackId = 0;
  window.__TAURI_INTERNALS__ = {
    invoke: async (cmd, args) => {
      switch (cmd) {
        case "detect_rclone":
          return { path: "/usr/local/bin/rclone", version: "v1.74.3" };
        case "daemon_start":
        case "daemon_status":
          return { running: true, port: 5572, pid: 4242 };
        case "daemon_logs":
          return [
            "2026/06/11 09:12:01 INFO  : Mounting gdrive: at /Users/zain/mnt/gdrive",
            "2026/06/11 09:12:02 INFO  : vfs cache: cleaned: objects 12 (was 12)",
          ];
        case "disk_free":
          return 250 * 1024 ** 3;
        case "rc_call":
          return rcResponses(args.method, args.params);
        case "plugin:store|load":
          return 1;
        case "plugin:store|get":
          return [null, false];
        case "plugin:store|set":
        case "plugin:store|save":
          return null;
        case "plugin:sql|load":
          return "sqlite:media.db";
        case "plugin:sql|select":
          return [];
        case "plugin:sql|execute":
          return [0, 0];
        default:
          return null;
      }
    },
    transformCallback: (cb) => {
      const id = ++callbackId;
      window[`_${id}`] = cb;
      return id;
    },
    metadata: { currentWindow: { label: "main" }, currentWebview: { label: "main" } },
    plugins: { path: { sep: "/", delimiter: ":" } },
  };
});

await page.goto("http://localhost:1420");
await page.getByRole("heading", { name: "Dashboard" }).waitFor({ timeout: 10000 });

for (const view of VIEWS) {
  if (view !== "Dashboard") {
    await page.getByRole("button", { name: view, exact: true }).click();
    await page.waitForTimeout(600);
  }
  await page.screenshot({ path: `${OUT}/light-${view.toLowerCase()}.png` });
}

// dark mode pass on key views
await page.getByRole("button", { name: "Toggle theme" }).click();
await page.waitForTimeout(300);
for (const view of ["Dashboard", "Browser", "Transfers"]) {
  await page.getByRole("button", { name: view, exact: true }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/dark-${view.toLowerCase()}.png` });
}

// the add-remote wizard
await page.getByRole("button", { name: "Toggle theme" }).click();
await page.getByRole("button", { name: "Remotes", exact: true }).click();
await page.getByRole("button", { name: "Add remote" }).click();
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/light-wizard.png` });

await browser.close();
console.log("screenshots written to", OUT);

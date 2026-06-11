import { expect, test } from "@playwright/test";

/**
 * E2E smoke test. The frontend runs in a plain browser, so the Tauri IPC
 * surface is stubbed with a healthy environment before the app loads:
 * rclone found, daemon running, empty remote config, empty stores.
 */
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    type Args = Record<string, unknown> | undefined;

    const rcResponses = (method: string): unknown => {
      switch (method) {
        case "config/dump":
          return {};
        case "config/listremotes":
          return { remotes: [] };
        case "core/stats":
          return { bytes: 0, speed: 0, transfers: 0, errors: 0, eta: null };
        case "config/paths":
          return { config: "/home/user/.config/rclone/rclone.conf", cache: "", temp: "" };
        default:
          return {};
      }
    };

    const invoke = async (cmd: string, args?: Args): Promise<unknown> => {
      switch (cmd) {
        case "detect_rclone":
          return { path: "/usr/local/bin/rclone", version: "v1.66.0" };
        case "daemon_start":
        case "daemon_status":
          return { running: true, port: 5572, pid: 4242 };
        case "daemon_logs":
          return [];
        case "disk_free":
          return 250 * 1024 ** 3;
        case "set_hide_on_close":
        case "tray_status":
          return null;
        case "plugin:autostart|is_enabled":
          return false;
        case "plugin:autostart|enable":
        case "plugin:autostart|disable":
          return null;
        case "rc_call":
          return rcResponses((args as { method: string }).method);
        // tauri-plugin-store
        case "plugin:store|load":
          return 1;
        case "plugin:store|get":
          return [null, false];
        case "plugin:store|set":
        case "plugin:store|save":
          return null;
        // tauri-plugin-sql
        case "plugin:sql|load":
          return "sqlite:media.db";
        case "plugin:sql|select":
          return [];
        case "plugin:sql|execute":
          return [0, 0];
        default:
          return null;
      }
    };

    // Minimal Tauri IPC shim. transformCallback is required by the API package.
    let callbackId = 0;
    (window as never as Record<string, unknown>).__TAURI_INTERNALS__ = {
      invoke,
      transformCallback: (cb?: (r: unknown) => void) => {
        const id = ++callbackId;
        (window as never as Record<string, unknown>)[`_${id}`] = cb;
        return id;
      },
      metadata: { currentWindow: { label: "main" }, currentWebview: { label: "main" } },
      plugins: { path: { sep: "/", delimiter: ":" } },
    };
  });
});

test("app boots through the health check to the dashboard", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("RcloneGUI")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  // Health check data is rendered (rclone version from detect_rclone).
  await expect(page.getByText("v1.66.0")).toBeVisible();
});

test("navigates to Remotes and Settings without errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

  await page.getByRole("button", { name: "Remotes", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Remotes" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add remote" })).toBeVisible();

  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(page.getByText("rclone binary path")).toBeVisible();
  // v0.2 background mode controls
  await expect(page.getByText("Keep running in the tray")).toBeVisible();
  await expect(page.getByText("Launch at login")).toBeVisible();

  expect(errors).toEqual([]);
});

// One-off boot debugger: prints console + page errors from the app under the
// same Tauri shim the smoke test uses.
import { chromium } from "@playwright/test";

const browser = await chromium.launch();
const page = await browser.newPage();

page.on("console", (msg) => console.log(`[console.${msg.type()}]`, msg.text().slice(0, 300)));
page.on("pageerror", (err) => console.log("[pageerror]", String(err).slice(0, 500)));

await page.addInitScript(() => {
  let callbackId = 0;
  window.__TAURI_INTERNALS__ = {
    invoke: async (cmd) => {
      console.log("[invoke]", cmd);
      switch (cmd) {
        case "detect_rclone":
          return { path: "/usr/local/bin/rclone", version: "v1.74.3" };
        case "daemon_start":
        case "daemon_status":
          return { running: true, port: 5572, pid: 4242 };
        case "daemon_logs":
          return [];
        case "disk_free":
          return 250 * 1024 ** 3;
        case "rc_call":
          return {};
        case "set_hide_on_close":
        case "tray_status":
          return null;
        case "plugin:autostart|is_enabled":
          return false;
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
await page.waitForTimeout(6000);
const body = await page.evaluate(() => document.body.innerText.slice(0, 300));
console.log("[body]", body.replaceAll("\n", " | "));
await browser.close();

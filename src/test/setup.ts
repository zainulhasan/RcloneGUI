import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// jsdom does not implement matchMedia; the theme store relies on it.
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

afterEach(() => {
  cleanup();
});

// Component tests run outside a Tauri webview; stub the IPC surface with a
// healthy environment (rclone found, daemon running, empty remote config).
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async (cmd: string) => {
    switch (cmd) {
      case "detect_rclone":
        return { path: "/usr/local/bin/rclone", version: "v1.66.0" };
      case "daemon_start":
      case "daemon_status":
        return { running: true, port: 5572, pid: 1234 };
      case "disk_free":
        return 250 * 1024 ** 3;
      case "rc_call":
        return {};
      default:
        return null;
    }
  }),
}));

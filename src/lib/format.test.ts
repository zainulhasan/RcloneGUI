import { describe, expect, it } from "vitest";

import { formatBytes, formatEta, formatSpeed } from "./format";

describe("formatBytes", () => {
  it("formats sub-kilobyte values in bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
  });

  it("formats binary units with one decimal", () => {
    expect(formatBytes(1536)).toBe("1.5 KiB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MiB");
    expect(formatBytes(2.5 * 1024 ** 3)).toBe("2.5 GiB");
  });

  it("drops decimals at three digits", () => {
    expect(formatBytes(500 * 1024)).toBe("500 KiB");
  });

  it("handles invalid input", () => {
    expect(formatBytes(-1)).toBe("—");
    expect(formatBytes(Number.NaN)).toBe("—");
  });
});

describe("formatSpeed", () => {
  it("appends /s", () => {
    expect(formatSpeed(1024 * 1024)).toBe("1.0 MiB/s");
  });

  it("treats zero and negative as idle", () => {
    expect(formatSpeed(0)).toBe("—");
    expect(formatSpeed(-5)).toBe("—");
  });
});

describe("formatEta", () => {
  it("formats seconds, minutes and hours", () => {
    expect(formatEta(45)).toBe("45s");
    expect(formatEta(312)).toBe("5m 12s");
    expect(formatEta(7380)).toBe("2h 03m");
  });

  it("handles null and invalid values", () => {
    expect(formatEta(null)).toBe("—");
    expect(formatEta(undefined)).toBe("—");
    expect(formatEta(-1)).toBe("—");
  });
});

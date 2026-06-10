import { describe, expect, it } from "vitest";

import { EMPTY_FLAGS, flagsToOptions } from "./flags";
import { escapeFilterLiteral, selectionToOperation } from "./selection-to-operation";
import type { RcListItem } from "@/lib/rc-client";

describe("flagsToOptions", () => {
  it("returns empty options for default flags", () => {
    expect(flagsToOptions(EMPTY_FLAGS)).toEqual({});
  });

  it("collects config overrides", () => {
    expect(
      flagsToOptions({
        ...EMPTY_FLAGS,
        dryRun: true,
        transfers: "8",
        checkers: "16",
        bwLimit: "10M",
      }),
    ).toEqual({
      config: { DryRun: true, Transfers: 8, Checkers: 16, BwLimit: "10M" },
    });
  });

  it("ignores invalid numbers", () => {
    expect(flagsToOptions({ ...EMPTY_FLAGS, transfers: "abc", checkers: "-2" })).toEqual({});
  });

  it("splits filter rules per line and trims blanks", () => {
    expect(
      flagsToOptions({
        ...EMPTY_FLAGS,
        include: "*.mkv\n\n  *.mp4  ",
        exclude: "*.tmp",
        minSize: "100M",
      }),
    ).toEqual({
      filter: {
        IncludeRule: ["*.mkv", "*.mp4"],
        ExcludeRule: ["*.tmp"],
        MinSize: "100M",
      },
    });
  });
});

function item(name: string, isDir = false, path?: string): RcListItem {
  return {
    Path: path ?? name,
    Name: name,
    Size: 100,
    MimeType: "",
    ModTime: "",
    IsDir: isDir,
  };
}

describe("selectionToOperation", () => {
  it("single directory operates on the directory itself", () => {
    const op = selectionToOperation("gdrive:", "media", [item("films", true, "media/films")]);
    expect(op).toEqual({ srcFs: "gdrive:media/films", includeRules: [], label: "films/" });
  });

  it("single file narrows the parent directory", () => {
    const op = selectionToOperation("gdrive:", "media", [item("a.mkv", false, "media/a.mkv")]);
    expect(op.srcFs).toBe("gdrive:media");
    expect(op.includeRules).toEqual(["/a.mkv"]);
    expect(op.label).toBe("a.mkv");
  });

  it("mixed selection includes files and dir globs", () => {
    const op = selectionToOperation("gdrive:", "", [item("a.mkv"), item("shows", true)]);
    expect(op.srcFs).toBe("gdrive:");
    expect(op.includeRules).toEqual(["/a.mkv", "/shows/**"]);
    expect(op.label).toBe("2 items");
  });

  it("escapes filter metacharacters in names", () => {
    expect(escapeFilterLiteral("weird [4K]*.mkv")).toBe("weird \\[4K\\]\\*.mkv");
  });
});

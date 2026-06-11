import { describe, expect, it } from "vitest";

import { renamedPath, validateRename } from "./rename";

describe("validateRename", () => {
  const siblings = ["a.mkv", "b.mkv"];

  it("accepts a fresh, clean name", () => {
    expect(validateRename("c.mkv", siblings)).toBeNull();
  });

  it("rejects empties, slashes and dot names", () => {
    expect(validateRename("", siblings)).toMatch(/empty/i);
    expect(validateRename("  ", siblings)).toMatch(/empty/i);
    expect(validateRename("a/b", siblings)).toMatch(/slash/i);
    expect(validateRename(".", siblings)).toMatch(/reserved/i);
    expect(validateRename("..", siblings)).toMatch(/reserved/i);
  });

  it("rejects collisions with existing siblings", () => {
    expect(validateRename("a.mkv", siblings)).toMatch(/exists/i);
  });
});

describe("renamedPath", () => {
  it("replaces the leaf name", () => {
    expect(renamedPath("films/old.mkv", "new.mkv")).toBe("films/new.mkv");
    expect(renamedPath("old.mkv", "new.mkv")).toBe("new.mkv");
  });
});

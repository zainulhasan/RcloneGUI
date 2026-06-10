import { describe, expect, it } from "vitest";

import { applyClick, EMPTY_SELECTION, pruneSelection } from "./selection";

const KEYS = ["a", "b", "c", "d", "e"];

describe("applyClick", () => {
  it("plain click selects only the clicked item", () => {
    let s = applyClick(EMPTY_SELECTION, KEYS, 1);
    expect([...s.selected]).toEqual(["b"]);
    s = applyClick(s, KEYS, 3);
    expect([...s.selected]).toEqual(["d"]);
    expect(s.anchor).toBe(3);
  });

  it("meta-click toggles items", () => {
    let s = applyClick(EMPTY_SELECTION, KEYS, 0);
    s = applyClick(s, KEYS, 2, { meta: true });
    expect([...s.selected].sort()).toEqual(["a", "c"]);
    s = applyClick(s, KEYS, 0, { meta: true });
    expect([...s.selected]).toEqual(["c"]);
  });

  it("shift-click selects a range from the anchor", () => {
    let s = applyClick(EMPTY_SELECTION, KEYS, 1);
    s = applyClick(s, KEYS, 3, { shift: true });
    expect([...s.selected].sort()).toEqual(["b", "c", "d"]);
  });

  it("shift-click works backwards", () => {
    let s = applyClick(EMPTY_SELECTION, KEYS, 3);
    s = applyClick(s, KEYS, 0, { shift: true });
    expect([...s.selected].sort()).toEqual(["a", "b", "c", "d"]);
    expect(s.anchor).toBe(3);
  });

  it("shift-click without anchor behaves like plain click", () => {
    const s = applyClick(EMPTY_SELECTION, KEYS, 2, { shift: true });
    expect([...s.selected]).toEqual(["c"]);
  });

  it("ignores out-of-range indices", () => {
    expect(applyClick(EMPTY_SELECTION, KEYS, 99)).toBe(EMPTY_SELECTION);
  });
});

describe("pruneSelection", () => {
  it("drops keys that disappeared", () => {
    const s = applyClick(applyClick(EMPTY_SELECTION, KEYS, 0), KEYS, 2, { meta: true });
    const pruned = pruneSelection(s, ["a", "x"]);
    expect([...pruned.selected]).toEqual(["a"]);
  });

  it("returns the same state when nothing changed", () => {
    const s = applyClick(EMPTY_SELECTION, KEYS, 0);
    expect(pruneSelection(s, KEYS)).toBe(s);
  });
});

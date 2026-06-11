import { describe, expect, it } from "vitest";

import type { RcListItem } from "@/lib/rc-client";

import { filterListing } from "./filter";

function item(name: string): RcListItem {
  return { Path: name, Name: name, Size: 1, MimeType: "", ModTime: "", IsDir: false };
}

describe("filterListing", () => {
  const items = [item("Movie.mkv"), item("notes.md"), item("MOVIE-2.mkv")];

  it("returns all items for an empty or whitespace query", () => {
    expect(filterListing(items, "")).toBe(items);
    expect(filterListing(items, "   ")).toBe(items);
  });

  it("matches case-insensitive substrings", () => {
    expect(filterListing(items, "movie").map((i) => i.Name)).toEqual(["Movie.mkv", "MOVIE-2.mkv"]);
    expect(filterListing(items, ".MD").map((i) => i.Name)).toEqual(["notes.md"]);
  });

  it("returns empty for no matches", () => {
    expect(filterListing(items, "zzz")).toEqual([]);
  });
});

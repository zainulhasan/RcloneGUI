import { describe, expect, it } from "vitest";

import { isVideoFile, parseFilename } from "./filename-parser";

describe("parseFilename", () => {
  it("parses dotted release names", () => {
    expect(parseFilename("The.Matrix.1999.1080p.BluRay.x264.mkv")).toEqual({
      title: "The Matrix",
      year: 1999,
    });
  });

  it("parses parenthesised years", () => {
    expect(parseFilename("Inception (2010).mkv")).toEqual({ title: "Inception", year: 2010 });
  });

  it("parses underscores", () => {
    expect(parseFilename("Blade_Runner_2049_2017_2160p.mkv")).toEqual({
      title: "Blade Runner 2049",
      year: 2017,
    });
  });

  it("uses the last plausible year (titles can contain years)", () => {
    expect(parseFilename("2001.A.Space.Odyssey.1968.720p.mkv")).toEqual({
      title: "2001 A Space Odyssey",
      year: 1968,
    });
  });

  it("handles names without a year by stripping quality noise", () => {
    expect(parseFilename("Some.Movie.1080p.WEB-DL.x265.mp4")).toEqual({
      title: "Some Movie",
      year: null,
    });
  });

  it("keeps plain names untouched", () => {
    expect(parseFilename("Family Holiday Video.mp4")).toEqual({
      title: "Family Holiday Video",
      year: null,
    });
  });

  it("does not treat a leading year as a release year", () => {
    expect(parseFilename("2012.mkv")).toEqual({ title: "2012", year: null });
  });
});

describe("isVideoFile", () => {
  it("recognises common video extensions", () => {
    expect(isVideoFile("a.mkv")).toBe(true);
    expect(isVideoFile("b.MP4")).toBe(true);
    expect(isVideoFile("c.srt")).toBe(false);
    expect(isVideoFile("noext")).toBe(false);
  });
});

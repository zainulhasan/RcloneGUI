import { beforeEach, describe, expect, it } from "vitest";

import { absoluteToLocalPath, parentPath, useBrowserStore } from "./browser";

describe("path helpers", () => {
  it("absoluteToLocalPath strips leading/trailing slashes", () => {
    expect(absoluteToLocalPath("/Users/zain/")).toBe("Users/zain");
    expect(absoluteToLocalPath("/")).toBe("");
  });

  it("parentPath walks up one level", () => {
    expect(parentPath("a/b/c")).toBe("a/b");
    expect(parentPath("a")).toBe("");
    expect(parentPath("")).toBe("");
  });
});

describe("browser store home behaviour", () => {
  beforeEach(() => {
    useBrowserStore.setState({
      panes: [
        { fs: "/", path: "" },
        { fs: null, path: "" },
      ],
      active: 0,
      homePath: "",
    });
  });

  it("setHomePath points untouched local panes at home", () => {
    useBrowserStore.getState().setHomePath("Users/zain");
    expect(useBrowserStore.getState().panes[0].path).toBe("Users/zain");
    expect(useBrowserStore.getState().panes[1].fs).toBeNull();
  });

  it("setHomePath leaves navigated panes alone", () => {
    useBrowserStore.getState().setPath(0, "tmp");
    useBrowserStore.getState().setHomePath("Users/zain");
    expect(useBrowserStore.getState().panes[0].path).toBe("tmp");
  });

  it("switching a pane to local starts at home", () => {
    useBrowserStore.getState().setHomePath("Users/zain");
    useBrowserStore.getState().setFs(1, "/");
    expect(useBrowserStore.getState().panes[1].path).toBe("Users/zain");
  });

  it("switching to a remote starts at its root", () => {
    useBrowserStore.getState().setHomePath("Users/zain");
    useBrowserStore.getState().setFs(1, "gdrive:");
    expect(useBrowserStore.getState().panes[1].path).toBe("");
  });
});

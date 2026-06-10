import { describe, expect, it } from "vitest";

import { DEFAULT_MOUNT_OPTIONS, toRcMountOptions } from "./mount-options";

describe("toRcMountOptions", () => {
  it("defaults produce a writes cache and nothing else", () => {
    expect(toRcMountOptions(DEFAULT_MOUNT_OPTIONS)).toEqual({
      vfsOpt: { CacheMode: "writes" },
      mountOpt: {},
    });
  });

  it("full form maps to rclone option names", () => {
    expect(
      toRcMountOptions({
        cacheMode: "full",
        cacheMaxSize: " 10G ",
        cacheMaxAge: "24h",
        readOnly: true,
        volumeName: "Media",
      }),
    ).toEqual({
      vfsOpt: { CacheMode: "full", CacheMaxSize: "10G", CacheMaxAge: "24h", ReadOnly: true },
      mountOpt: { VolumeName: "Media" },
    });
  });

  it("cache mode off omits CacheMode entirely", () => {
    const { vfsOpt } = toRcMountOptions({ ...DEFAULT_MOUNT_OPTIONS, cacheMode: "off" });
    expect(vfsOpt).toEqual({});
  });
});

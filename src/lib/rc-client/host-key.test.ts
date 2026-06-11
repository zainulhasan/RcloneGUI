import { beforeEach, describe, expect, it } from "vitest";

import { LOCAL_HOST_ID, useHostStore } from "@/store/host";

import { hostKey } from "./host-key";

describe("hostKey", () => {
  beforeEach(() => useHostStore.setState({ activeHostId: LOCAL_HOST_ID }));

  it("prefixes keys with the active host id", () => {
    expect(hostKey("listing", "gdrive:", "films")).toEqual([
      "local",
      "listing",
      "gdrive:",
      "films",
    ]);
  });

  it("changes when the host switches, isolating caches", () => {
    useHostStore.getState().setActiveHost("nas-1");
    expect(hostKey("remotes")).toEqual(["nas-1", "remotes"]);
  });
});

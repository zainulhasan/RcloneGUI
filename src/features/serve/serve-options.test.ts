import { describe, expect, it } from "vitest";

import { buildServeArgs, serveUrl, type ServeConfig } from "./serve-options";

function config(over: Partial<ServeConfig> = {}): ServeConfig {
  return {
    id: "s1",
    fs: "gdrive:films",
    protocol: "http",
    port: 8080,
    readOnly: false,
    user: "",
    pass: "",
    autoStart: false,
    ...over,
  };
}

describe("buildServeArgs", () => {
  it("shapes protocol, fs and addr", () => {
    expect(buildServeArgs(config())).toEqual({
      arg: ["http", "gdrive:films"],
      opt: { addr: ":8080" },
    });
  });

  it("adds read-only flag", () => {
    expect(buildServeArgs(config({ readOnly: true })).opt["read-only"]).toBe("true");
  });

  it("adds auth for http/webdav only", () => {
    const http = buildServeArgs(config({ user: "zain", pass: "secret" }));
    expect(http.opt.user).toBe("zain");
    expect(http.opt.pass).toBe("secret");

    const dlna = buildServeArgs(config({ protocol: "dlna", user: "zain", pass: "secret" }));
    expect(dlna.opt.user).toBeUndefined();
    expect(dlna.opt.pass).toBeUndefined();
  });

  it("omits auth when user is blank", () => {
    const out = buildServeArgs(config({ user: "  " }));
    expect(out.opt.user).toBeUndefined();
  });
});

describe("serveUrl", () => {
  it("builds the LAN URL", () => {
    expect(serveUrl(config({ port: 9000 }), "192.168.1.20")).toBe("http://192.168.1.20:9000");
  });
});

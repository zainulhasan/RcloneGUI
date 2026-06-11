import { describe, expect, it, vi } from "vitest";

import { joinFsPath, RcClient } from "./client";
import { RcError, type RcTransport } from "./transport";

/** A transport stub that records calls and returns canned responses. */
function stubTransport(response: unknown = {}) {
  const calls: { method: string; params: Record<string, unknown> }[] = [];
  const transport: RcTransport = vi.fn(async (method, params) => {
    calls.push({ method, params });
    return response;
  });
  return { transport, calls };
}

describe("RcClient command shaping", () => {
  it("core/version is called with no params", async () => {
    const { transport, calls } = stubTransport({ version: "v1.66.0" });
    await new RcClient(transport).version();
    expect(calls).toEqual([{ method: "core/version", params: {} }]);
  });

  it("stats scopes to a group when given", async () => {
    const { transport, calls } = stubTransport({});
    const client = new RcClient(transport);
    await client.stats();
    await client.stats("job/42");
    expect(calls[0]).toEqual({ method: "core/stats", params: {} });
    expect(calls[1]).toEqual({ method: "core/stats", params: { group: "job/42" } });
  });

  it("listRemotes unwraps the remotes array and tolerates null", async () => {
    const a = stubTransport({ remotes: ["gdrive", "s3"] });
    expect(await new RcClient(a.transport).listRemotes()).toEqual(["gdrive", "s3"]);

    const b = stubTransport({ remotes: null });
    expect(await new RcClient(b.transport).listRemotes()).toEqual([]);
  });

  it("createRemote sends non-interactive config with obscured passwords", async () => {
    const { transport, calls } = stubTransport({});
    await new RcClient(transport).createRemote("mys3", "s3", { provider: "AWS" });
    expect(calls[0]).toEqual({
      method: "config/create",
      params: {
        name: "mys3",
        type: "s3",
        parameters: { provider: "AWS" },
        opt: { nonInteractive: true, obscure: true },
      },
    });
  });

  it("list unwraps the list array and forwards opt", async () => {
    const item = {
      Path: "films/a.mkv",
      Name: "a.mkv",
      Size: 123,
      MimeType: "video/x-matroska",
      ModTime: "2026-01-01T00:00:00Z",
      IsDir: false,
    };
    const { transport, calls } = stubTransport({ list: [item] });
    const result = await new RcClient(transport).list("gdrive:", "films", { dirsOnly: true });
    expect(result).toEqual([item]);
    expect(calls[0]).toEqual({
      method: "operations/list",
      params: { fs: "gdrive:", remote: "films", opt: { dirsOnly: true } },
    });
  });

  it("copy is async and forwards config, filter and group", async () => {
    const { transport, calls } = stubTransport({ jobid: 7 });
    const job = await new RcClient(transport).copy("gdrive:films", "/watch", {
      config: { DryRun: true, Transfers: 8, BwLimit: "10M" },
      filter: { IncludeRule: ["*.mkv"] },
      group: "watch-sync",
    });
    expect(job).toEqual({ jobid: 7 });
    expect(calls[0]).toEqual({
      method: "sync/copy",
      params: {
        srcFs: "gdrive:films",
        dstFs: "/watch",
        _async: true,
        _config: { DryRun: true, Transfers: 8, BwLimit: "10M" },
        _filter: { IncludeRule: ["*.mkv"] },
        _group: "watch-sync",
      },
    });
  });

  it("omits _config and _filter when empty", async () => {
    const { transport, calls } = stubTransport({ jobid: 1 });
    await new RcClient(transport).sync("a:", "b:", { config: {}, filter: {} });
    expect(calls[0].params).toEqual({ srcFs: "a:", dstFs: "b:", _async: true });
  });

  it("bisync defaults resync to false", async () => {
    const { transport, calls } = stubTransport({ jobid: 2 });
    await new RcClient(transport).bisync("a:", "b:");
    expect(calls[0]).toEqual({
      method: "sync/bisync",
      params: { path1: "a:", path2: "b:", resync: false, _async: true },
    });
  });

  it("copyFile shapes src and dst pairs", async () => {
    const { transport, calls } = stubTransport({ jobid: 3 });
    await new RcClient(transport).copyFile("gdrive:", "films/a.mkv", "/", "watch/a.mkv");
    expect(calls[0]).toEqual({
      method: "operations/copyfile",
      params: {
        srcFs: "gdrive:",
        srcRemote: "films/a.mkv",
        dstFs: "/",
        dstRemote: "watch/a.mkv",
        _async: true,
      },
    });
  });

  it("mount forwards mount and vfs options, omitting empties", async () => {
    const { transport, calls } = stubTransport({});
    const client = new RcClient(transport);
    await client.mount("gdrive:", "/mnt/gdrive", {
      mountOpt: { VolumeName: "GDrive" },
      vfsOpt: { CacheMode: "full", CacheMaxSize: "10G" },
    });
    await client.mount("s3:", "/mnt/s3", { mountOpt: {}, vfsOpt: {} });
    expect(calls[0]).toEqual({
      method: "mount/mount",
      params: {
        fs: "gdrive:",
        mountPoint: "/mnt/gdrive",
        mountOpt: { VolumeName: "GDrive" },
        vfsOpt: { CacheMode: "full", CacheMaxSize: "10G" },
      },
    });
    expect(calls[1]).toEqual({
      method: "mount/mount",
      params: { fs: "s3:", mountPoint: "/mnt/s3" },
    });
  });

  it("command runs core/command as an async stderr-streaming job", async () => {
    const { transport, calls } = stubTransport({ jobid: 11 });
    const job = await new RcClient(transport).command("serve", ["http", "gdrive:films"], {
      addr: ":8080",
    });
    expect(job).toEqual({ jobid: 11 });
    expect(calls[0]).toEqual({
      method: "core/command",
      params: {
        command: "serve",
        arg: ["http", "gdrive:films"],
        opt: { addr: ":8080" },
        returnType: "STREAM_ONLY_STDERR",
        _async: true,
      },
    });
  });

  it("listMounts tolerates a null mountPoints", async () => {
    const { transport } = stubTransport({ mountPoints: null });
    expect(await new RcClient(transport).listMounts()).toEqual([]);
  });

  it("job calls shape ids", async () => {
    const { transport, calls } = stubTransport({});
    const client = new RcClient(transport);
    await client.jobStatus(9);
    await client.jobStop(9);
    expect(calls[0]).toEqual({ method: "job/status", params: { jobid: 9 } });
    expect(calls[1]).toEqual({ method: "job/stop", params: { jobid: 9 } });
  });
});

describe("RcClient error propagation", () => {
  it("propagates transport errors to the caller", async () => {
    const failing: RcTransport = async (method) => {
      throw new RcError(method, "directory not found");
    };
    await expect(new RcClient(failing).list("gdrive:", "nope")).rejects.toThrow(
      "directory not found",
    );
  });

  it("RcError carries the failing method", async () => {
    const failing: RcTransport = async (method) => {
      throw new RcError(method, "boom");
    };
    const err = await new RcClient(failing).version().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(RcError);
    expect((err as RcError).method).toBe("core/version");
  });
});

describe("joinFsPath", () => {
  it("joins remote roots and paths", () => {
    expect(joinFsPath("gdrive:", "films")).toBe("gdrive:films");
    expect(joinFsPath("gdrive:films", "sub")).toBe("gdrive:films/sub");
    expect(joinFsPath("/", "home/user")).toBe("/home/user");
    expect(joinFsPath("gdrive:", "")).toBe("gdrive:");
  });
});

import { describe, expect, it } from "vitest";

import type { RcProvider, RcProviderOption } from "@/lib/rc-client";

import {
  buildParameters,
  filterProviders,
  isOAuthProvider,
  optionApplies,
  visibleOptions,
} from "./provider-options";

function option(over: Partial<RcProviderOption>): RcProviderOption {
  return {
    Name: "opt",
    Help: "",
    Provider: "",
    Default: "",
    Value: null,
    Required: false,
    IsPassword: false,
    Advanced: false,
    Type: "string",
    ...over,
  };
}

function provider(options: RcProviderOption[], name = "s3"): RcProvider {
  return { Name: name, Description: `${name} backend`, Prefix: name, Options: options };
}

describe("optionApplies", () => {
  it("empty Provider applies to everything", () => {
    expect(optionApplies("", "AWS")).toBe(true);
    expect(optionApplies("", undefined)).toBe(true);
  });

  it("positive lists require a match", () => {
    expect(optionApplies("AWS,Alibaba", "AWS")).toBe(true);
    expect(optionApplies("AWS,Alibaba", "Minio")).toBe(false);
    expect(optionApplies("AWS", undefined)).toBe(false);
  });

  it("negated lists exclude matches", () => {
    expect(optionApplies("!AWS,Alibaba", "Minio")).toBe(true);
    expect(optionApplies("!AWS,Alibaba", "AWS")).toBe(false);
    expect(optionApplies("!AWS", undefined)).toBe(true);
  });
});

describe("visibleOptions", () => {
  it("splits basic/advanced, drops hidden, filters by sub-provider", () => {
    const p = provider([
      option({ Name: "access_key_id" }),
      option({ Name: "region", Provider: "AWS" }),
      option({ Name: "endpoint", Provider: "!AWS" }),
      option({ Name: "chunk_size", Advanced: true }),
      option({ Name: "internal", Hide: 1 }),
    ]);
    const aws = visibleOptions(p, "AWS");
    expect(aws.basic.map((o) => o.Name)).toEqual(["access_key_id", "region"]);
    expect(aws.advanced.map((o) => o.Name)).toEqual(["chunk_size"]);

    const minio = visibleOptions(p, "Minio");
    expect(minio.basic.map((o) => o.Name)).toEqual(["access_key_id", "endpoint"]);
  });
});

describe("buildParameters", () => {
  it("omits empties and converts bools", () => {
    const opts = [
      option({ Name: "host" }),
      option({ Name: "use_ssl", Type: "bool" }),
      option({ Name: "left_blank" }),
    ];
    expect(
      buildParameters(opts, { host: " example.com ", use_ssl: "true", left_blank: "" }),
    ).toEqual({ host: "example.com", use_ssl: true });
  });
});

describe("isOAuthProvider / filterProviders", () => {
  it("detects oauth via token option", () => {
    expect(isOAuthProvider(provider([option({ Name: "token" })], "drive"))).toBe(true);
    expect(isOAuthProvider(provider([option({ Name: "host" })], "sftp"))).toBe(false);
  });

  it("filters by name or description", () => {
    const list = [provider([], "drive"), provider([], "dropbox"), provider([], "sftp")];
    expect(filterProviders(list, "drop").map((p) => p.Name)).toEqual(["dropbox"]);
    expect(filterProviders(list, "BACKEND").length).toBe(3);
    expect(filterProviders(list, "")).toBe(list);
  });
});

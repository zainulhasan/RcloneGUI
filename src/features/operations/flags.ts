import type { RcOperationOptions } from "@/lib/rc-client";

/** UI state of the filters/flags editor. */
export interface FlagsValue {
  dryRun: boolean;
  /** Numeric strings so inputs can be empty; invalid input is ignored. */
  transfers: string;
  checkers: string;
  /** rclone bandwidth syntax: "10M", "1M:100k", "off". */
  bwLimit: string;
  /** One include rule per line. */
  include: string;
  /** One exclude rule per line. */
  exclude: string;
  minSize: string;
  maxSize: string;
}

export const EMPTY_FLAGS: FlagsValue = {
  dryRun: false,
  transfers: "",
  checkers: "",
  bwLimit: "",
  include: "",
  exclude: "",
  minSize: "",
  maxSize: "",
};

function lines(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

function positiveInt(text: string): number | undefined {
  const n = Number.parseInt(text.trim(), 10);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

/** Convert editor state into RC `_config` / `_filter` overrides. */
export function flagsToOptions(value: FlagsValue): RcOperationOptions {
  const options: RcOperationOptions = {};

  const config: NonNullable<RcOperationOptions["config"]> = {};
  if (value.dryRun) config.DryRun = true;
  const transfers = positiveInt(value.transfers);
  if (transfers !== undefined) config.Transfers = transfers;
  const checkers = positiveInt(value.checkers);
  if (checkers !== undefined) config.Checkers = checkers;
  if (value.bwLimit.trim()) config.BwLimit = value.bwLimit.trim();
  if (Object.keys(config).length > 0) options.config = config;

  const filter: NonNullable<RcOperationOptions["filter"]> = {};
  const include = lines(value.include);
  if (include.length > 0) filter.IncludeRule = include;
  const exclude = lines(value.exclude);
  if (exclude.length > 0) filter.ExcludeRule = exclude;
  if (value.minSize.trim()) filter.MinSize = value.minSize.trim();
  if (value.maxSize.trim()) filter.MaxSize = value.maxSize.trim();
  if (Object.keys(filter).length > 0) options.filter = filter;

  return options;
}

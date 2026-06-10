import { invoke } from "@tauri-apps/api/core";

/**
 * A transport delivers one RC call (`method`, JSON `params`) to the daemon
 * and resolves with the parsed JSON response.
 */
export type RcTransport = (method: string, params: Record<string, unknown>) => Promise<unknown>;

/** Error raised for any failed RC call, carrying the method for context. */
export class RcError extends Error {
  readonly method: string;

  constructor(method: string, message: string) {
    super(message);
    this.name = "RcError";
    this.method = method;
  }
}

/**
 * Production transport: routes the call through the Rust `rc_call` command,
 * which proxies it to the local rclone daemon over HTTP.
 */
export const tauriTransport: RcTransport = async (method, params) => {
  try {
    return await invoke("rc_call", { method, params });
  } catch (err) {
    throw new RcError(method, typeof err === "string" ? err : String(err));
  }
};

import type { RcProvider, RcProviderOption } from "@/lib/rc-client";

/**
 * rclone scopes some backend options to specific sub-providers (e.g. the s3
 * backend's `region` differs between AWS and Cloudflare). `Provider` is a
 * comma list, optionally negated with a leading "!".
 */
export function optionApplies(optionProvider: string, selected: string | undefined): boolean {
  if (!optionProvider) return true;
  const negated = optionProvider.startsWith("!");
  const list = (negated ? optionProvider.slice(1) : optionProvider).split(",");
  if (!selected) return negated;
  return negated ? !list.includes(selected) : list.includes(selected);
}

export interface VisibleOptions {
  basic: RcProviderOption[];
  advanced: RcProviderOption[];
}

/** Options to render for a provider, given the chosen sub-provider value. */
export function visibleOptions(
  provider: RcProvider,
  subProvider: string | undefined,
): VisibleOptions {
  const shown = provider.Options.filter((o) => !o.Hide && optionApplies(o.Provider, subProvider));
  return {
    basic: shown.filter((o) => !o.Advanced),
    advanced: shown.filter((o) => o.Advanced),
  };
}

/**
 * Convert form values into `config/create` parameters: empty values are
 * omitted (rclone applies its defaults), bools are real booleans.
 */
export function buildParameters(
  options: RcProviderOption[],
  values: Record<string, string>,
): Record<string, unknown> {
  const parameters: Record<string, unknown> = {};
  for (const option of options) {
    const raw = values[option.Name]?.trim();
    if (!raw) continue;
    parameters[option.Name] = option.Type === "bool" ? raw === "true" : raw;
  }
  return parameters;
}

/** OAuth backends carry a `token` option; they need rclone's browser flow. */
export function isOAuthProvider(provider: RcProvider): boolean {
  return provider.Options.some((o) => o.Name === "token");
}

/** Case-insensitive search over name + description. */
export function filterProviders(providers: RcProvider[], query: string): RcProvider[] {
  const q = query.trim().toLowerCase();
  if (!q) return providers;
  return providers.filter(
    (p) => p.Name.toLowerCase().includes(q) || p.Description.toLowerCase().includes(q),
  );
}

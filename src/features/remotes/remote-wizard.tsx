import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight as ChevronRightIcon, Loader2, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { rc, type RcProviderOption } from "@/lib/rc-client";

import {
  buildParameters,
  filterProviders,
  isOAuthProvider,
  visibleOptions,
} from "./provider-options";
import { PROVIDER_PRESETS, presetFor, type ProviderField } from "./provider-presets";
import { useCreateRemote, useUpdateRemote } from "./use-remotes";

const NAME_RE = /^[\w.][\w.\s-]*$/;

function useProviders() {
  return useQuery({
    queryKey: ["providers"],
    queryFn: async () => (await rc.providers()).providers,
    staleTime: Infinity,
  });
}

interface RemoteWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, the wizard edits this remote instead of creating one. */
  editing?: { name: string; type: string; values: Record<string, string> } | null;
  existingNames: string[];
}

/** Input for one curated-preset field. */
function PresetFieldInput({
  field,
  value,
  onChange,
}: {
  field: ProviderField;
  value: string;
  onChange: (v: string) => void;
}) {
  if (field.type === "select") {
    return (
      <Select value={value || undefined} onValueChange={onChange}>
        <SelectTrigger id={`field-${field.key}`} className="w-full">
          <SelectValue placeholder="Select…" />
        </SelectTrigger>
        <SelectContent>
          {(field.options ?? []).map((o) => (
            <SelectItem key={o} value={o}>
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
  return (
    <Input
      id={`field-${field.key}`}
      type={field.type === "password" ? "password" : "text"}
      value={value}
      placeholder={field.placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

/** Input for one rclone provider option (dynamic form). */
function DynamicOptionInput({
  option,
  value,
  onChange,
}: {
  option: RcProviderOption;
  value: string;
  onChange: (v: string) => void;
}) {
  if (option.Type === "bool") {
    const fallback = option.Default === true ? "true" : "false";
    return (
      <Switch
        id={`opt-${option.Name}`}
        checked={(value || fallback) === "true"}
        onCheckedChange={(v) => onChange(String(v))}
        aria-label={option.Name}
      />
    );
  }
  if (option.Examples && option.Examples.length > 0 && !option.IsPassword) {
    return (
      <Select value={value || undefined} onValueChange={onChange}>
        <SelectTrigger id={`opt-${option.Name}`} className="w-full">
          <SelectValue placeholder={option.Default ? String(option.Default) : "Select…"} />
        </SelectTrigger>
        <SelectContent>
          {option.Examples.filter((e) => e.Value !== "").map((e) => (
            <SelectItem key={e.Value} value={e.Value}>
              <span className="flex flex-col items-start">
                <span>{e.Value}</span>
                {e.Help && (
                  <span className="text-muted-foreground max-w-72 truncate text-xs">{e.Help}</span>
                )}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
  return (
    <Input
      id={`opt-${option.Name}`}
      type={option.IsPassword ? "password" : "text"}
      value={value}
      placeholder={option.Default ? String(option.Default) : undefined}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function DynamicOptionRow({
  option,
  value,
  onChange,
}: {
  option: RcProviderOption;
  value: string;
  onChange: (v: string) => void;
}) {
  const firstHelpLine = option.Help.split("\n")[0];
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`opt-${option.Name}`}>
        {option.Name}
        {option.Required && <span className="text-destructive"> *</span>}
      </Label>
      <DynamicOptionInput option={option} value={value} onChange={onChange} />
      {firstHelpLine && <p className="text-muted-foreground text-xs">{firstHelpLine}</p>}
    </div>
  );
}

export function RemoteWizard({ open, onOpenChange, editing, existingNames }: RemoteWizardProps) {
  const providers = useProviders();

  const [step, setStep] = useState<"type" | "details">(editing ? "details" : "type");
  const [search, setSearch] = useState("");
  const [name, setName] = useState(editing?.name ?? "");
  const [type, setType] = useState(editing?.type ?? "");
  const [values, setValues] = useState<Record<string, string>>(editing?.values ?? {});
  const [showAdvanced, setShowAdvanced] = useState(false);

  const createRemote = useCreateRemote();
  const updateRemote = useUpdateRemote();
  const busy = createRemote.isPending || updateRemote.isPending;

  const preset = useMemo(() => (type ? presetFor(type) : undefined), [type]);
  const provider = useMemo(
    () => providers.data?.find((p) => p.Name === type || p.Prefix === type),
    [providers.data, type],
  );
  // Curated presets get the friendly form; everything else gets the dynamic one.
  const dynamic = !preset && provider ? provider : null;
  const subProvider = dynamic ? values["provider"] : undefined;
  const dynamicOptions = useMemo(
    () => (dynamic ? visibleOptions(dynamic, subProvider) : null),
    [dynamic, subProvider],
  );

  const catalog = useMemo(() => {
    const all = providers.data ?? [];
    const curatedTypes = new Set(PROVIDER_PRESETS.map((p) => p.type));
    const rest = filterProviders(all, search).filter((p) => !curatedTypes.has(p.Prefix));
    const popular = search
      ? PROVIDER_PRESETS.filter(
          (p) =>
            p.type.includes(search.toLowerCase()) ||
            p.label.toLowerCase().includes(search.toLowerCase()),
        )
      : PROVIDER_PRESETS;
    return { popular, rest };
  }, [providers.data, search]);

  const nameError = !name
    ? null
    : !NAME_RE.test(name)
      ? "Only letters, digits, dot, dash, underscore."
      : !editing && existingNames.includes(name)
        ? "A remote with this name already exists."
        : null;

  const missingRequired = preset
    ? preset.fields.filter((f) => f.required && !values[f.key]?.trim()).length
    : (dynamicOptions?.basic.filter((o) => o.Required && !values[o.Name]?.trim()).length ?? 0);

  const oauth = preset ? !!preset.oauth : dynamic ? isOAuthProvider(dynamic) : false;

  const reset = () => {
    setStep(editing ? "details" : "type");
    setSearch("");
    setName(editing?.name ?? "");
    setType(editing?.type ?? "");
    setValues(editing?.values ?? {});
    setShowAdvanced(false);
  };

  const close = (next: boolean) => {
    onOpenChange(next);
    if (!next) reset();
  };

  const choose = (t: string) => {
    setType(t);
    setValues({});
    setStep("details");
  };

  const submit = () => {
    let parameters: Record<string, unknown>;
    if (preset) {
      parameters = {};
      for (const field of preset.fields) {
        const v = values[field.key]?.trim();
        if (v) parameters[field.key] = v;
      }
    } else if (dynamicOptions) {
      parameters = buildParameters([...dynamicOptions.basic, ...dynamicOptions.advanced], values);
    } else {
      parameters = {};
    }
    const onSuccess = () => close(false);
    if (editing) {
      updateRemote.mutate({ name: editing.name, parameters }, { onSuccess });
    } else {
      createRemote.mutate({ name, type, parameters, interactive: oauth }, { onSuccess });
    }
  };

  const title = editing
    ? `Edit "${editing.name}"`
    : (preset?.label ?? dynamic?.Description ?? type);

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        {step === "type" ? (
          <>
            <DialogHeader>
              <DialogTitle>Add remote</DialogTitle>
              <DialogDescription>
                Every rclone backend is supported. Popular ones have guided setup.
              </DialogDescription>
            </DialogHeader>
            <div className="relative">
              <Search className="text-muted-foreground absolute top-2.5 left-2.5 size-4" />
              <Input
                autoFocus
                className="pl-8"
                placeholder="Search providers…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search providers"
              />
            </div>
            <div className="flex max-h-96 flex-col gap-1.5 overflow-y-auto pr-1">
              {catalog.popular.length > 0 && (
                <p className="text-muted-foreground px-1 pt-1 text-xs font-medium uppercase">
                  Popular
                </p>
              )}
              {catalog.popular.map((p) => (
                <button
                  key={p.type}
                  onClick={() => choose(p.type)}
                  className="hover:bg-accent hover:border-primary/30 rounded-md border px-3 py-2 text-left transition-colors"
                >
                  <div className="text-sm font-medium">{p.label}</div>
                  <div className="text-muted-foreground text-xs">{p.description}</div>
                </button>
              ))}
              {providers.isLoading ? (
                <p className="text-muted-foreground flex items-center gap-2 px-1 py-2 text-xs">
                  <Loader2 className="size-3 animate-spin" /> Loading the full catalog…
                </p>
              ) : (
                catalog.rest.length > 0 && (
                  <>
                    <p className="text-muted-foreground px-1 pt-2 text-xs font-medium uppercase">
                      All providers
                    </p>
                    {catalog.rest.map((p) => (
                      <button
                        key={p.Name}
                        onClick={() => choose(p.Prefix)}
                        className="hover:bg-accent rounded-md border px-3 py-1.5 text-left transition-colors"
                      >
                        <div className="text-sm">{p.Description}</div>
                        <div className="text-muted-foreground font-mono text-xs">{p.Prefix}</div>
                      </button>
                    ))}
                  </>
                )
              )}
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>
                {preset?.description ?? "Leave fields empty to use rclone's defaults."}
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3">
              {!editing && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="remote-name">Name</Label>
                  <Input
                    id="remote-name"
                    value={name}
                    placeholder="e.g. gdrive"
                    onChange={(e) => setName(e.target.value)}
                    aria-invalid={!!nameError}
                  />
                  {nameError && <p className="text-destructive text-xs">{nameError}</p>}
                </div>
              )}

              {preset &&
                preset.fields.map((field) => (
                  <div key={field.key} className="flex flex-col gap-1.5">
                    <Label htmlFor={`field-${field.key}`}>
                      {field.label}
                      {field.required && <span className="text-destructive"> *</span>}
                    </Label>
                    <PresetFieldInput
                      field={field}
                      value={values[field.key] ?? ""}
                      onChange={(v) => setValues((prev) => ({ ...prev, [field.key]: v }))}
                    />
                    {field.help && <p className="text-muted-foreground text-xs">{field.help}</p>}
                  </div>
                ))}

              {dynamicOptions && (
                <>
                  {dynamicOptions.basic.map((option) => (
                    <DynamicOptionRow
                      key={option.Name}
                      option={option}
                      value={values[option.Name] ?? ""}
                      onChange={(v) => setValues((prev) => ({ ...prev, [option.Name]: v }))}
                    />
                  ))}
                  {dynamicOptions.advanced.length > 0 && (
                    <>
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs font-medium transition-colors"
                        onClick={() => setShowAdvanced((v) => !v)}
                      >
                        {showAdvanced ? (
                          <ChevronDown className="size-3.5" />
                        ) : (
                          <ChevronRightIcon className="size-3.5" />
                        )}
                        Advanced options ({dynamicOptions.advanced.length})
                      </button>
                      {showAdvanced &&
                        dynamicOptions.advanced.map((option) => (
                          <DynamicOptionRow
                            key={option.Name}
                            option={option}
                            value={values[option.Name] ?? ""}
                            onChange={(v) => setValues((prev) => ({ ...prev, [option.Name]: v }))}
                          />
                        ))}
                    </>
                  )}
                </>
              )}

              {oauth && (
                <p className="text-muted-foreground text-xs">
                  After you press {editing ? "Save" : "Create"}, your browser opens to authorize
                  access. Keep this window open until that finishes.
                </p>
              )}
            </div>
            <DialogFooter>
              {!editing && (
                <Button variant="ghost" onClick={() => setStep("type")} disabled={busy}>
                  Back
                </Button>
              )}
              <Button
                onClick={submit}
                disabled={busy || (!editing && (!name || !!nameError)) || missingRequired > 0}
              >
                {busy && <Loader2 className="animate-spin" />}
                {editing ? "Save" : "Create"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

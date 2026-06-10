import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

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

import { PROVIDER_PRESETS, presetFor, type ProviderField } from "./provider-presets";
import { useCreateRemote, useUpdateRemote } from "./use-remotes";

const NAME_RE = /^[\w.][\w.\s-]*$/;

interface RemoteWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, the wizard edits this remote instead of creating one. */
  editing?: { name: string; type: string; values: Record<string, string> } | null;
  existingNames: string[];
}

function FieldInput({
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

export function RemoteWizard({ open, onOpenChange, editing, existingNames }: RemoteWizardProps) {
  const [step, setStep] = useState<"type" | "details">(editing ? "details" : "type");
  const [name, setName] = useState(editing?.name ?? "");
  const [type, setType] = useState(editing?.type ?? "");
  const [values, setValues] = useState<Record<string, string>>(editing?.values ?? {});

  const createRemote = useCreateRemote();
  const updateRemote = useUpdateRemote();
  const preset = useMemo(() => (type ? presetFor(type) : undefined), [type]);
  const busy = createRemote.isPending || updateRemote.isPending;

  const nameError = !name
    ? null
    : !NAME_RE.test(name)
      ? "Only letters, digits, dot, dash, underscore."
      : !editing && existingNames.includes(name)
        ? "A remote with this name already exists."
        : null;

  const missingRequired = (preset?.fields ?? [])
    .filter((f) => f.required && !values[f.key]?.trim())
    .map((f) => f.label);

  const reset = () => {
    setStep(editing ? "details" : "type");
    setName(editing?.name ?? "");
    setType(editing?.type ?? "");
    setValues(editing?.values ?? {});
  };

  const close = (next: boolean) => {
    onOpenChange(next);
    if (!next) reset();
  };

  const submit = () => {
    const parameters: Record<string, unknown> = {};
    for (const field of preset?.fields ?? []) {
      const v = values[field.key]?.trim();
      if (v) parameters[field.key] = v;
    }
    const onSuccess = () => close(false);
    if (editing) {
      updateRemote.mutate({ name: editing.name, parameters }, { onSuccess });
    } else {
      createRemote.mutate({ name, type, parameters, interactive: preset?.oauth }, { onSuccess });
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        {step === "type" ? (
          <>
            <DialogHeader>
              <DialogTitle>Add remote</DialogTitle>
              <DialogDescription>Choose the storage provider to connect.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-1.5">
              {PROVIDER_PRESETS.map((p) => (
                <button
                  key={p.type}
                  onClick={() => {
                    setType(p.type);
                    setStep("details");
                  }}
                  className="hover:bg-accent rounded-md border px-3 py-2 text-left transition-colors"
                >
                  <div className="text-sm font-medium">{p.label}</div>
                  <div className="text-muted-foreground text-xs">{p.description}</div>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>
                {editing ? `Edit "${editing.name}"` : (preset?.label ?? type)}
              </DialogTitle>
              <DialogDescription>
                {preset?.description ?? "Configure the remote."}
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
              {(preset?.fields ?? []).map((field) => (
                <div key={field.key} className="flex flex-col gap-1.5">
                  <Label htmlFor={`field-${field.key}`}>
                    {field.label}
                    {field.required && <span className="text-destructive"> *</span>}
                  </Label>
                  <FieldInput
                    field={field}
                    value={values[field.key] ?? ""}
                    onChange={(v) => setValues((prev) => ({ ...prev, [field.key]: v }))}
                  />
                  {field.help && <p className="text-muted-foreground text-xs">{field.help}</p>}
                </div>
              ))}
              {preset?.oauth && (
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
                disabled={
                  busy || (!editing && (!name || !!nameError)) || missingRequired.length > 0
                }
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

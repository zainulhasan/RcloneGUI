import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

import type { FlagsValue } from "./flags";

interface FlagsEditorProps {
  value: FlagsValue;
  onChange: (value: FlagsValue) => void;
  /** Hide the dry-run switch (e.g. for plain deletes with their own confirm). */
  hideDryRun?: boolean;
}

export function FlagsEditor({ value, onChange, hideDryRun }: FlagsEditorProps) {
  const patch = (p: Partial<FlagsValue>) => onChange({ ...value, ...p });

  return (
    <div className="flex flex-col gap-3">
      {!hideDryRun && (
        <div className="flex items-center justify-between rounded-md border px-3 py-2">
          <div>
            <Label htmlFor="flag-dry-run">Dry run</Label>
            <p className="text-muted-foreground text-xs">
              Show what would happen without changing anything.
            </p>
          </div>
          <Switch
            id="flag-dry-run"
            checked={value.dryRun}
            onCheckedChange={(dryRun) => patch({ dryRun })}
          />
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="flag-transfers">Transfers</Label>
          <Input
            id="flag-transfers"
            inputMode="numeric"
            placeholder="4"
            value={value.transfers}
            onChange={(e) => patch({ transfers: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="flag-checkers">Checkers</Label>
          <Input
            id="flag-checkers"
            inputMode="numeric"
            placeholder="8"
            value={value.checkers}
            onChange={(e) => patch({ checkers: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="flag-bwlimit">Bandwidth</Label>
          <Input
            id="flag-bwlimit"
            placeholder="10M / off"
            value={value.bwLimit}
            onChange={(e) => patch({ bwLimit: e.target.value })}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="flag-include">Include rules</Label>
          <Textarea
            id="flag-include"
            rows={3}
            placeholder={"*.mkv\nfilms/**"}
            className="font-mono text-xs"
            value={value.include}
            onChange={(e) => patch({ include: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="flag-exclude">Exclude rules</Label>
          <Textarea
            id="flag-exclude"
            rows={3}
            placeholder={"*.tmp\n.DS_Store"}
            className="font-mono text-xs"
            value={value.exclude}
            onChange={(e) => patch({ exclude: e.target.value })}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="flag-min-size">Min size</Label>
          <Input
            id="flag-min-size"
            placeholder="100M"
            value={value.minSize}
            onChange={(e) => patch({ minSize: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="flag-max-size">Max size</Label>
          <Input
            id="flag-max-size"
            placeholder="50G"
            value={value.maxSize}
            onChange={(e) => patch({ maxSize: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}

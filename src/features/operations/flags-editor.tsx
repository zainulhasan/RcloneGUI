import { Field } from "@/components/layout/field";
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

      <div className="grid grid-cols-3 items-start gap-2">
        <Field
          label="Transfers"
          htmlFor="flag-transfers"
          help="How many files transfer in parallel. Higher = faster for many small files; lower is gentler on slow connections. rclone default: 4."
        >
          <Input
            id="flag-transfers"
            inputMode="numeric"
            placeholder="4"
            value={value.transfers}
            onChange={(e) => patch({ transfers: e.target.value })}
          />
        </Field>
        <Field
          label="Checkers"
          htmlFor="flag-checkers"
          help="How many files are compared in parallel to decide what needs copying. rclone default: 8."
        >
          <Input
            id="flag-checkers"
            inputMode="numeric"
            placeholder="8"
            value={value.checkers}
            onChange={(e) => patch({ checkers: e.target.value })}
          />
        </Field>
        <Field
          label="Bandwidth"
          htmlFor="flag-bwlimit"
          help="Speed cap for this operation, e.g. 10M (10 MiB/s) or 1M:100k for separate up:down limits. Empty = unlimited."
        >
          <Input
            id="flag-bwlimit"
            placeholder="10M / off"
            value={value.bwLimit}
            onChange={(e) => patch({ bwLimit: e.target.value })}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field
          label="Include rules"
          htmlFor="flag-include"
          help="Only transfer matching files — one pattern per line. * matches within a folder, ** crosses folders. Example: *.mkv transfers only mkv files."
        >
          <Textarea
            id="flag-include"
            rows={3}
            placeholder={"*.mkv\nfilms/**"}
            className="font-mono text-xs"
            value={value.include}
            onChange={(e) => patch({ include: e.target.value })}
          />
        </Field>
        <Field
          label="Exclude rules"
          htmlFor="flag-exclude"
          help="Skip matching files — one pattern per line. Useful for temp files: *.tmp, .DS_Store, node_modules/**."
        >
          <Textarea
            id="flag-exclude"
            rows={3}
            placeholder={"*.tmp\n.DS_Store"}
            className="font-mono text-xs"
            value={value.exclude}
            onChange={(e) => patch({ exclude: e.target.value })}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field
          label="Min size"
          htmlFor="flag-min-size"
          help="Skip files smaller than this, e.g. 100M. Handy to ignore thumbnails and metadata files."
        >
          <Input
            id="flag-min-size"
            placeholder="100M"
            value={value.minSize}
            onChange={(e) => patch({ minSize: e.target.value })}
          />
        </Field>
        <Field
          label="Max size"
          htmlFor="flag-max-size"
          help="Skip files larger than this, e.g. 50G. Protects against accidentally syncing huge files."
        >
          <Input
            id="flag-max-size"
            placeholder="50G"
            value={value.maxSize}
            onChange={(e) => patch({ maxSize: e.target.value })}
          />
        </Field>
      </div>
    </div>
  );
}

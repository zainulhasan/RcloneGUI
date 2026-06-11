import { useEffect, useState } from "react";
import { FolderOpen, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useRcloneInfo } from "@/features/health/use-daemon";
import { isAutostartEnabled, setAutostart } from "@/features/background/use-background";
import { checkForUpdates } from "@/features/updater/use-updater";
import { useSettingsStore } from "@/store/settings";
import { useThemeStore, type Theme } from "@/store/theme";

async function pickDirectory(): Promise<string | null> {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const result = await open({ directory: true, multiple: false });
  return typeof result === "string" ? result : null;
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">{children}</CardContent>
    </Card>
  );
}

function Row({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="grid grid-cols-[220px_1fr] items-center gap-4">
      <div>
        <Label>{label}</Label>
        {hint && <p className="text-muted-foreground mt-0.5 text-xs">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

export function SettingsView() {
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [autostart, setAutostartState] = useState(false);
  useEffect(() => {
    void isAutostartEnabled().then(setAutostartState);
  }, []);
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const rcloneInfo = useRcloneInfo();

  return (
    <div className="flex max-w-3xl flex-col gap-4 p-6">
      <PageHeader title="Settings" description="Preferences are saved automatically." />

      <Section
        title="Background"
        description="With both enabled, mounts and scheduled jobs are available right after login — no window needed."
      >
        <Row
          label="Keep running in the tray"
          hint="Closing the window hides RcloneGUI instead of quitting. Quit from the tray menu."
        >
          <Switch
            checked={settings.runInBackground}
            onCheckedChange={(v) => void update({ runInBackground: v })}
            aria-label="Keep running in the tray"
          />
        </Row>
        <Row label="Launch at login" hint="Start RcloneGUI automatically when you log in.">
          <Switch
            checked={autostart}
            onCheckedChange={(v) => {
              setAutostartState(v);
              void setAutostart(v);
            }}
            aria-label="Launch at login"
          />
        </Row>
      </Section>

      <Section title="Appearance">
        <Row label="Theme">
          <Select value={theme} onValueChange={(v) => setTheme(v as Theme)}>
            <SelectTrigger className="w-44" aria-label="Theme">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="system">System</SelectItem>
              <SelectItem value="light">Light</SelectItem>
              <SelectItem value="dark">Dark</SelectItem>
            </SelectContent>
          </Select>
        </Row>
      </Section>

      <Section
        title="rclone"
        description={
          rcloneInfo.data
            ? `Using ${rcloneInfo.data.path} (${rcloneInfo.data.version})`
            : "rclone was not detected."
        }
      >
        <Row
          label="rclone binary path"
          hint="Leave empty to auto-detect from PATH. Restart needed."
        >
          <Input
            className="font-mono text-xs"
            placeholder="/usr/local/bin/rclone"
            value={settings.rclonePath ?? ""}
            onChange={(e) => void update({ rclonePath: e.target.value.trim() || null })}
          />
        </Row>
      </Section>

      <Section title="Default transfer flags" description="Pre-filled into every new operation.">
        <Row label="Transfers" hint="Parallel file transfers (rclone default 4).">
          <Input
            className="w-32"
            inputMode="numeric"
            placeholder="4"
            value={settings.defaultTransfers ?? ""}
            onChange={(e) => {
              const n = Number.parseInt(e.target.value, 10);
              void update({ defaultTransfers: Number.isInteger(n) && n > 0 ? n : null });
            }}
          />
        </Row>
        <Row label="Checkers" hint="Parallel checks (rclone default 8).">
          <Input
            className="w-32"
            inputMode="numeric"
            placeholder="8"
            value={settings.defaultCheckers ?? ""}
            onChange={(e) => {
              const n = Number.parseInt(e.target.value, 10);
              void update({ defaultCheckers: Number.isInteger(n) && n > 0 ? n : null });
            }}
          />
        </Row>
        <Row label="Bandwidth limit" hint='e.g. "10M", "1M:100k" (up:down), or empty for none.'>
          <Input
            className="w-32"
            placeholder="off"
            value={settings.defaultBwLimit ?? ""}
            onChange={(e) => void update({ defaultBwLimit: e.target.value.trim() || null })}
          />
        </Row>
      </Section>

      <Section
        title="Watch folder"
        description="Where “Watch” syncs media locally. Auto-cleanup only ever touches this folder."
      >
        <Row label="Folder">
          <div className="flex gap-2">
            <Input
              className="font-mono text-xs"
              placeholder="/Users/you/Movies/Watch"
              value={settings.watchFolder ?? ""}
              onChange={(e) => void update({ watchFolder: e.target.value.trim() || null })}
            />
            <Button
              variant="outline"
              size="icon"
              aria-label="Choose watch folder"
              onClick={() => {
                void pickDirectory().then((dir) => dir && void update({ watchFolder: dir }));
              }}
            >
              <FolderOpen />
            </Button>
          </div>
        </Row>
        <Row label="Open after sync" hint="Open the file with the system default app when ready.">
          <Switch
            checked={settings.autoOpenAfterSync}
            onCheckedChange={(v) => void update({ autoOpenAfterSync: v })}
            aria-label="Open after sync"
          />
        </Row>
        <Row
          label="Delete when marked watched"
          hint="Remove the local copy as soon as you mark it watched."
        >
          <Switch
            checked={settings.deleteOnMarkWatched}
            onCheckedChange={(v) => void update({ deleteOnMarkWatched: v })}
            aria-label="Delete when marked watched"
          />
        </Row>
      </Section>

      <Section
        title="Auto-cleanup"
        description="Optional rules that free up the watch folder. Deletions are logged under Logs → Activity."
      >
        <Row
          label="Delete after (hours)"
          hint="Remove local copies N hours after sync. Empty = off."
        >
          <Input
            className="w-32"
            inputMode="numeric"
            placeholder="off"
            value={settings.cleanup.afterHours ?? ""}
            onChange={(e) => {
              const n = Number.parseInt(e.target.value, 10);
              void update({
                cleanup: {
                  ...settings.cleanup,
                  afterHours: Number.isInteger(n) && n > 0 ? n : null,
                },
              });
            }}
          />
        </Row>
        <Row
          label="Size cap (GB)"
          hint="Evict oldest items when the folder exceeds this size. Empty = off."
        >
          <Input
            className="w-32"
            inputMode="numeric"
            placeholder="off"
            value={settings.cleanup.sizeCapGb ?? ""}
            onChange={(e) => {
              const n = Number.parseInt(e.target.value, 10);
              void update({
                cleanup: {
                  ...settings.cleanup,
                  sizeCapGb: Number.isInteger(n) && n > 0 ? n : null,
                },
              });
            }}
          />
        </Row>
        <Row
          label="Only delete watched items"
          hint="Off = unwatched items may be auto-deleted too."
        >
          <Switch
            checked={settings.cleanup.watchedOnly}
            onCheckedChange={(v) =>
              void update({ cleanup: { ...settings.cleanup, watchedOnly: v } })
            }
            aria-label="Only delete watched items"
          />
        </Row>
      </Section>

      <Section
        title="Media library"
        description="Posters and metadata come from TMDB with your own free API key (themoviedb.org)."
      >
        <Row label="TMDB API key">
          <Input
            type="password"
            className="font-mono text-xs"
            placeholder="paste your API key"
            value={settings.tmdbApiKey ?? ""}
            onChange={(e) => void update({ tmdbApiKey: e.target.value.trim() || null })}
          />
        </Row>
      </Section>

      <Section title="Updates" description="RcloneGUI also checks automatically on launch.">
        <Row label="Check for updates">
          <Button
            variant="outline"
            className="w-fit"
            disabled={checkingUpdates}
            onClick={() => {
              setCheckingUpdates(true);
              void checkForUpdates({ silent: false }).finally(() => setCheckingUpdates(false));
            }}
          >
            <RefreshCw /> Check now
          </Button>
        </Row>
      </Section>
    </div>
  );
}

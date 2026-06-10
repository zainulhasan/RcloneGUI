import { useEffect } from "react";
import { CheckCircle2, Download, Loader2, RefreshCw, XCircle } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSettingsStore } from "@/store/settings";

import { useDaemon, useRcloneInfo } from "./use-daemon";

function Splash({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-background flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md">{children}</Card>
    </div>
  );
}

/**
 * Boots the app: hydrates settings, detects rclone and starts the RC daemon.
 * Renders onboarding/error screens until the daemon is up, then the app.
 */
export function DaemonGate({ children }: { children: React.ReactNode }) {
  const hydrate = useSettingsStore((s) => s.hydrate);
  const hydrated = useSettingsStore((s) => s.hydrated);
  const info = useRcloneInfo();
  const daemon = useDaemon();

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  if (!hydrated || daemon.isLoading || info.isLoading) {
    return (
      <Splash>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Loader2 className="size-4 animate-spin" />
            Starting RcloneGUI
          </CardTitle>
          <CardDescription>Detecting rclone and starting the control daemon…</CardDescription>
        </CardHeader>
      </Splash>
    );
  }

  if (info.data === null) {
    return (
      <Splash>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <XCircle className="text-destructive size-4" />
            rclone not found
          </CardTitle>
          <CardDescription>
            RcloneGUI needs the rclone binary. Install it, or set its path in Settings once the app
            starts.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Button asChild>
            <a href="https://rclone.org/downloads/" target="_blank" rel="noreferrer">
              <Download /> Download rclone
            </a>
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              void info.refetch();
              void daemon.refetch();
            }}
          >
            <RefreshCw /> Check again
          </Button>
        </CardContent>
      </Splash>
    );
  }

  if (daemon.isError || (daemon.data && !daemon.data.running)) {
    return (
      <Splash>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <XCircle className="text-destructive size-4" />
            Could not start the rclone daemon
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Alert variant="destructive">
            <AlertTitle>Daemon error</AlertTitle>
            <AlertDescription>{String(daemon.error ?? "Unknown error")}</AlertDescription>
          </Alert>
          {info.data && (
            <p className="text-muted-foreground text-xs">
              Using <span className="font-mono">{info.data.path}</span> ({info.data.version})
            </p>
          )}
          <Button variant="outline" onClick={() => void daemon.refetch()}>
            <RefreshCw /> Retry
          </Button>
        </CardContent>
      </Splash>
    );
  }

  return (
    <>
      {children}
      <span className="sr-only" data-testid="daemon-ready">
        <CheckCircle2 className="size-3" /> daemon ready
      </span>
    </>
  );
}

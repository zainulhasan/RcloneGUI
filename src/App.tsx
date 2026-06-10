import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { AppShell } from "@/components/layout/app-shell";
import { DaemonGate } from "@/features/health/daemon-gate";
import { BrowserWithOperations } from "@/features/operations/browser-operations";
import { LogsView } from "@/features/logs/logs-view";
import { MediaView } from "@/features/media/media-view";
import { WatchedBadge, WatchMenuItems } from "@/features/media/browser-integration";
import { useCleanupRunner } from "@/features/media/use-cleanup-runner";
import { MountsView } from "@/features/mounts/mounts-view";
import { RemotesView } from "@/features/remotes/remotes-view";
import { SchedulerView } from "@/features/scheduler/scheduler-view";
import { useSchedulerRunner } from "@/features/scheduler/use-scheduler-runner";
import { SettingsView } from "@/features/settings/settings-view";
import { TransfersView } from "@/features/transfers/transfers-view";
import { useJobCompletionWatcher } from "@/features/transfers/use-transfers";
import { useNavigationStore, type View } from "@/store/navigation";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const VIEW_TITLES: Record<View, string> = {
  dashboard: "Dashboard",
  remotes: "Remotes",
  browser: "Browser",
  transfers: "Transfers",
  mounts: "Mounts",
  scheduler: "Scheduler",
  media: "Media",
  logs: "Logs",
  settings: "Settings",
};

function Placeholder({ view }: { view: View }) {
  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold">{VIEW_TITLES[view]}</h1>
      <p className="text-muted-foreground mt-2 text-sm">Coming soon.</p>
    </div>
  );
}

function CurrentView() {
  const view = useNavigationStore((s) => s.view);
  switch (view) {
    case "remotes":
      return <RemotesView />;
    case "browser":
      return (
        <BrowserWithOperations
          renderItemBadge={(item, pane) => <WatchedBadge item={item} pane={pane} />}
          renderItemActions={(items, pane) => <WatchMenuItems items={items} pane={pane} />}
        />
      );
    case "media":
      return <MediaView />;
    case "transfers":
      return <TransfersView />;
    case "mounts":
      return <MountsView />;
    case "scheduler":
      return <SchedulerView />;
    case "logs":
      return <LogsView />;
    case "settings":
      return <SettingsView />;
    default:
      return <Placeholder view={view} />;
  }
}

/** Hooks that must run for the whole app session, inside the daemon gate. */
function BackgroundServices() {
  useJobCompletionWatcher();
  useSchedulerRunner();
  useCleanupRunner();
  return null;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={300}>
        <DaemonGate>
          <BackgroundServices />
          <AppShell>
            <CurrentView />
          </AppShell>
        </DaemonGate>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

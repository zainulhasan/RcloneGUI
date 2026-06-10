import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { AppShell } from "@/components/layout/app-shell";
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

function CurrentView() {
  const view = useNavigationStore((s) => s.view);
  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold">{VIEW_TITLES[view]}</h1>
      <p className="text-muted-foreground mt-2 text-sm">Coming soon.</p>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={300}>
        <AppShell>
          <CurrentView />
        </AppShell>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

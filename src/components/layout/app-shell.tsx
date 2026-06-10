import type { LucideIcon } from "lucide-react";
import {
  ArrowLeftRight,
  CalendarClock,
  Clapperboard,
  FolderTree,
  HardDrive,
  Home,
  Moon,
  ScrollText,
  Server,
  Settings,
  Sun,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useNavigationStore, type View } from "@/store/navigation";
import { resolveTheme, useThemeStore } from "@/store/theme";

interface NavItem {
  view: View;
  label: string;
  icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { view: "dashboard", label: "Dashboard", icon: Home },
  { view: "remotes", label: "Remotes", icon: Server },
  { view: "browser", label: "Browser", icon: FolderTree },
  { view: "transfers", label: "Transfers", icon: ArrowLeftRight },
  { view: "mounts", label: "Mounts", icon: HardDrive },
  { view: "scheduler", label: "Scheduler", icon: CalendarClock },
  { view: "media", label: "Media", icon: Clapperboard },
  { view: "logs", label: "Logs", icon: ScrollText },
];

function ThemeToggle() {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const resolved = resolveTheme(theme);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Toggle theme"
          onClick={() => setTheme(resolved === "dark" ? "light" : "dark")}
        >
          {resolved === "dark" ? <Sun /> : <Moon />}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right">Toggle theme</TooltipContent>
    </Tooltip>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const view = useNavigationStore((s) => s.view);
  const navigate = useNavigationStore((s) => s.navigate);

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="bg-sidebar border-sidebar-border flex w-52 shrink-0 flex-col border-r">
        <div className="flex h-13 items-center gap-2 px-4">
          <ArrowLeftRight className="text-primary size-5" />
          <span className="text-sidebar-foreground text-sm font-semibold">RcloneGUI</span>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 px-2 py-2" aria-label="Main">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.view}
              onClick={() => navigate(item.view)}
              aria-current={view === item.view ? "page" : undefined}
              className={cn(
                "text-sidebar-foreground flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                view === item.view
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "hover:bg-sidebar-accent/60",
              )}
            >
              <item.icon className="size-4" />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="border-sidebar-border flex items-center justify-between border-t px-3 py-2">
          <button
            onClick={() => navigate("settings")}
            aria-current={view === "settings" ? "page" : undefined}
            className={cn(
              "text-sidebar-foreground flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
              view === "settings"
                ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                : "hover:bg-sidebar-accent/60",
            )}
          >
            <Settings className="size-4" />
            Settings
          </button>
          <ThemeToggle />
        </div>
      </aside>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}

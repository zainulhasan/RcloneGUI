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

interface NavSection {
  label: string | null;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    label: null,
    items: [{ view: "dashboard", label: "Dashboard", icon: Home }],
  },
  {
    label: "Files",
    items: [
      { view: "remotes", label: "Remotes", icon: Server },
      { view: "browser", label: "Browser", icon: FolderTree },
      { view: "transfers", label: "Transfers", icon: ArrowLeftRight },
      { view: "mounts", label: "Mounts", icon: HardDrive },
    ],
  },
  {
    label: "Automation",
    items: [
      { view: "scheduler", label: "Scheduler", icon: CalendarClock },
      { view: "media", label: "Media", icon: Clapperboard },
    ],
  },
  {
    label: "System",
    items: [{ view: "logs", label: "Logs", icon: ScrollText }],
  },
];

function NavButton({ item }: { item: NavItem }) {
  const view = useNavigationStore((s) => s.view);
  const navigate = useNavigationStore((s) => s.navigate);
  const isActive = view === item.view;

  return (
    <button
      onClick={() => navigate(item.view)}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "group relative flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
        isActive
          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
          : "text-sidebar-foreground hover:bg-sidebar-accent/60",
      )}
    >
      {isActive && (
        <span className="bg-primary absolute top-1/2 left-0 h-4 w-0.5 -translate-y-1/2 rounded-full" />
      )}
      <item.icon className={cn("size-4", isActive ? "text-primary" : "text-muted-foreground")} />
      {item.label}
    </button>
  );
}

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
      <aside className="bg-sidebar border-sidebar-border flex w-56 shrink-0 flex-col border-r">
        <div className="flex h-14 items-center gap-2.5 px-4">
          <div className="bg-primary flex size-7 items-center justify-center rounded-lg shadow-sm">
            <ArrowLeftRight className="text-primary-foreground size-4" />
          </div>
          <span className="text-sidebar-foreground text-sm font-semibold tracking-tight">
            RcloneGUI
          </span>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-1" aria-label="Main">
          {NAV_SECTIONS.map((section, i) => (
            <div key={i} className="flex flex-col gap-0.5">
              {section.label && (
                <p className="text-muted-foreground px-2.5 pt-3 pb-1 text-[10px] font-semibold tracking-wider uppercase">
                  {section.label}
                </p>
              )}
              {section.items.map((item) => (
                <NavButton key={item.view} item={item} />
              ))}
            </div>
          ))}
        </nav>
        <div className="border-sidebar-border flex items-center justify-between border-t px-3 py-2">
          <button
            onClick={() => navigate("settings")}
            aria-current={view === "settings" ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
              view === "settings"
                ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                : "text-sidebar-foreground hover:bg-sidebar-accent/60",
            )}
          >
            <Settings
              className={cn(
                "size-4",
                view === "settings" ? "text-primary" : "text-muted-foreground",
              )}
            />
            Settings
          </button>
          <ThemeToggle />
        </div>
      </aside>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}

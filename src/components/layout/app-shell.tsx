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
  Share2,
  Server,
  Settings,
  Sun,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { rc } from "@/lib/rc-client";
import { useHostKey } from "@/lib/rc-client/host-key";
import { LOCAL_HOST_ID, useHostStore, useIsLocalHost } from "@/store/host";
import { useSettingsStore } from "@/store/settings";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useNavigationStore, type View } from "@/store/navigation";
import { resolveTheme, useThemeStore } from "@/store/theme";

interface NavItem {
  view: View;
  label: string;
  icon: LucideIcon;
}

const NAV_SECTIONS: { label: string | null; items: NavItem[] }[] = [
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
      { view: "serve", label: "Serve", icon: Share2 },
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

const VIEW_TITLES: Record<View, string> = {
  dashboard: "Dashboard",
  remotes: "Remotes",
  browser: "Browser",
  transfers: "Transfers",
  mounts: "Mounts",
  serve: "Serve",
  scheduler: "Scheduler",
  media: "Media",
  logs: "Logs",
  settings: "Settings",
};

function HostPicker() {
  const hosts = useSettingsStore((s) => s.settings.hosts);
  const activeHostId = useHostStore((s) => s.activeHostId);
  const setActiveHost = useHostStore((s) => s.setActiveHost);

  const health = useQuery({
    queryKey: useHostKey("host-health"),
    queryFn: () => rc.version(),
    refetchInterval: 10_000,
    retry: false,
  });

  if (hosts.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <span
        aria-label={health.isError ? "Host unreachable" : "Host connected"}
        className={cn(
          "size-2 rounded-full",
          health.isError ? "bg-destructive" : health.data ? "bg-success" : "bg-muted-foreground/40",
        )}
      />
      <Select value={activeHostId} onValueChange={setActiveHost}>
        <SelectTrigger size="sm" className="w-36" aria-label="Active host">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={LOCAL_HOST_ID}>Local</SelectItem>
          {hosts.map((h) => (
            <SelectItem key={h.id} value={h.id}>
              {h.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
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
      <TooltipContent>Toggle theme</TooltipContent>
    </Tooltip>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const view = useNavigationStore((s) => s.view);
  const navigate = useNavigationStore((s) => s.navigate);
  const isLocal = useIsLocalHost();
  // The media workflow writes to THIS machine's watch folder — local only.
  const visibleSections = isLocal
    ? NAV_SECTIONS
    : NAV_SECTIONS.map((s) => ({
        ...s,
        items: s.items.filter((i) => i.view !== "media"),
      }));

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" onClick={() => navigate("dashboard")}>
                <div className="bg-primary text-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                  <ArrowLeftRight className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">RcloneGUI</span>
                  <span className="text-muted-foreground truncate text-xs">Cloud sync</span>
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          {visibleSections.map((section, i) => (
            <SidebarGroup key={i}>
              {section.label && <SidebarGroupLabel>{section.label}</SidebarGroupLabel>}
              <SidebarGroupContent>
                <SidebarMenu>
                  {section.items.map((item) => (
                    <SidebarMenuItem key={item.view}>
                      <SidebarMenuButton
                        isActive={view === item.view}
                        tooltip={item.label}
                        onClick={() => navigate(item.view)}
                        className="relative data-[active=true]:[&>svg]:text-sidebar-primary"
                      >
                        {view === item.view && (
                          <span className="bg-sidebar-primary absolute top-1/2 left-0 h-4 w-[3px] -translate-y-1/2 rounded-r-full" />
                        )}
                        <item.icon />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={view === "settings"}
                tooltip="Settings"
                onClick={() => navigate("settings")}
              >
                <Settings />
                <span>Settings</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="h-screen overflow-hidden">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-4" />
          <span className="text-sm font-medium">{VIEW_TITLES[view]}</span>
          <div className="ml-auto flex items-center gap-2">
            <HostPicker />
            <ThemeToggle />
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-auto">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}

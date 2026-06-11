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
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
  scheduler: "Scheduler",
  media: "Media",
  logs: "Logs",
  settings: "Settings",
};

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
          {NAV_SECTIONS.map((section, i) => (
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
                      >
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
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-auto">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}

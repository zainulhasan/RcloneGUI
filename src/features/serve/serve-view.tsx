import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { Copy, Loader2, Play, Share2, Shuffle, Square, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/layout/page";
import { Field } from "@/components/layout/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useRemotes } from "@/features/remotes/use-remotes";
import { useSavedServesStore } from "@/store/saved-serves";

import { serveUrl, type ServeConfig, type ServeProtocol } from "./serve-options";
import { startServe, stopServe, useActiveServesStore } from "./use-serves";

const PROTOCOL_HELP: Record<ServeProtocol, string> = {
  http: "Plain web link — open in any browser or media player.",
  webdav: "Mountable by Finder/Explorer and most file manager apps.",
  dlna: "Discovered automatically by smart TVs and media players on the network.",
};

function useLanIp() {
  return useQuery({
    queryKey: ["lan-ip"],
    queryFn: () => invoke<string | null>("lan_ip"),
    staleTime: 60_000,
  });
}

export function ServeView() {
  const remotes = useRemotes();
  const lanIp = useLanIp();
  const active = useActiveServesStore((s) => s.serves);
  const saved = useSavedServesStore((s) => s.serves);
  const removeSaved = useSavedServesStore((s) => s.remove);
  const setAutoStart = useSavedServesStore((s) => s.setAutoStart);
  const upsertSaved = useSavedServesStore((s) => s.upsert);

  const [remote, setRemote] = useState("");
  const [path, setPath] = useState("");
  const [protocol, setProtocol] = useState<ServeProtocol>("http");
  const [port, setPort] = useState("8080");
  const [readOnly, setReadOnly] = useState(true);
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [remember, setRemember] = useState(true);
  const [starting, setStarting] = useState(false);

  const remoteNames = Object.keys(remotes.data ?? {}).sort();
  const portNum = Number.parseInt(port, 10);
  const valid = remote !== "" && Number.isInteger(portNum) && portNum > 0 && portNum < 65536;
  const runningIds = new Set(active.map((a) => a.config.id));

  const start = async () => {
    const config: ServeConfig = {
      id: crypto.randomUUID(),
      fs: path.trim() ? `${remote}${path.trim().replace(/^\/+/, "")}` : remote,
      protocol,
      port: portNum,
      readOnly,
      user,
      pass,
      autoStart: false,
    };
    setStarting(true);
    try {
      await startServe(config);
      if (remember) void upsertSaved(config);
      toast.success(`Serving ${config.fs} on port ${config.port}`);
    } catch (err) {
      toast.error("Could not start serving", { description: (err as Error).message });
    } finally {
      setStarting(false);
    }
  };

  const pickFreePort = () => {
    void invoke<number>("free_port").then((p) => setPort(String(p)));
  };

  return (
    <div className="flex flex-col gap-4 p-6">
      <PageHeader
        title="Serve"
        description="Expose a remote over your network · browsers, file managers and smart TVs"
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">New share</CardTitle>
          <CardDescription>Stops when the app quits unless saved with auto-start.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-2 items-start gap-x-4 gap-y-3 lg:grid-cols-4">
            <Field label="Remote" htmlFor="serve-remote" help="Which remote to share.">
              <Select value={remote || undefined} onValueChange={setRemote}>
                <SelectTrigger id="serve-remote" className="w-full">
                  <SelectValue placeholder="Choose…" />
                </SelectTrigger>
                <SelectContent>
                  {remoteNames.map((r) => (
                    <SelectItem key={r} value={`${r}:`}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field
              label="Folder"
              htmlFor="serve-path"
              help="Share only this folder within the remote. Empty = the whole remote."
            >
              <Input
                id="serve-path"
                className="font-mono text-xs"
                placeholder="films (optional)"
                value={path}
                onChange={(e) => setPath(e.target.value)}
              />
            </Field>
            <Field
              label="Protocol"
              htmlFor="serve-protocol"
              help="http: open in a browser. webdav: mount in Finder/Explorer. dlna: smart TVs find it automatically."
              hint={PROTOCOL_HELP[protocol]}
            >
              <Select value={protocol} onValueChange={(v) => setProtocol(v as ServeProtocol)}>
                <SelectTrigger id="serve-protocol" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="http">HTTP</SelectItem>
                  <SelectItem value="webdav">WebDAV</SelectItem>
                  <SelectItem value="dlna">DLNA</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field
              label="Port"
              htmlFor="serve-port"
              help="Network port for the share. Use the shuffle button to pick a free one automatically."
            >
              <div className="flex gap-2">
                <Input
                  id="serve-port"
                  inputMode="numeric"
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="Pick a free port"
                      onClick={pickFreePort}
                    >
                      <Shuffle />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Pick a free port</TooltipContent>
                </Tooltip>
              </div>
            </Field>
          </div>

          {protocol !== "dlna" && (
            <div className="grid grid-cols-2 items-start gap-x-4 gap-y-3 lg:w-1/2">
              <Field
                label="Username"
                htmlFor="serve-user"
                help="Optional password protection. Leave empty for an open share on your network."
              >
                <Input
                  id="serve-user"
                  placeholder="optional"
                  value={user}
                  onChange={(e) => setUser(e.target.value)}
                />
              </Field>
              <Field label="Password" htmlFor="serve-pass">
                <Input
                  id="serve-pass"
                  type="password"
                  placeholder="optional"
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                />
              </Field>
            </div>
          )}

          <div className="flex items-center gap-6">
            <Tooltip>
              <TooltipTrigger asChild>
                <label className="flex cursor-help items-center gap-2 text-sm">
                  <Switch checked={readOnly} onCheckedChange={setReadOnly} aria-label="Read only" />
                  Read-only
                </label>
              </TooltipTrigger>
              <TooltipContent className="max-w-72">
                Viewers can browse and download but not change anything. Recommended for sharing.
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <label className="flex cursor-help items-center gap-2 text-sm">
                  <Switch
                    checked={remember}
                    onCheckedChange={setRemember}
                    aria-label="Remember serve"
                  />
                  Remember this share
                </label>
              </TooltipTrigger>
              <TooltipContent className="max-w-72">
                Saves the configuration below for one-click restarts and optional auto-start.
              </TooltipContent>
            </Tooltip>
            <Button className="ml-auto" onClick={() => void start()} disabled={!valid || starting}>
              {starting ? <Loader2 className="animate-spin" /> : <Share2 />}
              Start sharing
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── right: tables ── */}
      <div className="flex flex-col gap-4">
        {active.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Active shares</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>What</TableHead>
                    <TableHead>Protocol</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead className="w-28 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {active.map(({ jobid, config }) => {
                    const url = serveUrl(config, lanIp.data ?? "localhost");
                    return (
                      <TableRow key={jobid}>
                        <TableCell className="font-mono text-xs">{config.fs}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{config.protocol}</Badge>
                          {config.readOnly && (
                            <Badge variant="outline" className="ml-1">
                              read-only
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="flex items-center gap-1">
                            <a
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary font-mono text-xs hover:underline"
                            >
                              {url}
                            </a>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon-xs"
                                  aria-label="Copy URL"
                                  onClick={() => {
                                    void navigator.clipboard.writeText(url);
                                    toast.success("URL copied");
                                  }}
                                >
                                  <Copy />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Copy URL</TooltipContent>
                            </Tooltip>
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              void stopServe(jobid)
                                .then(() => toast.success("Stopped"))
                                .catch((err: Error) => toast.error(`Stop failed: ${err.message}`));
                            }}
                          >
                            <Square /> Stop
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {saved.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Saved shares</CardTitle>
              <CardDescription>
                Auto-start launches the share when RcloneGUI starts.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>What</TableHead>
                    <TableHead>Protocol</TableHead>
                    <TableHead>Port</TableHead>
                    <TableHead>Auto-start</TableHead>
                    <TableHead className="w-28 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {saved.map((config) => (
                    <TableRow key={config.id}>
                      <TableCell className="font-mono text-xs">{config.fs}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{config.protocol}</Badge>
                      </TableCell>
                      <TableCell className="text-xs tabular-nums">{config.port}</TableCell>
                      <TableCell>
                        <Switch
                          checked={config.autoStart}
                          onCheckedChange={(v) => void setAutoStart(config.id, v)}
                          aria-label={`Auto-start ${config.fs}`}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        {!runningIds.has(config.id) && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Start ${config.fs}`}
                                onClick={() => {
                                  startServe(config)
                                    .then(() => toast.success(`Serving ${config.fs}`))
                                    .catch((err: Error) =>
                                      toast.error(`Start failed: ${err.message}`),
                                    );
                                }}
                              >
                                <Play />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Start</TooltipContent>
                          </Tooltip>
                        )}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Forget ${config.fs}`}
                              onClick={() => void removeSaved(config.id)}
                            >
                              <Trash2 className="text-destructive" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Forget</TooltipContent>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {active.length === 0 && saved.length === 0 && (
          <EmptyState
            icon={Share2}
            title="Nothing shared yet"
            hint="Start a share above — hand the URL to any device on your network."
          />
        )}
      </div>
      {/* tables */}
    </div>
  );
}

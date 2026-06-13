import { useEffect, useRef, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { ExternalLink, Maximize2, Minimize2, X } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { logActivity } from "@/store/activity";
import { openLocal } from "./watch-actions";

interface VideoPlayerProps {
  localPath: string;
  title: string;
  onClose: () => void;
}

export function VideoPlayer({ localPath, title, onClose }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [openingExternal, setOpeningExternal] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const src = convertFileSrc(localPath);

  useEffect(() => {
    logActivity("info", "media", `VideoPlayer opened: ${localPath} → ${src}`);
  }, [localPath, src]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === " " || e.key === "k") {
        e.preventDefault();
        const v = videoRef.current;
        if (v) {
          if (v.paused) void v.play();
          else v.pause();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Auto-play on mount
  useEffect(() => {
    videoRef.current?.play().catch(() => {
      // autoplay blocked — user will click play manually
    });
  }, []);

  const showControls = () => {
    setControlsVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setControlsVisible(false), 3000);
  };

  const handleOpenExternal = async () => {
    setOpeningExternal(true);
    try {
      await openLocal(localPath);
      logActivity("info", "media", `Opened externally: ${localPath}`);
      toast.success("Opened in external player");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logActivity("error", "media", `External player failed for ${localPath}: ${msg}`);
      toast.error(`Could not open: ${msg}`);
    } finally {
      setOpeningExternal(false);
    }
  };

  const toggleFullscreen = async () => {
    const el = document.getElementById("rg-video-container");
    if (!el) return;
    if (!document.fullscreenElement) {
      await el.requestFullscreen();
      setFullscreen(true);
    } else {
      await document.exitFullscreen();
      setFullscreen(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col" onMouseMove={showControls}>
      {/* Header bar */}
      <div
        className={cn(
          "absolute top-0 inset-x-0 z-10 flex items-center gap-3 px-4 py-3 bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-300",
          controlsVisible ? "opacity-100" : "opacity-0",
        )}
      >
        <span className="flex-1 text-white text-sm font-medium truncate">{title}</span>
        <button
          className="size-8 rounded-full bg-white/10 hover:bg-white/25 text-white flex items-center justify-center transition-colors disabled:opacity-50"
          onClick={() => void handleOpenExternal()}
          disabled={openingExternal}
          title="Open in external player (VLC)"
          aria-label="Open in external player"
        >
          <ExternalLink className="size-4" />
        </button>
        <button
          className="size-8 rounded-full bg-white/10 hover:bg-white/25 text-white flex items-center justify-center transition-colors"
          onClick={() => void toggleFullscreen()}
          aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
        >
          {fullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
        </button>
        <button
          className="size-8 rounded-full bg-white/10 hover:bg-white/25 text-white flex items-center justify-center transition-colors"
          onClick={onClose}
          aria-label="Close player"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Video */}
      <div id="rg-video-container" className="flex-1 flex items-center justify-center">
        {error ? (
          <div className="text-center text-white px-8">
            <p className="text-lg font-semibold mb-2">Can't play this file</p>
            <p className="text-sm text-white/60 mb-4">{error}</p>
            <button
              className="px-4 py-2 rounded-lg bg-white/15 hover:bg-white/25 text-white text-sm transition-colors disabled:opacity-50"
              onClick={() => void handleOpenExternal()}
              disabled={openingExternal}
            >
              {openingExternal ? "Opening…" : "Open in VLC / external player"}
            </button>
          </div>
        ) : (
          <video
            ref={videoRef}
            src={src}
            controls
            className="max-h-full max-w-full"
            style={{ outline: "none" }}
            onError={(e) => {
              const msg = (e.target as HTMLVideoElement).error?.message ?? "unknown error";
              logActivity("error", "media", `VideoPlayer error for ${localPath}: ${msg}`);
              setError("This format isn't supported by the built-in player.");
              void handleOpenExternal();
            }}
          />
        )}
      </div>
    </div>
  );
}

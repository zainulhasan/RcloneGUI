import { Archive, File, FileText, Film, Image, Music, type LucideIcon } from "lucide-react";

const VIDEO = new Set(["mkv", "mp4", "avi", "mov", "wmv", "m4v", "webm", "ts", "mpg", "mpeg"]);
const IMAGE = new Set(["jpg", "jpeg", "png", "gif", "webp", "heic", "svg", "raw", "tiff", "bmp"]);
const AUDIO = new Set(["mp3", "flac", "aac", "ogg", "wav", "m4a", "opus", "aiff"]);
const ARCHIVE = new Set(["zip", "tar", "gz", "bz2", "xz", "7z", "rar", "dmg", "iso"]);
const TEXT = new Set(["md", "txt", "pdf", "doc", "docx", "rtf", "csv", "json", "yaml", "yml"]);

export interface FileVisual {
  icon: LucideIcon;
  /** Tailwind text color class for the icon. */
  className: string;
}

/** Icon + tint for a file name, by extension. */
export function fileVisual(name: string): FileVisual {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (VIDEO.has(ext)) return { icon: Film, className: "text-chart-5" };
  if (IMAGE.has(ext)) return { icon: Image, className: "text-chart-2" };
  if (AUDIO.has(ext)) return { icon: Music, className: "text-chart-3" };
  if (ARCHIVE.has(ext)) return { icon: Archive, className: "text-warning" };
  if (TEXT.has(ext)) return { icon: FileText, className: "text-muted-foreground" };
  return { icon: File, className: "text-muted-foreground" };
}

import { cn } from "@/lib/utils";

const VIEW_W = 200;
const VIEW_H = 40;

/**
 * Dependency-free area sparkline. Stretches to its container
 * (`preserveAspectRatio="none"`), drawing right-aligned history.
 */
export function Sparkline({
  samples,
  capacity = 60,
  className,
}: {
  samples: number[];
  capacity?: number;
  className?: string;
}) {
  const max = Math.max(...samples, 1);
  const stepX = VIEW_W / Math.max(capacity - 1, 1);
  const points = samples.map((v, i) => {
    const x = VIEW_W - (samples.length - 1 - i) * stepX;
    const y = VIEW_H - (v / max) * (VIEW_H - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const line = points.join(" ");
  const area =
    points.length > 1
      ? `${points[0].split(",")[0]},${VIEW_H} ${line} ${points[points.length - 1].split(",")[0]},${VIEW_H}`
      : "";

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="Bandwidth history"
      className={cn("text-chart-1 h-full w-full", className)}
    >
      {area && <polygon points={area} fill="currentColor" opacity={0.12} />}
      {points.length > 1 && (
        <polyline
          points={line}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
      )}
    </svg>
  );
}

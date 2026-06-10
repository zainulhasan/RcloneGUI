/** Tiny dependency-free area sparkline for bandwidth history. */
export function Sparkline({
  samples,
  width = 280,
  height = 48,
  capacity = 60,
}: {
  samples: number[];
  width?: number;
  height?: number;
  capacity?: number;
}) {
  const max = Math.max(...samples, 1);
  const stepX = width / Math.max(capacity - 1, 1);
  const points = samples.map((v, i) => {
    const x = width - (samples.length - 1 - i) * stepX;
    const y = height - (v / max) * (height - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const line = points.join(" ");
  const area =
    points.length > 1
      ? `${points[0].split(",")[0]},${height} ${line} ${points[points.length - 1].split(",")[0]},${height}`
      : "";

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Bandwidth history"
      className="text-chart-1"
    >
      {area && <polygon points={area} fill="currentColor" opacity={0.15} />}
      {points.length > 1 && (
        <polyline points={line} fill="none" stroke="currentColor" strokeWidth={1.5} />
      )}
    </svg>
  );
}

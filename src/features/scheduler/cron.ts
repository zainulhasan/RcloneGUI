// Minimal 5-field cron matcher: minute hour day-of-month month day-of-week.
// Supports `*`, lists (`1,5`), ranges (`1-5`), and steps (`*/15`, `2-10/2`).
// Day-of-month and day-of-week combine with OR when both are restricted,
// matching standard cron semantics.

interface FieldSpec {
  min: number;
  max: number;
}

const FIELDS: FieldSpec[] = [
  { min: 0, max: 59 }, // minute
  { min: 0, max: 23 }, // hour
  { min: 1, max: 31 }, // day of month
  { min: 1, max: 12 }, // month
  { min: 0, max: 6 }, // day of week (0 = Sunday)
];

function parseField(field: string, spec: FieldSpec): Set<number> | null {
  const values = new Set<number>();
  for (const part of field.split(",")) {
    const [rangePart, stepPart, ...extra] = part.split("/");
    if (extra.length > 0 || rangePart === "") return null;

    let step = 1;
    if (stepPart !== undefined) {
      step = Number(stepPart);
      if (!Number.isInteger(step) || step < 1) return null;
    }

    let from: number;
    let to: number;
    if (rangePart === "*") {
      from = spec.min;
      to = spec.max;
    } else if (rangePart.includes("-")) {
      const [a, b] = rangePart.split("-").map(Number);
      if (!Number.isInteger(a) || !Number.isInteger(b) || a > b) return null;
      from = a;
      to = b;
    } else {
      const v = Number(rangePart);
      if (!Number.isInteger(v)) return null;
      from = v;
      to = v;
    }

    if (from < spec.min || to > spec.max) return null;
    for (let v = from; v <= to; v += step) values.add(v);
  }
  return values;
}

export interface ParsedCron {
  minute: Set<number>;
  hour: Set<number>;
  dayOfMonth: Set<number>;
  month: Set<number>;
  dayOfWeek: Set<number>;
  /** Whether dom/dow were written as "*" (affects OR semantics). */
  domIsWildcard: boolean;
  dowIsWildcard: boolean;
}

export function parseCron(expr: string): ParsedCron | null {
  const fields = expr.trim().split(/\s+/);
  if (fields.length !== 5) return null;
  const parsed = fields.map((f, i) => parseField(f, FIELDS[i]));
  if (parsed.some((p) => p === null)) return null;
  const [minute, hour, dayOfMonth, month, dayOfWeek] = parsed as Set<number>[];
  return {
    minute,
    hour,
    dayOfMonth,
    month,
    dayOfWeek,
    domIsWildcard: fields[2] === "*",
    dowIsWildcard: fields[4] === "*",
  };
}

/** Null when valid, otherwise a human-readable problem. */
export function validateCron(expr: string): string | null {
  if (!expr.trim()) return "Schedule is required.";
  if (expr.trim().split(/\s+/).length !== 5) {
    return "Use 5 fields: minute hour day month weekday.";
  }
  return parseCron(expr) ? null : "Invalid cron expression.";
}

/** Does `expr` match the given local time (to the minute)? */
export function cronMatches(expr: string, date: Date): boolean {
  const cron = parseCron(expr);
  if (!cron) return false;

  if (!cron.minute.has(date.getMinutes())) return false;
  if (!cron.hour.has(date.getHours())) return false;
  if (!cron.month.has(date.getMonth() + 1)) return false;

  const domMatch = cron.dayOfMonth.has(date.getDate());
  const dowMatch = cron.dayOfWeek.has(date.getDay());
  if (cron.domIsWildcard && cron.dowIsWildcard) return true;
  if (cron.domIsWildcard) return dowMatch;
  if (cron.dowIsWildcard) return domMatch;
  return domMatch || dowMatch;
}

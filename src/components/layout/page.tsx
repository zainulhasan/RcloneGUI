import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/** Standard view header: title, optional description, right-aligned actions. */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex flex-col gap-0.5">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-muted-foreground text-sm">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Standard empty placeholder for lists with no content yet. */
export function EmptyState({
  icon: Icon,
  title,
  hint,
  children,
  className,
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "text-muted-foreground bg-card/50 flex flex-col items-center gap-3 rounded-xl border border-dashed py-10",
        className,
      )}
    >
      <div className="bg-muted flex size-12 items-center justify-center rounded-xl">
        <Icon className="size-6" />
      </div>
      <div className="flex flex-col items-center gap-1">
        <p className="text-foreground text-sm font-medium">{title}</p>
        {hint && <p className="max-w-sm text-center text-xs">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

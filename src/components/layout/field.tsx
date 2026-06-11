import { CircleHelp } from "lucide-react";

import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Standard form field: label with an optional (?) tooltip explaining what
 * the option does, the control, and an optional one-line hint underneath.
 * Use this instead of ad-hoc Label+Input stacks so every option is
 * self-explaining.
 */
export function Field({
  label,
  htmlFor,
  help,
  hint,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  /** Tooltip text behind a (?) icon — what the option means and when to use it. */
  help?: string;
  /** Short always-visible line under the control. */
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <span className="flex items-center gap-1">
        <Label htmlFor={htmlFor}>{label}</Label>
        {help && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                tabIndex={-1}
                aria-label={`What is ${label}?`}
                className="text-muted-foreground/70 hover:text-foreground transition-colors"
              >
                <CircleHelp className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-72">{help}</TooltipContent>
          </Tooltip>
        )}
      </span>
      {children}
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
    </div>
  );
}

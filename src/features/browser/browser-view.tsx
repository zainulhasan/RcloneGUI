import { useState } from "react";
import { PanelRightClose, PanelRightOpen } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useRemotes } from "@/features/remotes/use-remotes";

import { Pane, type PaneProps } from "./pane";

export function BrowserView({
  renderItemActions,
  renderItemBadge,
  onDropItems,
}: Pick<PaneProps, "renderItemActions" | "renderItemBadge" | "onDropItems">) {
  const remotes = useRemotes();
  const names = Object.keys(remotes.data ?? {}).sort();
  const [rightVisible, setRightVisible] = useState(true);

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <PageHeader
        title="Browser"
        description="Dual panes — right-click a selection to copy, sync or move it to the other pane."
        actions={
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon-sm"
                aria-label={rightVisible ? "Collapse right pane" : "Expand right pane"}
                onClick={() => setRightVisible((v) => !v)}
              >
                {rightVisible ? <PanelRightClose /> : <PanelRightOpen />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {rightVisible ? "Collapse right pane" : "Expand right pane"}
            </TooltipContent>
          </Tooltip>
        }
      />
      <div className="flex min-h-0 flex-1 gap-4">
        <Pane
          index={0}
          remotes={names}
          renderItemActions={renderItemActions}
          renderItemBadge={renderItemBadge}
          onDropItems={onDropItems}
        />
        {rightVisible && (
          <Pane
            index={1}
            remotes={names}
            renderItemActions={renderItemActions}
            renderItemBadge={renderItemBadge}
            onDropItems={onDropItems}
          />
        )}
      </div>
    </div>
  );
}

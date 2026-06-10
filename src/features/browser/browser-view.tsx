import { useRemotes } from "@/features/remotes/use-remotes";

import { Pane, type PaneProps } from "./pane";

export function BrowserView({
  renderItemActions,
  renderItemBadge,
}: Pick<PaneProps, "renderItemActions" | "renderItemBadge">) {
  const remotes = useRemotes();
  const names = Object.keys(remotes.data ?? {}).sort();

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <h1 className="text-xl font-semibold">Browser</h1>
      <div className="flex min-h-0 flex-1 gap-4">
        <Pane
          index={0}
          remotes={names}
          renderItemActions={renderItemActions}
          renderItemBadge={renderItemBadge}
        />
        <Pane
          index={1}
          remotes={names}
          renderItemActions={renderItemActions}
          renderItemBadge={renderItemBadge}
        />
      </div>
    </div>
  );
}

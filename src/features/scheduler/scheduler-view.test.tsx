import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import { DEFAULT_SETTINGS, useSettingsStore } from "@/store/settings";
import { useScheduledJobsStore, newScheduledJob } from "@/store/scheduled-jobs";

import { SchedulerView } from "./scheduler-view";

function renderView() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <SchedulerView />
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

describe("SchedulerView background banner", () => {
  beforeEach(() => {
    useSettingsStore.setState({ settings: DEFAULT_SETTINGS, hydrated: true });
    useScheduledJobsStore.setState({ jobs: [], hydrated: true });
  });

  it("shows no banner when background mode is on (default)", () => {
    useScheduledJobsStore.setState({
      jobs: [{ ...newScheduledJob(), id: "1", name: "Nightly" }],
      hydrated: true,
    });
    renderView();
    expect(screen.queryByText(/only run while RcloneGUI is running/)).not.toBeInTheDocument();
  });

  it("shows the banner when jobs exist and background mode is off", () => {
    useSettingsStore.setState({
      settings: { ...DEFAULT_SETTINGS, runInBackground: false },
      hydrated: true,
    });
    useScheduledJobsStore.setState({
      jobs: [{ ...newScheduledJob(), id: "1", name: "Nightly" }],
      hydrated: true,
    });
    renderView();
    expect(screen.getByText(/only run while RcloneGUI is running/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enable" })).toBeInTheDocument();
  });

  it("shows no banner when there are no jobs", () => {
    useSettingsStore.setState({
      settings: { ...DEFAULT_SETTINGS, runInBackground: false },
      hydrated: true,
    });
    renderView();
    expect(screen.queryByText(/only run while RcloneGUI is running/)).not.toBeInTheDocument();
  });
});

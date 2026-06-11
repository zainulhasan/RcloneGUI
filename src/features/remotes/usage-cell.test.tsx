import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import * as rcClient from "@/lib/rc-client";

import { UsageCell } from "./usage-cell";

function renderCell(name = "gdrive") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <UsageCell name={name} />
    </QueryClientProvider>,
  );
}

describe("UsageCell", () => {
  afterEach(() => vi.restoreAllMocks());

  it("shows used/total with a bar when both are known", async () => {
    vi.spyOn(rcClient.rc, "about").mockResolvedValue({
      used: 50 * 1024 ** 3,
      total: 100 * 1024 ** 3,
    });
    renderCell();
    expect(await screen.findByText("50.0 GiB / 100 GiB")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("shows used only when total is missing", async () => {
    vi.spyOn(rcClient.rc, "about").mockResolvedValue({ used: 5 * 1024 ** 3 });
    renderCell();
    expect(await screen.findByText("5.0 GiB used")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("shows a dash when about is unsupported", async () => {
    vi.spyOn(rcClient.rc, "about").mockRejectedValue(new Error("not supported"));
    renderCell();
    expect(await screen.findByText("—")).toBeInTheDocument();
  });
});

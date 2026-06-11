import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import App from "./App";

describe("App", () => {
  it("boots through the daemon gate to the dashboard", async () => {
    render(<App />);
    expect(await screen.findByText("RcloneGUI")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
  });

  it("navigates between views from the sidebar", async () => {
    render(<App />);
    await screen.findByText("RcloneGUI");
    await userEvent.click(screen.getByRole("button", { name: "Remotes" }));
    expect(await screen.findByRole("heading", { name: "Remotes" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(await screen.findByRole("heading", { name: "Settings" })).toBeInTheDocument();
  });
});

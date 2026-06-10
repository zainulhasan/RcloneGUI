import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import App from "./App";

describe("App", () => {
  it("renders the sidebar brand and dashboard view", () => {
    render(<App />);
    expect(screen.getByText("RcloneGUI")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
  });

  it("navigates between views from the sidebar", async () => {
    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: /Remotes/ }));
    expect(screen.getByRole("heading", { name: "Remotes" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Settings/ }));
    expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();
  });
});

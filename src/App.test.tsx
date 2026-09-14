import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

beforeEach(() => window.history.replaceState({}, "", "/"));
afterEach(() => vi.unstubAllGlobals());

describe("App", () => {
  it("renders bundled text when the network is entirely unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));

    render(<App />);

    // From src/offline/trs-demo-app.en-US.json, not from the network.
    expect(await screen.findByText("Hii Retail corner shop")).toBeInTheDocument();
    expect(screen.queryByText("app.title")).not.toBeInTheDocument();
  });

  it("reads the tenant address once a tenant id is entered", async () => {
    const fetchSpy = vi.fn().mockRejectedValue(new TypeError("offline"));
    vi.stubGlobal("fetch", fetchSpy);

    render(<App />);
    await screen.findByText("Hii Retail corner shop");

    await userEvent.type(screen.getByLabelText("Tenant id"), "acme");
    await userEvent.click(screen.getByRole("button", { name: "Tenant id" }));

    await waitFor(() => {
      const urls = fetchSpy.mock.calls.map((call) => String(call[0]));
      expect(urls.some((url) => url.includes("/tenants/acme/modules/trs-demo-app/"))).toBe(
        true,
      );
    });
    expect(window.location.search).toBe("?tenant=acme");
  });
});

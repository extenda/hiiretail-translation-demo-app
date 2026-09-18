import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

beforeEach(() => window.history.replaceState({}, "", "/"));
afterEach(() => window.history.replaceState({}, "", "/"));
afterEach(() => vi.unstubAllGlobals());

describe("App", () => {
  it("renders bundled text when the network is entirely unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));

    render(<App />);

    // From src/offline/trs-demo-app.en-US.json, not from the network.
    expect(await screen.findByText("Hii Retail corner shop")).toBeInTheDocument();
    expect(screen.queryByText("app.title")).not.toBeInTheDocument();

    // The bundle is the service's own output, where a literal apostrophe is ICU-escaped
    // as ''. It has to come back out as one apostrophe, or the offline copy reads wrong
    // in a way the network copy does not.
    expect(
      screen.getByText("Enter a tenant id to read that tenant's overrides. No sign-in needed."),
    ).toBeInTheDocument();
  });

  it("renders what the service returns, not the bundled copy underneath it", async () => {
    // The read endpoint answers an envelope — {module, langTag, layer, format, entries}
    // — and the flat key map is one field inside it. Parse the envelope as the bundle and
    // every key misses, falls back to the committed copy, and the page looks correct
    // while showing nothing the service said.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) =>
        String(url).includes("/translations/")
          ? Promise.resolve(
              new Response(
                JSON.stringify({
                  module: "trs-demo-app",
                  langTag: "en-US",
                  layer: "resolved",
                  format: "icu",
                  entries: { "app.title": "Published from the service" },
                }),
                { status: 200, headers: { "Content-Type": "application/json" } },
              ),
            )
          : Promise.reject(new TypeError("offline")),
      ),
    );

    render(<App />);

    expect(await screen.findByText("Published from the service")).toBeInTheDocument();
  });

  it("reads the bundled language from the service rather than trusting the bundle", async () => {
    const fetchSpy = vi.fn().mockRejectedValue(new TypeError("offline"));
    vi.stubGlobal("fetch", fetchSpy);

    render(<App />);
    await screen.findByText("Hii Retail corner shop");

    // en-US is in `resources`, and the backend connector skips any language already in
    // the store. Without an explicit reload the app renders its committed bundle forever
    // and never reads the service at all — which is the one thing it exists to show.
    await waitFor(() => {
      const urls = fetchSpy.mock.calls.map((call) => String(call[0]));
      expect(urls).toContain(
        "https://translation.retailsvc.com/api/v1/modules/trs-demo-app/translations/en-US",
      );
    });
  });

  it("never requests a bare language subtag", async () => {
    const fetchSpy = vi.fn().mockRejectedValue(new TypeError("offline"));
    vi.stubGlobal("fetch", fetchSpy);

    render(<App />);
    await screen.findByText("Hii Retail corner shop");

    // The service answers 400 for anything short of a full RFC 5646 tag, so a request
    // ending in /en is a failed round trip on every load, not a harmless extra.
    const urls = fetchSpy.mock.calls.map((call) => String(call[0]));
    expect(urls.filter((url) => /\/translations\/[a-z]{2}$/.test(url))).toEqual([]);
  });

  it("serves the publishing page from the hash, leaving the query string to the tenant", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    window.history.replaceState({}, "", "/?tenant=acme#/admin");

    render(<App />);

    expect(await screen.findByText("Publish a translation")).toBeInTheDocument();
    // A hash route means server/index.mjs still sees a request for "/" — no SPA fallback.
    expect(window.location.pathname).toBe("/");
    expect(window.location.search).toBe("?tenant=acme");
  });

  it("shows a tenant's own language, which the published list never mentions", async () => {
    // Verified against production: a tenant-layer publish of sv-SE reads back at the
    // tenant address, while /language-tags still answers ["en-US"] because it covers the
    // default and managed layers alone. Without the url naming the language, the selector
    // could never reach what was just published.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        const target = String(url);
        if (target.includes("/language-tags")) {
          return Promise.resolve(
            new Response(JSON.stringify({ moduleId: "trs-demo-app", languageTags: ["en-US"] })),
          );
        }
        if (target.includes("/tenants/acme/") && target.endsWith("/sv-SE")) {
          return Promise.resolve(
            new Response(JSON.stringify({ entries: { "app.title": "Demobutiken" } })),
          );
        }
        return Promise.reject(new TypeError("offline"));
      }),
    );
    window.history.replaceState({}, "", "/?tenant=acme&lang=sv-SE");

    render(<App />);

    expect(await screen.findByText("Demobutiken")).toBeInTheDocument();
    expect(screen.getByLabelText("Language")).toHaveValue("sv-SE");
    expect(
      screen.getByText(/is not in this module's published list/),
    ).toBeInTheDocument();
  });

  it("reads the fallback from the tenant too, and asks for the target language once", async () => {
    const fetchSpy = vi.fn().mockRejectedValue(new TypeError("offline"));
    vi.stubGlobal("fetch", fetchSpy);
    window.history.replaceState({}, "", "/?tenant=acme&lang=ro-RO");

    render(<App />);
    await screen.findByText("Hii Retail corner shop");

    const translations = fetchSpy.mock.calls
      .map((call) => String(call[0]))
      .filter((url) => url.includes("/translations/"));

    // en-US is the fallbackLng filling every key the target language omits, and on a
    // tenant address that is the tenant's own English — not the copy committed here.
    // It ships bundled, so the connector thinks it has it and only an explicit reload
    // fetches it.
    expect(translations).toContain(
      "https://translation.retailsvc.com/api/v1/tenants/acme/modules/trs-demo-app/translations/en-US",
    );
    // Reloading the target language too would ask for the same file twice: it is absent
    // from the store, so preload already fetched it.
    expect(translations.filter((url) => url.endsWith("/ro-RO"))).toHaveLength(1);
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

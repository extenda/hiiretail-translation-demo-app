import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

beforeEach(() => window.history.replaceState({}, "", "/"));
afterEach(() => window.history.replaceState({}, "", "/"));
afterEach(() => vi.unstubAllGlobals());

/*
 * A service that answers the two language lists separately, so a test can say what the
 * module published and what the tenant added without restating the whole fetch shape.
 */
function tenantFetch({ tenantTags }: { tenantTags: string[] }) {
  return vi.fn().mockImplementation((url: string) => {
    const target = String(url);
    if (target.includes("/language-tags")) {
      const languageTags = target.includes("/tenants/") ? tenantTags : ["en-US"];
      return Promise.resolve(
        new Response(JSON.stringify({ moduleId: "trs-demo-app", languageTags })),
      );
    }
    if (target.includes("/tenants/acme/") && target.endsWith("/sv-SE")) {
      return Promise.resolve(
        new Response(JSON.stringify({ entries: { "app.title": "Demobutiken" } })),
      );
    }
    return Promise.reject(new TypeError("offline"));
  });
}

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

  it("offers a tenant's own language in the selector, not just in the url", async () => {
    // The module-wide list answers ["en-US"] — it covers the default and managed layers
    // alone — so a picker built from it can never reach what this tenant published for
    // itself. The tenant-scoped list is what puts sv-SE in the selector.
    vi.stubGlobal("fetch", tenantFetch({ tenantTags: ["en-US", "sv-SE"] }));
    window.history.replaceState({}, "", "/?tenant=acme&lang=sv-SE");

    render(<App />);

    expect(await screen.findByText("Demobutiken")).toBeInTheDocument();
    expect(screen.getByLabelText("Language")).toHaveValue("sv-SE");
    await waitFor(() =>
      expect(
        screen.queryByText(/is not in this module's published list/),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("option", { name: "sv-SE" })).toBeInTheDocument();
  });

  it("asks the tenant-scoped list, not the module-wide one, once a tenant is in scope", async () => {
    const fetchSpy = tenantFetch({ tenantTags: ["en-US", "sv-SE"] });
    vi.stubGlobal("fetch", fetchSpy);
    window.history.replaceState({}, "", "/?tenant=acme");

    render(<App />);
    await screen.findByText("Hii Retail corner shop");

    await waitFor(() => {
      const urls = fetchSpy.mock.calls.map((call) => String(call[0]));
      expect(urls).toContain(
        "https://translation.retailsvc.com/api/v1/tenants/acme/modules/trs-demo-app/language-tags",
      );
    });
  });

  // loadPath is rebuilt when the tenant changes; the language list has to follow, or the
  // selector keeps offering the previous tenant's languages.
  it("refetches the language list when the tenant changes", async () => {
    const fetchSpy = tenantFetch({ tenantTags: ["en-US", "sv-SE"] });
    vi.stubGlobal("fetch", fetchSpy);

    render(<App />);
    await screen.findByText("Hii Retail corner shop");

    await userEvent.type(screen.getByLabelText("Tenant id"), "acme");
    await userEvent.click(screen.getByRole("button", { name: "Tenant id" }));

    await waitFor(() =>
      expect(screen.getByRole("option", { name: "sv-SE" })).toBeInTheDocument(),
    );
  });

  it("still flags a language no list mentions, reachable only because the url names it", async () => {
    vi.stubGlobal("fetch", tenantFetch({ tenantTags: ["en-US"] }));
    window.history.replaceState({}, "", "/?tenant=acme&lang=sv-SE");

    render(<App />);

    expect(await screen.findByText("Demobutiken")).toBeInTheDocument();
    expect(
      screen.getByText(/is not in this module's published list/),
    ).toBeInTheDocument();
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

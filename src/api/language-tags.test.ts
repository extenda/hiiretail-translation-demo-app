import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchLanguageTags } from "./language-tags";

afterEach(() => vi.unstubAllGlobals());

function stubFetch(response: Response) {
  const spy = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", spy);
  return spy;
}

describe("fetchLanguageTags", () => {
  it("asks the module's language-tags address", async () => {
    const spy = stubFetch(
      new Response(JSON.stringify({ moduleId: "trs-demo-app", languageTags: ["en-US"] })),
    );
    await fetchLanguageTags();
    expect(spy.mock.calls[0][0]).toBe(
      "https://translation.retailsvc.com/api/v1/modules/trs-demo-app/language-tags",
    );
  });

  it("returns the published tags", async () => {
    stubFetch(
      new Response(
        JSON.stringify({ moduleId: "trs-demo-app", languageTags: ["en-US", "sv-SE"] }),
      ),
    );
    await expect(fetchLanguageTags()).resolves.toEqual(["en-US", "sv-SE"]);
  });

  it("treats 404 as nothing published yet rather than an error", async () => {
    stubFetch(new Response("", { status: 404 }));
    await expect(fetchLanguageTags()).resolves.toEqual(["en-US"]);
  });

  it("raises on any other failure so the UI can say so", async () => {
    stubFetch(new Response("", { status: 500 }));
    await expect(fetchLanguageTags()).rejects.toThrow(/500/);
  });

  // The module-wide list covers the default and managed layers alone, so a picker built
  // from it is missing precisely the languages this tenant published for itself.
  it("asks the tenant-scoped address once a tenant is in scope", async () => {
    const spy = stubFetch(
      new Response(JSON.stringify({ moduleId: "trs-demo-app", languageTags: ["en-US"] })),
    );
    await fetchLanguageTags("CIR7nQwtS0rA6t0S6ejd");
    expect(spy.mock.calls[0][0]).toBe(
      "https://translation.retailsvc.com/api/v1/tenants/CIR7nQwtS0rA6t0S6ejd/modules/trs-demo-app/language-tags",
    );
  });

  it("escapes a tenant id rather than pasting it into the path", async () => {
    const spy = stubFetch(
      new Response(JSON.stringify({ moduleId: "trs-demo-app", languageTags: ["en-US"] })),
    );
    await fetchLanguageTags("a/b");
    expect(spy.mock.calls[0][0]).toContain("/tenants/a%2Fb/modules/");
  });

  it("returns the tenant's own languages alongside the published ones", async () => {
    stubFetch(
      new Response(
        JSON.stringify({
          moduleId: "trs-demo-app",
          languageTags: ["en-US", "ro-RO", "sv-SE"],
        }),
      ),
    );
    await expect(fetchLanguageTags("CIR7nQwtS0rA6t0S6ejd")).resolves.toEqual([
      "en-US",
      "ro-RO",
      "sv-SE",
    ]);
  });

  it("falls back to the module-wide address when no tenant is set", async () => {
    const spy = stubFetch(
      new Response(JSON.stringify({ moduleId: "trs-demo-app", languageTags: ["en-US"] })),
    );
    await fetchLanguageTags(undefined);
    expect(spy.mock.calls[0][0]).not.toContain("/tenants/");
  });
});

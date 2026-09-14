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
});

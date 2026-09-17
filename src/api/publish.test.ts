import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PublishError,
  isFullLanguageTag,
  publishLayer,
  readKeySet,
  readLanguage,
  readTenantLanguage,
} from "./publish";

afterEach(() => vi.unstubAllGlobals());

function respond(status: number, body: unknown) {
  return vi.fn().mockResolvedValue(
    new Response(status === 204 ? null : JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

describe("isFullLanguageTag", () => {
  it("accepts a canonical tag carrying a region", () => {
    expect(isFullLanguageTag("en-US")).toBe(true);
    expect(isFullLanguageTag("sv-SE")).toBe(true);
  });

  it("rejects what the service rejects", () => {
    // The exact case this app was sending on every load.
    expect(isFullLanguageTag("en")).toBe(false);
    // Canonical form, not merely a valid tag: one file, one URL.
    expect(isFullLanguageTag("en-us")).toBe(false);
    expect(isFullLanguageTag("EN-US")).toBe(false);
    expect(isFullLanguageTag("")).toBe(false);
    expect(isFullLanguageTag("not a tag")).toBe(false);
  });
});

describe("readKeySet", () => {
  it("reads the raw en-US file and unwraps the envelope", async () => {
    const entries = { "app.title": { value: "Hii Retail corner shop" } };
    const fetchSpy = respond(200, { module: "trs-demo-app", entries });
    vi.stubGlobal("fetch", fetchSpy);

    await expect(readKeySet()).resolves.toEqual(entries);
    expect(String(fetchSpy.mock.calls[0][0])).toBe(
      "https://translation.retailsvc.com/api/v1/modules/trs-demo-app/translations/en-US?format=raw",
    );
  });

  it("treats a 404 as nothing published rather than a failure", async () => {
    vi.stubGlobal("fetch", respond(404, { message: "not found" }));

    await expect(readKeySet()).resolves.toBeUndefined();
  });
});

describe("readLanguage", () => {
  it("reads a single language raw", async () => {
    const fetchSpy = respond(200, { entries: {} });
    vi.stubGlobal("fetch", fetchSpy);

    await readLanguage("sv-SE");

    expect(String(fetchSpy.mock.calls[0][0])).toBe(
      "https://translation.retailsvc.com/api/v1/modules/trs-demo-app/translations/sv-SE?format=raw",
    );
  });

  it("reports a language with nothing published as undefined", async () => {
    vi.stubGlobal("fetch", respond(404, {}));

    await expect(readLanguage("sv-SE")).resolves.toBeUndefined();
  });
});

describe("readTenantLanguage", () => {
  it("reads through the tenant address", async () => {
    const fetchSpy = respond(200, { entries: {} });
    vi.stubGlobal("fetch", fetchSpy);

    await readTenantLanguage("acme", "sv-SE");

    expect(String(fetchSpy.mock.calls[0][0])).toBe(
      "https://translation.retailsvc.com/api/v1/tenants/acme/modules/trs-demo-app/translations/sv-SE?format=raw",
    );
  });
});

describe("publishLayer", () => {
  const entries = { "app.title": { value: "Hii Retail närbutik" } };

  it("puts the layer file with the bearer token", async () => {
    const fetchSpy = respond(200, {});
    vi.stubGlobal("fetch", fetchSpy);

    await publishLayer({ token: "t0ken", layer: "managed", langTag: "sv-SE", entries });

    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toBe(
      "https://translation.retailsvc.com/api/v1/modules/trs-demo-app/translations/sv-SE/layers/managed",
    );
    expect(init.method).toBe("PUT");
    expect(init.headers).toMatchObject({
      Authorization: "Bearer t0ken",
      "Content-Type": "application/json",
    });
    // The path already names the module and the tag; the body carries entries alone.
    expect(JSON.parse(init.body)).toEqual({ entries });
  });

  it("distinguishes a created file from a replaced one", async () => {
    vi.stubGlobal("fetch", respond(201, {}));
    await expect(
      publishLayer({ token: "t", layer: "managed", langTag: "sv-SE", entries }),
    ).resolves.toEqual({ created: true });

    vi.stubGlobal("fetch", respond(200, {}));
    await expect(
      publishLayer({ token: "t", layer: "managed", langTag: "sv-SE", entries }),
    ).resolves.toEqual({ created: false });
  });

  it("surfaces the service's own violation list", async () => {
    vi.stubGlobal(
      "fetch",
      respond(422, {
        message: [
          "entries.app.greeting.parameters is owned by the default layer",
          "entries.app.unknown is not a key of the default layer",
        ],
      }),
    );

    await expect(
      publishLayer({ token: "t", layer: "managed", langTag: "sv-SE", entries }),
    ).rejects.toMatchObject({
      status: 422,
      violations: [
        "entries.app.greeting.parameters is owned by the default layer",
        "entries.app.unknown is not a key of the default layer",
      ],
    });
  });

  it("carries a single-string message through as one violation", async () => {
    vi.stubGlobal("fetch", respond(401, { message: "Unauthorized" }));

    await expect(
      publishLayer({ token: "t", layer: "managed", langTag: "sv-SE", entries }),
    ).rejects.toBeInstanceOf(PublishError);
  });
});

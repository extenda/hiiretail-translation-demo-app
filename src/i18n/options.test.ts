import { describe, expect, it } from "vitest";
import { buildInitOptions } from "./options";
import bundledEnUS from "../offline/trs-demo-app.en-US.json";

describe("buildInitOptions", () => {
  it("uses the requested language and falls back to en-US", () => {
    const options = buildInitOptions(undefined, "sv-SE");
    expect(options.lng).toBe("sv-SE");
    expect(options.fallbackLng).toBe("en-US");
  });

  it("preloads the target language and en-US together, without duplicates", () => {
    expect(buildInitOptions(undefined, "sv-SE").preload).toEqual(["sv-SE", "en-US"]);
    expect(buildInitOptions(undefined, "en-US").preload).toEqual(["en-US"]);
  });

  it("resolves the current tag only, so no bare subtag is ever requested", () => {
    // i18next's `load` defaults to "all", which resolves "en-US" to ["en-US", "en"] and
    // makes the backend fetch both. The service serves full RFC 5646 tags only, so the
    // bare one is a 400 on every single load.
    expect(buildInitOptions(undefined, "en-US").load).toBe("currentOnly");
  });

  it("re-renders when a bundle lands after the first paint", () => {
    // The bundled copy paints first and the network read arrives afterwards; on
    // react-i18next's default bindings that second copy is stored but never shown.
    expect(buildInitOptions(undefined, "en-US").react?.bindI18nStore).toBe("added");
  });

  it("disables key and namespace separators because keys are flat", () => {
    const options = buildInitOptions(undefined, "en-US");
    expect(options.keySeparator).toBe(false);
    expect(options.nsSeparator).toBe(false);
  });

  it("leaves escaping to React", () => {
    expect(buildInitOptions(undefined, "en-US").interpolation?.escapeValue).toBe(false);
  });

  it("points the backend at the tenant address when a tenant is given", () => {
    expect(buildInitOptions("acme", "en-US").backend.loadPath).toBe(
      "https://translation.retailsvc.com/api/v1/tenants/acme/modules/trs-demo-app/translations/{{lng}}",
    );
  });

  it("takes the key map out of the response envelope", () => {
    const { parse } = buildInitOptions(undefined, "en-US").backend;
    const body = JSON.stringify({
      module: "trs-demo-app",
      langTag: "en-US",
      layer: "resolved",
      entries: { "app.title": "Hii Retail corner shop" },
    });

    expect(parse(body)).toEqual({ "app.title": "Hii Retail corner shop" });
  });

  it("seeds the bundled copy but still lets the backend fetch on top of it", () => {
    const options = buildInitOptions(undefined, "en-US");
    expect(options.partialBundledLanguages).toBe(true);
    expect(options.resources).toEqual({ "en-US": { translation: bundledEnUS } });
  });
});

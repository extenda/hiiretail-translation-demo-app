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

  it("disables key and namespace separators because keys are flat", () => {
    const options = buildInitOptions(undefined, "en-US");
    expect(options.keySeparator).toBe(false);
    expect(options.nsSeparator).toBe(false);
  });

  it("leaves escaping to React", () => {
    expect(buildInitOptions(undefined, "en-US").interpolation?.escapeValue).toBe(false);
  });

  it("points the backend at the tenant address when a tenant is given", () => {
    const options = buildInitOptions("acme", "en-US");
    expect(options.backend).toEqual({
      loadPath:
        "https://translation.retailsvc.com/api/v1/tenants/acme/modules/trs-demo-app/translations/{{lng}}",
    });
  });

  it("seeds the bundled copy but still lets the backend fetch on top of it", () => {
    const options = buildInitOptions(undefined, "en-US");
    expect(options.partialBundledLanguages).toBe(true);
    expect(options.resources).toEqual({ "en-US": { translation: bundledEnUS } });
  });
});

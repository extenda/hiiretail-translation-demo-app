import { describe, expect, it } from "vitest";
import type { TranslationEntries } from "../api/publish";
import {
  draftFrom,
  entriesToPublish,
  fileViolations,
  incompletePlurals,
  langTagFromFileName,
  tenantOverrides,
} from "./draft";

const keySet: TranslationEntries = {
  "app.title": { value: "Hii Retail corner shop", description: "The heading" },
  "app.greeting": { value: "Hello, {name}", parameters: ["name"] },
  "cart.count": {
    value: "{count} items",
    parameters: ["count"],
    plural: { parameter: "count", forms: { one: "{count} item", other: "{count} items" } },
  },
};

describe("draftFrom", () => {
  it("opens empty for a language with nothing published", () => {
    expect(draftFrom(keySet)).toEqual({
      "app.title": { value: "", forms: {} },
      "app.greeting": { value: "", forms: {} },
      "cart.count": { value: "", forms: {} },
    });
  });

  it("opens on what the language already has, so a replace keeps it", () => {
    const published: TranslationEntries = {
      "app.title": { value: "Hii Retail närbutik" },
      "cart.count": {
        value: "{count} varor",
        plural: { forms: { one: "{count} vara", other: "{count} varor" } },
      },
    };

    expect(draftFrom(keySet, published)).toEqual({
      "app.title": { value: "Hii Retail närbutik", forms: {} },
      "app.greeting": { value: "", forms: {} },
      "cart.count": {
        value: "{count} varor",
        forms: { one: "{count} vara", other: "{count} varor" },
      },
    });
  });
});

describe("entriesToPublish", () => {
  it("leaves an untranslated key out rather than publishing an empty string", () => {
    const draft = draftFrom(keySet);
    draft["app.title"].value = "Hii Retail närbutik";

    expect(entriesToPublish(draft, keySet, "sv-SE")).toEqual({
      "app.title": { value: "Hii Retail närbutik" },
    });
  });

  it("never sends the fields the default layer owns", () => {
    const draft = draftFrom(keySet);
    draft["app.greeting"].value = "Hej, {name}";

    const entries = entriesToPublish(draft, keySet, "sv-SE");

    // 422: "entries.app.greeting.parameters is owned by the default layer".
    expect(entries["app.greeting"]).toEqual({ value: "Hej, {name}" });
  });

  it("sends a plural as forms plus the other form as its value", () => {
    const draft = draftFrom(keySet);
    draft["cart.count"].forms = { one: "{count} vara", other: "{count} varor" };

    expect(entriesToPublish(draft, keySet, "sv-SE")).toEqual({
      "cart.count": {
        // The service requires a non-empty value on every entry; the seed files use the
        // other form for it, and plural.parameter is owned by the default layer.
        value: "{count} varor",
        plural: { forms: { one: "{count} vara", other: "{count} varor" } },
      },
    });
  });

  it("omits a half-filled plural instead of sending a rejected one", () => {
    const draft = draftFrom(keySet);
    draft["cart.count"].forms = { one: "{count} vara" };

    expect(entriesToPublish(draft, keySet, "sv-SE")).toEqual({});
  });

  it("asks for every category the target language needs, not Swedish's two", () => {
    const draft = draftFrom(keySet);
    draft["cart.count"].forms = { one: "{count} produkt", other: "{count} produktów" };

    // Polish also needs few and many, so this is not publishable there.
    expect(entriesToPublish(draft, keySet, "pl-PL")).toEqual({});
    expect(incompletePlurals(draft, keySet, "pl-PL")).toEqual(["cart.count"]);
  });
});

describe("tenantOverrides", () => {
  const base: TranslationEntries = {
    "app.title": { value: "Hii Retail närbutik" },
    "app.greeting": { value: "Hej, {name}" },
  };

  it("keeps only what the tenant changed", () => {
    const resolved: TranslationEntries = {
      "app.title": { value: "Acme-butiken" },
      "app.greeting": { value: "Hej, {name}" },
    };

    expect(tenantOverrides(base, resolved)).toEqual({
      "app.title": { value: "Acme-butiken" },
    });
  });

  it("notices a changed plural form even when the value matches", () => {
    const withPlural: TranslationEntries = {
      "cart.count": { value: "{count} varor", plural: { forms: { one: "{count} vara", other: "{count} varor" } } },
    };
    const resolved: TranslationEntries = {
      "cart.count": { value: "{count} varor", plural: { forms: { one: "{count} artikel", other: "{count} varor" } } },
    };

    expect(Object.keys(tenantOverrides(withPlural, resolved))).toEqual(["cart.count"]);
  });

  it("is empty when the tenant has published nothing", () => {
    expect(tenantOverrides(base, undefined)).toEqual({});
  });
});

describe("incompletePlurals", () => {
  it("says nothing about an untouched plural", () => {
    expect(incompletePlurals(draftFrom(keySet), keySet, "sv-SE")).toEqual([]);
  });

  it("names a plural with one form filled and one empty", () => {
    const draft = draftFrom(keySet);
    draft["cart.count"].forms = { other: "{count} varor" };

    expect(incompletePlurals(draft, keySet, "sv-SE")).toEqual(["cart.count"]);
  });

  it("says nothing once every form is filled", () => {
    const draft = draftFrom(keySet);
    draft["cart.count"].forms = { one: "{count} vara", other: "{count} varor" };

    expect(incompletePlurals(draft, keySet, "sv-SE")).toEqual([]);
  });
});

describe("langTagFromFileName", () => {
  it("takes the tag from a seed file's name", () => {
    expect(langTagFromFileName("ro-RO.json")).toBe("ro-RO");
    expect(langTagFromFileName("sv-SE.json")).toBe("sv-SE");
  });

  it("ignores a name that is not a full tag", () => {
    expect(langTagFromFileName("translations.json")).toBeUndefined();
    expect(langTagFromFileName("en.json")).toBeUndefined();
  });
});

describe("fileViolations", () => {
  it("passes a file the service would accept", () => {
    expect(fileViolations({ "app.title": { value: "Hii-Retail magazin" } }, keySet)).toEqual([]);
  });

  it("names a key the module never declared", () => {
    expect(fileViolations({ "app.unknown": { value: "x" } }, keySet)).toEqual([
      "app.unknown is not a key of the default layer",
    ]);
  });

  it("names the fields the default layer owns", () => {
    // Exactly what made the seed files unpublishable before they were corrected.
    const violations = fileViolations(
      {
        "app.greeting": { value: "Salut, {name}", parameters: ["name"] },
        "cart.count": {
          value: "{count} produse",
          plural: { parameter: "count", forms: { other: "{count} produse" } },
        },
      },
      keySet,
    );

    expect(violations).toEqual([
      "app.greeting.parameters is owned by the default layer",
      "cart.count.plural.parameter is owned by the default layer",
    ]);
  });
});

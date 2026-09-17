import { expect, it } from "vitest";
import { readFileSync } from "node:fs";

const published = JSON.parse(readFileSync("translations/en-US.json", "utf8"));
const bundled = JSON.parse(readFileSync("src/offline/trs-demo-app.en-US.json", "utf8"));

it("bundles exactly the keys the module publishes", () => {
  expect(Object.keys(bundled).sort()).toEqual(Object.keys(published).sort());
});

it("every published key carries a description for the translator", () => {
  for (const [key, entry] of Object.entries(published)) {
    expect(entry.description, `${key} has no description`).toBeTruthy();
  }
});

it("a plural key declares the parameter it counts", () => {
  expect(published["cart.count"].plural.parameter).toBe("count");
  expect(published["cart.count"].parameters).toContain("count");
});

it("the seeded languages cover the same keys as the default layer", () => {
  for (const tag of ["sv-SE", "fi-FI"]) {
    const seed = JSON.parse(readFileSync(`seed/managed/${tag}.json`, "utf8"));
    expect(Object.keys(seed).sort(), `${tag} drifted from the key set`).toEqual(
      Object.keys(published).sort(),
    );
  }
});

it("a seeded translation carries no field the default layer owns", () => {
  // The service answers 422 for description, parameters or plural.parameter outside the
  // default layer: a translation restates the copy, never the contract behind it.
  const seeds = [
    "seed/managed/sv-SE.json",
    "seed/managed/fi-FI.json",
    "seed/tenant/demo-tenant/sv-SE.json",
  ];

  for (const path of seeds) {
    for (const [key, entry] of Object.entries(JSON.parse(readFileSync(path, "utf8")))) {
      expect(entry.description, `${path} ${key} carries a description`).toBeUndefined();
      expect(entry.parameters, `${path} ${key} carries parameters`).toBeUndefined();
      expect(
        entry.plural?.parameter,
        `${path} ${key} carries plural.parameter`,
      ).toBeUndefined();
    }
  }
});

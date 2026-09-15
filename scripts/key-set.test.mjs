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

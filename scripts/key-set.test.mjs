import { expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";

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

// Every seed file there is, found rather than listed, so a new language is covered the
// moment someone adds one.
const seeds = readdirSync("seed", { recursive: true })
  .map(String)
  .filter((entry) => entry.endsWith(".json"))
  .map((entry) => `seed/${entry}`);

it("a seeded translation carries no field the default layer owns", () => {
  // The service answers 422 for description, parameters or plural.parameter outside the
  // default layer: a translation restates the copy, never the contract behind it.
  expect(seeds.length).toBeGreaterThan(0);

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

it("a seeded plural carries every form its language requires", () => {
  // Swedish needs one and other; Romanian needs one, few and other. A file written to
  // Swedish's shape publishes for Swedish and is a 422 for Romanian, and the message
  // arrives only after the round trip.
  const ORDER = ["zero", "one", "two", "few", "many", "other"];

  for (const path of seeds) {
    const langTag = path.split("/").pop().replace(".json", "");
    const required = ORDER.filter((category) =>
      new Intl.PluralRules(langTag).resolvedOptions().pluralCategories.includes(category),
    );

    for (const [key, entry] of Object.entries(JSON.parse(readFileSync(path, "utf8")))) {
      if (!entry.plural) continue;

      expect(
        Object.keys(entry.plural.forms).sort(),
        `${path} ${key} does not match ${langTag}'s plural categories`,
      ).toEqual([...required].sort());
    }
  }
});

import { describe, expect, it } from "vitest";
import { categoriesOf } from "./plural-categories";

describe("categoriesOf", () => {
  it("gives Swedish the two forms it uses", () => {
    expect(categoriesOf("sv-SE")).toEqual(["one", "other"]);
  });

  it("gives a language with more categories all of them, in the service's order", () => {
    // Polish needs few and many; publishing sv-SE's two forms for it is a 422.
    expect(categoriesOf("pl-PL")).toEqual(["one", "few", "many", "other"]);
  });

  it("gives Japanese its single form", () => {
    expect(categoriesOf("ja-JP")).toEqual(["other"]);
  });

  it("is empty for a tag with no plural rules, rather than throwing", () => {
    expect(categoriesOf("not a tag")).toEqual([]);
  });
});

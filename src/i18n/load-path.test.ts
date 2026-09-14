import { describe, expect, it } from "vitest";
import { loadPath } from "./load-path";

describe("loadPath", () => {
  it("reads the shared address when no tenant is given", () => {
    expect(loadPath(undefined)).toBe(
      "https://translation.retailsvc.com/api/v1/modules/trs-demo-app/translations/{{lng}}",
    );
  });

  it("treats an empty tenant id as no tenant", () => {
    expect(loadPath("")).toBe(loadPath(undefined));
  });

  it("switches to the tenant address when a tenant is given", () => {
    expect(loadPath("acme")).toBe(
      "https://translation.retailsvc.com/api/v1/tenants/acme/modules/trs-demo-app/translations/{{lng}}",
    );
  });

  it("encodes a tenant id so it cannot alter the path", () => {
    expect(loadPath("a/b")).toContain("/tenants/a%2Fb/");
  });

  it("keeps the {{lng}} placeholder for i18next-http-backend to fill in", () => {
    expect(loadPath("acme").endsWith("/translations/{{lng}}")).toBe(true);
  });
});

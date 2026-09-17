import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useRoute } from "./useRoute";

afterEach(() => window.history.replaceState({}, "", "/"));

describe("useRoute", () => {
  it("is the storefront by default", () => {
    expect(renderHook(() => useRoute()).result.current).toBe("storefront");
  });

  it("is the admin page at #/admin", () => {
    window.history.replaceState({}, "", "/#/admin");

    expect(renderHook(() => useRoute()).result.current).toBe("admin");
  });

  it("keeps the tenant in the query string alongside the hash", () => {
    window.history.replaceState({}, "", "/?tenant=acme#/admin");

    expect(renderHook(() => useRoute()).result.current).toBe("admin");
    expect(window.location.search).toBe("?tenant=acme");
  });

  it("follows a hash change without a reload", () => {
    const { result } = renderHook(() => useRoute());

    act(() => {
      window.history.replaceState({}, "", "/#/admin");
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });

    expect(result.current).toBe("admin");
  });
});

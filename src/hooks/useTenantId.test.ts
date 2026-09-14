import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useTenantId } from "./useTenantId";

beforeEach(() => window.history.replaceState({}, "", "/"));

describe("useTenantId", () => {
  it("is undefined when the url names no tenant", () => {
    const { result } = renderHook(() => useTenantId());
    expect(result.current.tenantId).toBeUndefined();
  });

  it("reads the tenant from the query string", () => {
    window.history.replaceState({}, "", "/?tenant=acme");
    const { result } = renderHook(() => useTenantId());
    expect(result.current.tenantId).toBe("acme");
  });

  it("writes a new tenant into the url so the view can be shared", () => {
    const { result } = renderHook(() => useTenantId());
    act(() => result.current.setTenantId("acme"));
    expect(window.location.search).toBe("?tenant=acme");
    expect(result.current.tenantId).toBe("acme");
  });

  it("clearing the tenant removes it from the url and means the shared address", () => {
    window.history.replaceState({}, "", "/?tenant=acme");
    const { result } = renderHook(() => useTenantId());
    act(() => result.current.setTenantId(""));
    expect(window.location.search).toBe("");
    expect(result.current.tenantId).toBeUndefined();
  });
});

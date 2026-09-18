import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useLanguageTag } from "./useLanguageTag";

beforeEach(() => window.history.replaceState({}, "", "/"));

describe("useLanguageTag", () => {
  it("is en-US when the url names no language", () => {
    expect(renderHook(() => useLanguageTag()).result.current.langTag).toBe("en-US");
  });

  it("reads a language the selector could never list", () => {
    // A tenant's own language is absent from /language-tags, so the url is the only way
    // to reach one.
    window.history.replaceState({}, "", "/?tenant=acme&lang=sv-SE");

    expect(renderHook(() => useLanguageTag()).result.current.langTag).toBe("sv-SE");
  });

  it("writes the language into the url beside the tenant", () => {
    window.history.replaceState({}, "", "/?tenant=acme");
    const { result } = renderHook(() => useLanguageTag());

    act(() => result.current.setLangTag("sv-SE"));

    expect(window.location.search).toBe("?tenant=acme&lang=sv-SE");
    expect(result.current.langTag).toBe("sv-SE");
  });

  it("drops the parameter for the default, so the plain address stays plain", () => {
    window.history.replaceState({}, "", "/?lang=sv-SE");
    const { result } = renderHook(() => useLanguageTag());

    act(() => result.current.setLangTag("en-US"));

    expect(window.location.search).toBe("");
    expect(result.current.langTag).toBe("en-US");
  });

  it("leaves the hash alone, so the publishing route survives a language change", () => {
    window.history.replaceState({}, "", "/#/admin");
    const { result } = renderHook(() => useLanguageTag());

    act(() => result.current.setLangTag("sv-SE"));

    expect(window.location.hash).toBe("#/admin");
  });
});

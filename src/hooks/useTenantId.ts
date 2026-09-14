import { useCallback, useEffect, useState } from "react";

function readTenantFromUrl(): string | undefined {
  return new URLSearchParams(window.location.search).get("tenant") || undefined;
}

/**
 * The tenant id lives in the url, so a tenant's view is a shareable link and the scope of
 * every read stays visible. It is an identifier, not a secret — both read endpoints are
 * anonymous by design, which is the whole point of the demo.
 */
export function useTenantId() {
  const [tenantId, setTenant] = useState<string | undefined>(readTenantFromUrl);

  useEffect(() => {
    const sync = () => setTenant(readTenantFromUrl());
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  const setTenantId = useCallback((next: string) => {
    const trimmed = next.trim();
    const params = new URLSearchParams(window.location.search);
    if (trimmed) params.set("tenant", trimmed);
    else params.delete("tenant");

    const query = params.toString();
    window.history.pushState({}, "", query ? `?${query}` : window.location.pathname);
    setTenant(trimmed || undefined);
  }, []);

  return { tenantId, setTenantId };
}

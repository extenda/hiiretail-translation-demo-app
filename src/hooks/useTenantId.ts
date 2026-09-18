import { useQueryParam } from "./useQueryParam";

/**
 * The tenant id lives in the url, so a tenant's view is a shareable link and the scope of
 * every read stays visible. It is an identifier, not a secret — both read endpoints are
 * anonymous by design, which is the whole point of the demo.
 */
export function useTenantId() {
  const [tenantId, setTenantId] = useQueryParam("tenant");

  return { tenantId, setTenantId };
}

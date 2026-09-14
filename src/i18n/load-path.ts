import { API_BASE_URL, MODULE_ID } from "../config";

/**
 * The one URL template the whole integration turns on. A tenant id switches every read to
 * /tenants/{tenantId}/... — the same anonymous endpoint, with that tenant's overrides
 * merged on top. {{lng}} is filled in by i18next-http-backend for every language it loads.
 */
export function loadPath(tenantId: string | undefined): string {
  const base = tenantId
    ? `${API_BASE_URL}/tenants/${encodeURIComponent(tenantId)}`
    : API_BASE_URL;

  return `${base}/modules/${MODULE_ID}/translations/{{lng}}`;
}

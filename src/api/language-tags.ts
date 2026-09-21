import { API_BASE_URL, DEFAULT_LANG_TAG, MODULE_ID } from "../config";

interface LanguageTagsResponse {
  moduleId: string;
  languageTags: string[];
}

/**
 * A language picker needs its own call: i18next-http-backend only ever loads a tag you
 * already asked for and has no notion of what is published, so this is deliberately kept
 * apart from the i18next setup.
 *
 * Which address answers depends on whether a tenant is in scope, the same way `loadPath`
 * switches. The module-wide list covers the default and managed layers only; the
 * tenant-scoped one adds the languages that tenant published for itself, which is exactly
 * the set a tenant's picker is otherwise missing. Either way a module with nothing
 * published answers 404 rather than an empty list — a normal state here, not a failure.
 */
export async function fetchLanguageTags(
  tenantId?: string,
  signal?: AbortSignal,
): Promise<string[]> {
  const response = await fetch(languageTagsUrl(tenantId), { signal });

  if (response.status === 404) return [DEFAULT_LANG_TAG];
  if (!response.ok) throw new Error(`language-tags responded ${response.status}`);

  const body = (await response.json()) as LanguageTagsResponse;
  return body.languageTags;
}

function languageTagsUrl(tenantId: string | undefined): string {
  const base = tenantId
    ? `${API_BASE_URL}/tenants/${encodeURIComponent(tenantId)}`
    : API_BASE_URL;

  return `${base}/modules/${MODULE_ID}/language-tags`;
}

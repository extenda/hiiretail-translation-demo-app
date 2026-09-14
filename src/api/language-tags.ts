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
 * The list covers the default and managed layers, deduplicated and sorted; a tenant's own
 * languages are never listed. A module with nothing published answers 404 rather than an
 * empty list, which is a normal state here, not a failure.
 */
export async function fetchLanguageTags(signal?: AbortSignal): Promise<string[]> {
  const response = await fetch(`${API_BASE_URL}/modules/${MODULE_ID}/language-tags`, {
    signal,
  });

  if (response.status === 404) return [DEFAULT_LANG_TAG];
  if (!response.ok) throw new Error(`language-tags responded ${response.status}`);

  const body = (await response.json()) as LanguageTagsResponse;
  return body.languageTags;
}

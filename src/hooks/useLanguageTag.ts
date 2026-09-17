import { useCallback } from "react";
import { DEFAULT_LANG_TAG } from "../config";
import { useQueryParam } from "./useQueryParam";

/**
 * The language lives in the url beside the tenant, for a reason the tenant layer makes
 * plain: `GET /modules/{m}/language-tags` covers the `default` and `managed` layers alone,
 * so a language a tenant publishes for itself is never listed and the selector can never
 * offer it. Without an address for it, a tenant publish would be unreachable in the very
 * app built to demonstrate it.
 */
export function useLanguageTag() {
  const [langTag, setLangTag] = useQueryParam("lang");

  const change = useCallback(
    (next: string) => setLangTag(next === DEFAULT_LANG_TAG ? "" : next),
    [setLangTag],
  );

  return { langTag: langTag ?? DEFAULT_LANG_TAG, setLangTag: change };
}

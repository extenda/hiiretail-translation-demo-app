import type { InitOptions } from "i18next";
import { DEFAULT_LANG_TAG } from "../config";
import { loadPath } from "./load-path";
import bundledEnUS from "../offline/trs-demo-app.en-US.json";

/**
 * The setup from the client integration guide, expressed as a value so it can be
 * asserted on. Every field here is load-bearing; the comments say what breaks without it.
 */
export function buildInitOptions(
  tenantId: string | undefined,
  langTag: string,
): InitOptions {
  return {
    lng: langTag,
    // A missing key is absent from the response, not present-but-empty, so this only
    // fills the gap because en-US is already loaded by the time it is needed.
    fallbackLng: DEFAULT_LANG_TAG,
    // Both languages fetched before init() resolves, not lazily. Drop en-US here and a
    // missing key renders as the raw key.
    preload: [...new Set([langTag, DEFAULT_LANG_TAG])],
    // The service serves full RFC 5646 tags only. i18next's default, "all", resolves
    // en-US to ["en-US", "en"] and has the backend fetch both, so every load fires a
    // second request for the bare subtag that comes back 400.
    load: "currentOnly",
    // Keys are flat ("cart.count"), not nested. Without these, i18next looks for a
    // nested cart -> count object, finds nothing, and renders the raw key.
    keySeparator: false,
    nsSeparator: false,
    // React already escapes interpolated values; escaping again double-escapes & and <.
    interpolation: { escapeValue: false },
    // Renders the bundled copy the instant init resolves, then still fetches over the
    // network on top of it. Without this, i18next skips the backend entirely for any
    // language already in `resources` — stuck on the last release, never picking up a
    // new publish.
    partialBundledLanguages: true,
    resources: { [DEFAULT_LANG_TAG]: { translation: bundledEnUS } },
    // react-i18next re-renders on languageChanged alone by default, so a bundle that
    // lands after the first paint — which is every network read, now that the bundled
    // copy renders first — would be stored and never shown.
    react: { bindI18nStore: "added" },
    backend: {
      loadPath: loadPath(tenantId),
      // A read answers an envelope — {module, langTag, layer, format, entries} — and the
      // flat key map i18next wants is one field inside it. The default parse is
      // JSON.parse of the whole body, which stores the envelope as the bundle: every key
      // then misses and falls back to the committed copy, so the page looks right while
      // showing nothing the service actually said. scripts/bundle-translations.sh takes
      // `.entries` for the same reason.
      parse: (data: string) => JSON.parse(data).entries,
    },
  };
}

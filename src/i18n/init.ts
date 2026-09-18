import i18next from "i18next";
import HttpBackend from "i18next-http-backend";
import ICU from "i18next-icu";
import { initReactI18next } from "react-i18next";
import { DEFAULT_LANG_TAG } from "../config";
import { buildInitOptions } from "./options";

/**
 * i18next-icu parses ICU MessageFormat ({count, plural, ...}); without it a plural
 * renders as raw ICU syntax rather than text. i18next-http-backend fetches a language
 * file with plain fetch(), which is precisely what lets the response's own Cache-Control
 * and ETag do all of the caching — there is no cache code in this app.
 */
export function initI18n(tenantId: string | undefined, langTag: string) {
  return i18next
    .use(HttpBackend)
    .use(ICU)
    .use(initReactI18next)
    .init(buildInitOptions(tenantId, langTag))
    .then((t) => {
      refresh();
      return t;
    });
}

/**
 * loadPath is fixed at init(), so changing tenant or language means initialising again
 * rather than mutating the live instance.
 */
export function reinitI18n(tenantId: string | undefined, langTag: string) {
  return i18next.init(buildInitOptions(tenantId, langTag)).then((t) => {
    refresh();
    return t;
  });
}

/**
 * The backend skips any language already in the store (`queueLoad` marks it loaded when
 * `store.hasResourceBundle` is true), and en-US is always in the store because it ships
 * bundled. `partialBundledLanguages` only decides whether the backend is consulted at
 * all; it does not make the connector re-read a language it thinks it has. So without
 * this reload the app serves its committed copy of en-US forever and never reads the
 * service — and switching tenant fetches nothing, because the new loadPath is only ever
 * used for a language the store is missing.
 *
 * Only the bundled language needs this. Any other tag is missing from the store, so
 * `preload` fetches it the ordinary way — reloading that one too would just ask for the
 * same file twice. en-US, though, is reloaded whichever language is showing: it is the
 * `fallbackLng` that fills every key the target language leaves out, and on a tenant
 * address it is the tenant's own English, not the copy committed to this repository.
 *
 * Deliberately not awaited: init resolves on the bundled copy so the page paints at once,
 * and the network read lands on top of it. A read that fails changes nothing, which is
 * the offline story. Values arrive by shallow merge, so the fetched copy wins per key.
 */
function refresh(): void {
  void i18next.reloadResources([DEFAULT_LANG_TAG]).catch(() => undefined);
}

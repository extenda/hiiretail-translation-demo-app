import i18next from "i18next";
import HttpBackend from "i18next-http-backend";
import ICU from "i18next-icu";
import { initReactI18next } from "react-i18next";
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
    .init(buildInitOptions(tenantId, langTag));
}

/**
 * loadPath is fixed at init(), so changing tenant or language means initialising again
 * rather than mutating the live instance.
 */
export function reinitI18n(tenantId: string | undefined, langTag: string) {
  return i18next.init(buildInitOptions(tenantId, langTag));
}

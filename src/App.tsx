import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { DEFAULT_LANG_TAG } from "./config";
import { initI18n, reinitI18n } from "./i18n/init";
import { fetchLanguageTags } from "./api/language-tags";
import { useTenantId } from "./hooks/useTenantId";
import { useLanguageTag } from "./hooks/useLanguageTag";
import { useRoute } from "./hooks/useRoute";
import { AdminPage } from "./admin/AdminPage";
import { TenantForm } from "./components/TenantForm";
import { LanguageSelector } from "./components/LanguageSelector";
import { Storefront } from "./components/Storefront";
import { ErrorNote } from "./components/ErrorNote";

const DEMO_ITEM_COUNT = 3;
const VISITOR_NAME = "Dorin";

function Shell({
  tenantId,
  setTenantId,
  langTag,
  setLangTag,
}: {
  tenantId: string | undefined;
  setTenantId: (next: string) => void;
  langTag: string;
  setLangTag: (tag: string) => void;
}) {
  const { t } = useTranslation();
  const [tags, setTags] = useState<string[]>([DEFAULT_LANG_TAG]);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    const controller = new AbortController();
    fetchLanguageTags(controller.signal)
      .then(setTags)
      .catch(() => setError("Could not list published languages — showing English only."));
    return () => controller.abort();
  }, []);

  return (
    <main>
      <h1>{t("app.title")}</h1>
      <p>{t("app.tagline")}</p>
      <p>{t("app.greeting", { name: VISITOR_NAME })}</p>
      <TenantForm tenantId={tenantId} onSubmit={setTenantId} />
      {/* A tenant's own language is absent from /language-tags, which covers the default
          and managed layers alone. The url can still name one, so the selector offers
          whatever it was asked for rather than silently falling back to English. */}
      <LanguageSelector
        tags={tags.includes(langTag) ? tags : [...tags, langTag].sort()}
        current={langTag}
        onChange={setLangTag}
      />
      {!tags.includes(langTag) && (
        <p className="hint">
          {langTag} is not in this module's published list — it is reachable because the
          address names it. A language a tenant publishes for itself is never listed.
        </p>
      )}
      <ErrorNote message={error} />
      <Storefront itemCount={DEMO_ITEM_COUNT} />
      <p className="hint">
        <a href="#/admin">Publish a translation →</a>
      </p>
    </main>
  );
}

export function App() {
  const { tenantId, setTenantId } = useTenantId();
  const route = useRoute();
  const { langTag, setLangTag } = useLanguageTag();
  const [ready, setReady] = useState(false);
  const started = useRef(false);

  // loadPath is fixed at init(), so a new tenant or language means initialising again.
  // A failed fetch is not a failed init: partialBundledLanguages leaves the bundled copy
  // rendering, which is exactly the offline story the guide describes.
  useEffect(() => {
    const run = started.current ? reinitI18n : initI18n;
    started.current = true;
    run(tenantId, langTag)
      .catch(() => undefined)
      .finally(() => setReady(true));
  }, [tenantId, langTag]);

  if (!ready) return null;

  // The publishing page is not translated by this app's own key set, so it does not wait
  // on i18next beyond the init above.
  if (route === "admin") return <AdminPage tenantId={tenantId} />;

  return (
    <Shell
      tenantId={tenantId}
      setTenantId={setTenantId}
      langTag={langTag}
      setLangTag={setLangTag}
    />
  );
}

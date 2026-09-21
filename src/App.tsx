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

  /*
   * Rebuilt whenever the tenant changes, exactly as loadPath is: the tenant-scoped list is
   * a different list, and keeping the previous tenant's would offer languages this one
   * never published. So the old list goes before the new one is asked for.
   *
   * An abort is this effect replacing itself, not the service failing. It rejects like any
   * other error, so without this guard every tenant change reports one — and a superseded
   * request could still overwrite the current tenant's list on its way out.
   */
  useEffect(() => {
    const controller = new AbortController();
    setTags([DEFAULT_LANG_TAG]);
    setError(undefined);
    fetchLanguageTags(tenantId, controller.signal)
      .then((published) => {
        if (!controller.signal.aborted) setTags(published);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError("Could not list published languages — showing English only.");
      });
    return () => controller.abort();
  }, [tenantId]);

  return (
    <main>
      <h1>{t("app.title")}</h1>
      <p>{t("app.tagline")}</p>
      <p>{t("app.greeting", { name: VISITOR_NAME })}</p>
      <TenantForm tenantId={tenantId} onSubmit={setTenantId} />
      {/* With a tenant in scope the list already carries that tenant's own languages.
          Without one it covers the default and managed layers alone — and either way the
          url can name a tag no list mentions, so the selector offers whatever it was
          asked for rather than silently falling back to English. */}
      <LanguageSelector
        tags={tags.includes(langTag) ? tags : [...tags, langTag].sort()}
        current={langTag}
        onChange={setLangTag}
      />
      {!tags.includes(langTag) && (
        <p className="hint">
          {langTag} is not in this module's published list — it is reachable because the
          address names it.
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

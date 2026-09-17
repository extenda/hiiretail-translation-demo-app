import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { DEFAULT_LANG_TAG } from "./config";
import { initI18n, reinitI18n } from "./i18n/init";
import { fetchLanguageTags } from "./api/language-tags";
import { useTenantId } from "./hooks/useTenantId";
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
      <LanguageSelector tags={tags} current={langTag} onChange={setLangTag} />
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
  const [langTag, setLangTag] = useState(DEFAULT_LANG_TAG);
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

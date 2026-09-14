import { useState } from "react";
import { useTranslation } from "react-i18next";

export function TenantForm({
  tenantId,
  onSubmit,
}: {
  tenantId: string | undefined;
  onSubmit: (next: string) => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(tenantId ?? "");

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(draft);
      }}
    >
      <label htmlFor="tenant">{t("tenant.label")}</label>
      <input
        id="tenant"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder={t("tenant.shared")}
      />
      <button type="submit">{t("tenant.label")}</button>
      <p className="hint">{t("tenant.hint")}</p>
    </form>
  );
}

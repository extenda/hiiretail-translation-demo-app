import { useTranslation } from "react-i18next";

export function LanguageSelector({
  tags,
  current,
  onChange,
}: {
  tags: string[];
  current: string;
  onChange: (tag: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="field">
      <label htmlFor="language">{t("language.label")}</label>
      <select
        id="language"
        value={current}
        onChange={(event) => onChange(event.target.value)}
      >
        {tags.map((tag) => (
          <option key={tag} value={tag}>
            {tag}
          </option>
        ))}
      </select>
    </div>
  );
}

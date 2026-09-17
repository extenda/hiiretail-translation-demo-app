import type { TranslationEntries } from "../api/publish";
import { isPluralKey, type Draft } from "./draft";
import { categoriesOf } from "./plural-categories";

/**
 * One row per key the default layer declares — never a free-text key, because the service
 * rejects any key the module has not defined in English. The description is the only
 * context a translator gets, so it is shown rather than hidden behind a tooltip.
 */
export function KeyEditor({
  keySet,
  draft,
  langTag,
  incomplete,
  onValue,
  onForm,
}: {
  keySet: TranslationEntries;
  draft: Draft;
  langTag: string;
  incomplete: string[];
  onValue: (key: string, value: string) => void;
  onForm: (key: string, category: string, value: string) => void;
}) {
  const categories = categoriesOf(langTag);

  return (
    <ol className="keys">
      {Object.keys(keySet).map((key) => (
        <li key={key} className="field">
          <p className="key">
            <code>{key}</code>
          </p>
          <p className="hint">{keySet[key].description ?? keySet[key].value}</p>
          <p className="hint">
            English: <q>{keySet[key].value}</q>
          </p>

          {isPluralKey(keySet, key) ? (
            <PluralForms
              formKey={key}
              categories={categories}
              draft={draft}
              incomplete={incomplete.includes(key)}
              onForm={onForm}
            />
          ) : (
            <>
              <label htmlFor={`value-${key}`}>Translation</label>
              <input
                id={`value-${key}`}
                value={draft[key]?.value ?? ""}
                onChange={(event) => onValue(key, event.target.value)}
              />
            </>
          )}
        </li>
      ))}
    </ol>
  );
}

/**
 * A plural key needs a form for every category the target language uses — Swedish has
 * two, Polish four — and the service rejects an entry missing any of them. One box per
 * category, so the shape of the requirement is visible before the publish rather than in
 * the 422 after it.
 */
function PluralForms({
  formKey,
  categories,
  draft,
  incomplete,
  onForm,
}: {
  formKey: string;
  categories: Intl.LDMLPluralRule[];
  draft: Draft;
  incomplete: boolean;
  onForm: (key: string, category: string, value: string) => void;
}) {
  return (
    <>
      <p className="hint">
        Plural key — {categories.length} form{categories.length === 1 ? "" : "s"} required.
      </p>
      {categories.map((category) => (
        <span key={category}>
          <label htmlFor={`form-${formKey}-${category}`}>{category}</label>
          <input
            id={`form-${formKey}-${category}`}
            value={draft[formKey]?.forms[category] ?? ""}
            onChange={(event) => onForm(formKey, category, event.target.value)}
          />
        </span>
      ))}
      {incomplete && <p className="error">Every form is required, or leave them all empty.</p>}
    </>
  );
}

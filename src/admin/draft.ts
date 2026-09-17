import type { PluralForms, TranslationEntries } from "../api/publish";
import { categoriesOf } from "./plural-categories";

export interface DraftEntry {
  value: string;
  forms: PluralForms;
}

export type Draft = Record<string, DraftEntry>;

export function isPluralKey(keySet: TranslationEntries, key: string): boolean {
  return keySet[key]?.plural !== undefined;
}

/**
 * The editor opens on what the language already has, so a publish replaces the file
 * rather than silently dropping every key the editor did not show. A language with
 * nothing published opens empty — that is the add-a-language case.
 */
export function draftFrom(
  keySet: TranslationEntries,
  published?: TranslationEntries,
): Draft {
  return Object.fromEntries(
    Object.keys(keySet).map((key) => [
      key,
      {
        value: published?.[key]?.value ?? "",
        forms: { ...published?.[key]?.plural?.forms },
      },
    ]),
  );
}

/**
 * There is no single-layer tenant read — the tenant address merges default, managed and
 * tenant — so an override is recognised by differing from the base file rather than by
 * being labelled. An override whose value happens to equal the managed copy is therefore
 * invisible here; it is also, by definition, doing nothing.
 */
export function tenantOverrides(
  base: TranslationEntries | undefined,
  resolved: TranslationEntries | undefined,
): TranslationEntries {
  if (!resolved) return {};

  return Object.fromEntries(
    Object.entries(resolved).filter(
      ([key, entry]) =>
        entry.value !== base?.[key]?.value ||
        JSON.stringify(entry.plural?.forms) !== JSON.stringify(base?.[key]?.plural?.forms),
    ),
  );
}

/**
 * Plural keys with some categories filled and others empty. The service rejects an entry
 * that omits any category the language requires, so saying so here costs a glance rather
 * than a round trip — and unlike the 422, it can point at the box that is empty.
 */
export function incompletePlurals(
  draft: Draft,
  keySet: TranslationEntries,
  langTag: string,
): string[] {
  const categories = categoriesOf(langTag);

  return Object.keys(draft).filter((key) => {
    if (!isPluralKey(keySet, key)) return false;

    const filled = categories.filter((category) => draft[key].forms[category]?.trim());
    return filled.length > 0 && filled.length < categories.length;
  });
}

/**
 * Only what was actually written. A key left blank stays absent: an empty string counts
 * as a translation to both the service and the coverage report, and it would render as
 * empty text instead of falling back to English.
 *
 * `description` and `parameters` never travel — the default layer owns them and the
 * service answers 422 for either. `plural.parameter` is owned there too, so the forms go
 * alone, and `value` is the `other` form because the service requires a non-empty value
 * on every entry. That is the shape the seed files use.
 */
export function entriesToPublish(
  draft: Draft,
  keySet: TranslationEntries,
  langTag: string,
): TranslationEntries {
  const categories = categoriesOf(langTag);
  const entries: TranslationEntries = {};

  for (const [key, entry] of Object.entries(draft)) {
    if (isPluralKey(keySet, key)) {
      const filled = categories.filter((category) => entry.forms[category]?.trim());
      if (filled.length !== categories.length || categories.length === 0) continue;

      const forms = Object.fromEntries(
        categories.map((category) => [category, entry.forms[category] as string]),
      ) as PluralForms;

      entries[key] = { value: forms.other as string, plural: { forms } };
      continue;
    }

    if (entry.value.trim()) entries[key] = { value: entry.value };
  }

  return entries;
}

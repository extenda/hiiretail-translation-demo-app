/**
 * The service pins this order and filters the runtime's categories through it
 * (`plural-categories.ts` there). Mirrored rather than re-derived so the inputs appear in
 * the order the violations name them, and so a language needing `few`/`many` gets those
 * boxes instead of a 422 after the fact.
 */
const PLURAL_CATEGORIES: Intl.LDMLPluralRule[] = [
  "zero",
  "one",
  "two",
  "few",
  "many",
  "other",
];

export function categoriesOf(langTag: string): Intl.LDMLPluralRule[] {
  try {
    const resolved = new Intl.PluralRules(langTag).resolvedOptions().pluralCategories;
    return PLURAL_CATEGORIES.filter((category) =>
      (resolved as string[]).includes(category),
    );
  } catch {
    return [];
  }
}

import { API_BASE_URL, DEFAULT_LANG_TAG, MODULE_ID } from "../config";

export type PluralForms = Partial<Record<Intl.LDMLPluralRule, string>>;

export interface TranslationEntry {
  value: string;
  description?: string;
  parameters?: string[];
  plural?: { parameter?: string; forms: PluralForms };
}

export type TranslationEntries = Record<string, TranslationEntry>;

/** `default` is published by CI from translations/en-US.json and is not editable here. */
export type PublishableLayer = "managed" | "tenant";

/**
 * The service's own rule, copied rather than approximated, so the tag is rejected here
 * with the same reasoning it would be rejected there — and before the round trip. Canonical
 * form is required, not just validity: the tag is part of a case sensitive object path and
 * of the cache key, so one file must be addressable by exactly one URL.
 */
export function isFullLanguageTag(tag: string): boolean {
  try {
    const [canonical] = Intl.getCanonicalLocales(tag);
    return canonical === tag && new Intl.Locale(tag).region !== undefined;
  } catch {
    return false;
  }
}

export class PublishError extends Error {
  constructor(
    readonly status: number,
    readonly violations: string[],
  ) {
    super(violations.join("\n"));
    this.name = "PublishError";
  }
}

/**
 * The editor needs the stored entry objects — descriptions to show as help text, plural
 * blocks to know which keys need a form per category. `format=icu`, the default, compiles
 * all of that away into one string per key.
 */
async function readRaw(
  url: string,
  signal?: AbortSignal,
): Promise<TranslationEntries | undefined> {
  const response = await fetch(`${url}?format=raw`, { signal });

  // A language with nothing published answers 404. For the editor that is not a failure:
  // it is precisely the state of a language about to be added.
  if (response.status === 404) return undefined;
  if (!response.ok) throw new Error(`${url} responded ${response.status}`);

  const body = (await response.json()) as { entries: TranslationEntries };
  return body.entries;
}

/**
 * The default layer's en-US file: the only keys a translation may carry, and the
 * descriptions written for whoever translates them.
 */
export function readKeySet(signal?: AbortSignal) {
  return readRaw(`${API_BASE_URL}/modules/${MODULE_ID}/translations/${DEFAULT_LANG_TAG}`, signal);
}

/** default + managed for one tag. `default` only ever holds en-US, so for any other tag
 * this is the managed file alone — exactly what the managed editor edits. */
export function readLanguage(langTag: string, signal?: AbortSignal) {
  return readRaw(`${API_BASE_URL}/modules/${MODULE_ID}/translations/${langTag}`, signal);
}

/** default + managed + tenant. There is no single-layer tenant read, so the tenant editor
 * diffs this against readLanguage to tell an override from an inherited value. */
export function readTenantLanguage(
  tenantId: string,
  langTag: string,
  signal?: AbortSignal,
) {
  return readRaw(
    `${API_BASE_URL}/tenants/${encodeURIComponent(tenantId)}/modules/${MODULE_ID}/translations/${langTag}`,
    signal,
  );
}

/**
 * Create or replace a layer file. The path names the module and the tag, so the body
 * carries entries alone. A `tenant` publish lands on the tenant in the token, never one
 * named by the request — the ?tenant= box in the storefront has no bearing on it.
 */
export async function publishLayer({
  token,
  layer,
  langTag,
  entries,
}: {
  token: string;
  layer: PublishableLayer;
  langTag: string;
  entries: TranslationEntries;
}): Promise<{ created: boolean }> {
  const response = await fetch(
    `${API_BASE_URL}/modules/${MODULE_ID}/translations/${langTag}/layers/${layer}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ entries }),
    },
  );

  if (!response.ok) throw new PublishError(response.status, await violationsOf(response));

  return { created: response.status === 201 };
}

/**
 * The service answers a failed publish with a message naming the offending key and field,
 * written to be read. Showing it verbatim beats any summary this page could invent.
 */
async function violationsOf(response: Response): Promise<string[]> {
  try {
    const body = (await response.json()) as { message?: string | string[] };
    if (Array.isArray(body.message)) return body.message;
    if (body.message) return [body.message];
  } catch {
    // A body that is not JSON tells us nothing the status has not already.
  }

  return [`The service answered ${response.status}.`];
}

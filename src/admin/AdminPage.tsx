import { useCallback, useEffect, useState } from "react";
import { fetchLanguageTags } from "../api/language-tags";
import {
  isFullLanguageTag,
  PublishError,
  publishLayer,
  readKeySet,
  readLanguage,
  readTenantLanguage,
  type PublishableLayer,
  type TranslationEntries,
} from "../api/publish";
import { KeyEditor } from "./KeyEditor";
import {
  draftFrom,
  entriesToPublish,
  fileViolations,
  incompletePlurals,
  langTagFromFileName,
  tenantOverrides,
  type Draft,
} from "./draft";

const ADD_NEW = "__add__";

type Outcome =
  | { kind: "published"; created: boolean; count: number }
  | { kind: "rejected"; status: number; violations: string[] };

/**
 * The publishing half of the demo. The storefront shows an anonymous read; this shows the
 * authenticated write behind it, which is the half a client app never sees and the guide
 * can otherwise only describe. Its own text is plain English on purpose: it is an
 * operator tool, and putting its strings in the key set would blur what the storefront
 * demonstrates.
 */
export function AdminPage({ tenantId }: { tenantId: string | undefined }) {
  const [token, setToken] = useState("");
  const [layer, setLayer] = useState<PublishableLayer>("managed");
  const [tags, setTags] = useState<string[]>([]);
  const [selection, setSelection] = useState("");
  const [newTag, setNewTag] = useState("");
  const [keySet, setKeySet] = useState<TranslationEntries>();
  const [draft, setDraft] = useState<Draft>({});
  const [problem, setProblem] = useState<string>();
  const [outcome, setOutcome] = useState<Outcome>();
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState<{ name: string; problems: string[] } | undefined>();

  const langTag = selection === ADD_NEW ? newTag.trim() : selection;
  const tagIsValid = langTag !== "" && isFullLanguageTag(langTag);

  useEffect(() => {
    const controller = new AbortController();

    Promise.all([
      fetchLanguageTags(controller.signal).catch(() => [] as string[]),
      readKeySet(controller.signal),
    ])
      .then(([published, keys]) => {
        setTags(published);
        setKeySet(keys);
        if (!keys) setProblem("This module has no English key set published, so there is nothing to translate yet.");
      })
      .catch(() => setProblem("Could not reach Translation Service."));

    return () => controller.abort();
  }, []);

  // Reloading whenever the target changes is what makes a publish a replace rather than a
  // silent truncation: whatever the language already has is in the form before it is sent.
  useEffect(() => {
    if (!keySet || !tagIsValid) {
      setDraft(keySet ? draftFrom(keySet) : {});
      return;
    }

    const controller = new AbortController();
    setOutcome(undefined);

    const load = async () => {
      const base = await readLanguage(langTag, controller.signal);
      if (layer === "managed") return draftFrom(keySet, base);

      // A tenant read merges three layers, so an override is what differs from the base.
      const resolved = tenantId
        ? await readTenantLanguage(tenantId, langTag, controller.signal)
        : undefined;
      return draftFrom(keySet, tenantOverrides(base, resolved));
    };

    load()
      .then(setDraft)
      .catch(() => {
        if (!controller.signal.aborted) setProblem(`Could not read ${langTag}.`);
      });

    return () => controller.abort();
  }, [keySet, langTag, tagIsValid, layer, tenantId]);

  /**
   * A reviewed translation file, straight into the editor. The seed files under `seed/`
   * are this shape, and they are where a language gets read and argued over in a pull
   * request — a page cannot offer that, and retyping twelve strings and three plural
   * forms by hand is how a reviewed translation stops matching what was reviewed.
   */
  const loadFile = useCallback(
    async (file: File) => {
      if (!keySet) return;

      try {
        const parsed = JSON.parse(await file.text()) as TranslationEntries;
        const problems = fileViolations(parsed, keySet);

        setDraft(draftFrom(keySet, parsed));
        setLoaded({ name: file.name, problems });
        setOutcome(undefined);

        const named = langTagFromFileName(file.name);
        if (named && selection !== named) {
          setSelection(tags.includes(named) ? named : ADD_NEW);
          if (!tags.includes(named)) setNewTag(named);
        }
      } catch {
        setLoaded({ name: file.name, problems: ["Could not read this file as JSON."] });
      }
    },
    [keySet, selection, tags],
  );

  const setValue = useCallback((key: string, value: string) => {
    setDraft((current) => ({ ...current, [key]: { ...current[key], value } }));
  }, []);

  const setForm = useCallback((key: string, category: string, value: string) => {
    setDraft((current) => ({
      ...current,
      [key]: { ...current[key], forms: { ...current[key].forms, [category]: value } },
    }));
  }, []);

  if (!keySet) {
    return (
      <main>
        <AdminHeader />
        <p className="hint">{problem ?? "Loading the key set…"}</p>
      </main>
    );
  }

  const halfFilled = tagIsValid ? incompletePlurals(draft, keySet, langTag) : [];
  const entries = tagIsValid ? entriesToPublish(draft, keySet, langTag) : {};
  const count = Object.keys(entries).length;
  const blocked = !token.trim() || !tagIsValid || halfFilled.length > 0 || count === 0;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setOutcome(undefined);

    try {
      const { created } = await publishLayer({ token, layer, langTag, entries });
      setOutcome({ kind: "published", created, count });
      if (!tags.includes(langTag)) setTags([...tags, langTag].sort());
    } catch (error) {
      setOutcome(
        error instanceof PublishError
          ? { kind: "rejected", status: error.status, violations: error.violations }
          : { kind: "rejected", status: 0, violations: ["The request never reached the service."] },
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <main>
      <AdminHeader />

      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="token">IAM token</label>
          <input
            id="token"
            type="password"
            autoComplete="off"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="Bearer token for a principal holding trs.translation.publish"
          />
          <p className="hint">
            Held in memory for this page only — never stored, never put in the URL. Reads on
            the storefront need nothing; only publishing needs this.
          </p>
        </div>

        <fieldset className="field">
          <legend>Layer</legend>
          {(["managed", "tenant"] as const).map((option) => (
            <label key={option} htmlFor={`layer-${option}`}>
              <input
                id={`layer-${option}`}
                type="radio"
                name="layer"
                value={option}
                checked={layer === option}
                onChange={() => setLayer(option)}
              />
              {option}
            </label>
          ))}
          <p className="hint">
            {layer === "managed"
              ? "Product-managed wording, for every tenant."
              : `Overrides for one tenant — the tenant in your token, not the ?tenant= box.${
                  tenantId ? ` Showing ${tenantId}'s current overrides as a starting point.` : ""
                }`}
          </p>
        </fieldset>

        <div className="field">
          <label htmlFor="seed-file">Load a translation file</label>
          <input
            id="seed-file"
            type="file"
            accept="application/json,.json"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void loadFile(file);
            }}
          />
          <p className="hint">
            A reviewed file from <code>seed/</code>, named for its tag (<code>ro-RO.json</code>).
            It fills the editor; nothing is sent until you publish.
          </p>
          {loaded && (
            <>
              <p className="hint">
                Loaded <code>{loaded.name}</code>.
              </p>
              {loaded.problems.length > 0 && (
                <ul>
                  {loaded.problems.map((problem) => (
                    <li key={problem} className="error">
                      {problem}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>

        <div className="field">
          <label htmlFor="language">Language</label>
          <select
            id="language"
            value={selection}
            onChange={(event) => setSelection(event.target.value)}
          >
            <option value="">Choose a language…</option>
            {tags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
            <option value={ADD_NEW}>Add a language…</option>
          </select>
        </div>

        {selection === ADD_NEW && (
          <div className="field">
            <label htmlFor="new-tag">New language tag</label>
            <input
              id="new-tag"
              value={newTag}
              onChange={(event) => setNewTag(event.target.value)}
              placeholder="sv-SE"
            />
            {newTag.trim() !== "" && !tagIsValid && (
              <p className="error">
                langTag must be a full RFC 5646 language tag in canonical form, with a region
                subtag (e.g. en-US)
              </p>
            )}
          </div>
        )}

        {tagIsValid && (
          <>
            <KeyEditor
              keySet={keySet}
              draft={draft}
              langTag={langTag}
              incomplete={halfFilled}
              onValue={setValue}
              onForm={setForm}
            />

            <button type="submit" disabled={blocked || busy}>
              {busy ? "Publishing…" : `Publish ${count} key${count === 1 ? "" : "s"} to ${layer}`}
            </button>

            {halfFilled.length > 0 && (
              <p className="error">
                Every plural form is required for {langTag}. Finish or clear:{" "}
                {halfFilled.join(", ")}.
              </p>
            )}
            {count === 0 && halfFilled.length === 0 && (
              <p className="hint">Nothing to publish yet — translate at least one key.</p>
            )}
          </>
        )}
      </form>

      <Result outcome={outcome} langTag={langTag} layer={layer} />
      {problem && <p className="error">{problem}</p>}
    </main>
  );
}

function AdminHeader() {
  return (
    <>
      <h1>Publish a translation</h1>
      <p>
        The storefront reads anonymously. This publishes, which needs a token from a
        principal holding <code>trs.translation.publish</code>.
      </p>
      <p className="hint">
        Adding a language and editing one are the same call — a publish replaces the whole
        layer file for that tag. There is no delete: the service exposes publish only, so a
        language cannot be removed from here, or from anywhere else, once published. The{" "}
        <code>default</code> layer is missing on purpose; CI publishes it from{" "}
        <code>translations/en-US.json</code> on every merge, so an edit here would be
        reverted by the next one.
      </p>
      <p>
        <a href="#/">← Back to the storefront</a>
      </p>
    </>
  );
}

function Result({
  outcome,
  langTag,
  layer,
}: {
  outcome: Outcome | undefined;
  langTag: string;
  layer: PublishableLayer;
}) {
  if (!outcome) return null;

  if (outcome.kind === "published") {
    return (
      <p role="status">
        {outcome.created ? "Created" : "Replaced"} {langTag} in the {layer} layer with{" "}
        {outcome.count} key{outcome.count === 1 ? "" : "s"}. Reads are cached for five
        minutes, so the storefront may take that long to show it.
      </p>
    );
  }

  return (
    <div role="alert">
      <p className="error">The service rejected this publish ({outcome.status}):</p>
      <ul>
        {outcome.violations.map((violation) => (
          <li key={violation} className="error">
            {violation}
          </li>
        ))}
      </ul>
    </div>
  );
}

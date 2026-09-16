# Translation Service demo app

A small, deployed, tenant-scoped shop front that reads its text from
[Translation Service](https://translation.retailsvc.com). It exists so the public client
integration guide has a live worked example instead of only code snippets: everything here
is the guide, running.

**Public URL:** https://translation-demo.retailsvc.com

- Guide it implements: `docs/translation-service/public/integration/CLIENT-APPS.md`
  (`engineering-cloud-core-common`)
- Publishing guide: `docs/translation-service/public/integration/PUBLISHING-FROM-CI.md`
- Ticket: [HII-14036](https://extendaretail.atlassian.net/browse/HII-14036)

## The file to read

[`src/i18n/options.ts`](src/i18n/options.ts) is the point of this repository. It is the
guide's `init` options as a plain value, so it can be diffed against the guide and asserted
on in a test. Every field in it is load-bearing and the comments say what breaks without it:

| Setting | Drop it and |
| --- | --- |
| `keySeparator: false`, `nsSeparator: false` | `t("cart.count")` looks for a nested `cart` → `count` object, finds nothing, renders the raw key |
| `en-US` in `preload` + `fallbackLng` | a key missing from the target language renders as the raw key |
| `interpolation: { escapeValue: false }` | React escapes again and `&`/`<` come out double-escaped |
| `partialBundledLanguages: true` | i18next skips the backend for any language in `resources` — stuck on the last release forever |
| `i18next-icu` (in [`init.ts`](src/i18n/init.ts)) | a plural renders as raw `{count, plural, ...}` syntax |

[`src/i18n/load-path.ts`](src/i18n/load-path.ts) is the other half: one URL template, and a
tenant id is the only thing that changes it.

## Running it

```bash
npm install
npm run dev
```

No proxy, no token, no local Translation Service. Reads are anonymous `GET`s and the browser
talks to production directly — in dev exactly as in production. That is deliberate: a demo
that only works behind a dev proxy would not demonstrate the thing it claims to.

> **This depends on a service change that has not shipped yet.** Translation Service
> currently enables CORS only in the `local` environment, so staging and production return
> no `Access-Control-Allow-Origin` and a browser drops every response — the app falls back
> to its bundled English and the tenant field and language selector do nothing.
> [extenda/hiiretail-translation-service#40](https://github.com/extenda/hiiretail-translation-service/pull/40)
> fixes that. Delete this note once it is deployed.

```bash
npm test          # vitest
npm run build     # tsc -b && vite build
npm run serve     # serve dist/ the way the container does
```

## Tenant scope

The tenant id lives in the query string, so a tenant's view is a shareable link:

```
https://translation-demo.retailsvc.com/?tenant=acme
```

Entering one switches every read from `/modules/trs-demo-app/…` to
`/tenants/acme/modules/trs-demo-app/…` — the same anonymous endpoint, with that tenant's
overrides merged on top. No credential is involved: a tenant id is an identifier, not a
secret, and both read endpoints are public by design.

`loadPath` is fixed at `init()`, so changing tenant re-initialises i18next rather than
mutating the live instance. That is why the tenant lives in the URL and not in component
state.

## Caching

There is no caching code in this repository, and there should not be. Reads come back with:

```
Cache-Control: public, max-age=300, stale-while-revalidate=86400
ETag: "…"
```

`i18next-http-backend` uses plain `fetch`, which honours all of it:

- inside 300 seconds — served from the browser's own cache, no request at all
- after that — `fetch` revalidates with the `ETag`; `304` means no body, cheap
- a language already in `preload` — `changeLanguage` touches the network not at all

A wording change therefore takes up to five minutes to appear. That is the design, not a
bug.

## Offline

`src/offline/trs-demo-app.en-US.json` is committed, so a cold start with no network renders
text instead of raw keys, and a fresh clone builds without reaching the API.
`scripts/bundle-translations.sh` regenerates it, and CI refreshes it before packaging
(`continue-on-error`, because the committed copy is a valid fallback — that is what it is
for).

## Publishing

`translations/en-US.json` is this module's key set: the English wording it ships with, and
what every translation is measured against. `.github/workflows/translations.yml` publishes it
to the `default` layer of module `trs-demo-app` on every merge to `master`, to staging and
then production, and reads it back anonymously to prove the publish landed. A pull request
runs the same action as a dry run.

Descriptions in that file are written for whoever translates the key. They are the only
context a translator gets.

## Known gap: the language selector shows only English

The selector lists what `GET /modules/trs-demo-app/language-tags` returns, which covers the
`default` and `managed` layers. This repository can only publish the `default` layer, so
until someone seeds the others the list has one entry.

That is not an oversight in the pipeline. The three layers are gated differently:

| Layer | Gate | From CI? |
| --- | --- | --- |
| `default` | `googletoken.check("trs.translation-api")` | yes — the cloud-core `ci-cd-pipeline` accounts are already allowed consumers |
| `managed` | `check_permission("trs.translation.publish")` + Extenda tenant | **no** |
| `tenant` | `check_permission("trs.translation.publish")` | **no** |

`check_permission` resolves an Extenda IAM grant for a principal in a tenant. A GCP service
account token does not satisfy it, so the pipeline's credential cannot publish those layers
however it is configured.

Swedish and Finnish wording and one tenant override are ready in `seed/`.
`scripts/publish-seed-layers.sh` publishes them, and needs a token from a principal holding
the **Translation Admin** role (`trs.admin`):

```bash
TRS_TOKEN=... ./scripts/publish-seed-layers.sh
```

Once such a principal exists as a CI identity, that script becomes a workflow step and this
section goes away.

## Deployment

A Vite build served by a ~30-line Node static server
([`server/index.mjs`](server/index.mjs)) on `node:24-alpine`, deployed to Cloud Run with
`security: none` so a visitor needs nothing to load it. `.github/workflows/commit.yml` builds,
tests, pushes the image, attests it and deploys on `master`.

## A note on i18next-icu and Vitest

`i18next-icu` does `import IntlMessageFormat from "intl-messageformat"`. That default export
is the constructor in the package's ESM build, which is what Vite resolves — but a namespace
object under Node's CJS interop, which is what Vitest reaches for when it externalises the
dependency. When that happens `new IntlMessageFormat(...)` throws, `i18next-icu` swallows the
error through its `parseErrorHandler`, and every ICU message silently renders as raw syntax.

Hence `server.deps.inline` in [`vitest.config.ts`](vitest.config.ts). Anyone following the
guide who tests with Vitest will hit this.

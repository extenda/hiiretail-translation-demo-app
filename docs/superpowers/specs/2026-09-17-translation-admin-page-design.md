# Publishing page, and the bare-subtag 400

Two changes to the demo app: stop it asking the service for language tags the service
rejects, and give it a second page that publishes a language instead of only reading one.

Ticket: [HII-14036](https://extendaretail.atlassian.net/browse/HII-14036)

## 1. The bare subtag 400

Every page load fires a request that fails:

```
GET https://translation.retailsvc.com/api/v1/tenants/CIR7nQwtS0rA6t0S6ejd/modules/trs-demo-app/translations/en
400 — langTag must be a full RFC 5646 language tag in canonical form, with a region subtag (e.g. en-US)
```

The load path is not at fault. i18next's `load` option defaults to `all`, so
`toResolveHierarchy` appends the bare language part of any tag containing a hyphen:

```js
if (this.options.load !== 'currentOnly') addCode(this.getLanguagePartFromCode(code));
```

Asking for `en-US` therefore resolves to `["en-US", "en"]`, and `i18next-http-backend`
fetches both. The service serves full RFC 5646 tags only, so the second request is a 400.
The app still renders, because the `en-US` request succeeds and nothing depends on the
other one — which is why this survived to production. Switching to Swedish will do the
same thing with `sv`.

The fix is one field in `buildInitOptions`:

```ts
// The service serves full RFC 5646 tags only. Without this, i18next also resolves the
// bare subtag ("en" for "en-US") and every load fires a second request that 400s.
load: "currentOnly",
```

This belongs in the README's load-bearing settings table, which is the point of the
repository. Drop it and every language load costs an extra failed round trip.

## 2. The publishing page

### What the API allows

The design is shaped by the service rather than by preference, so the constraints come
first. All of them are read from `hiiretail-translation-service`, not assumed.

| Constraint | Where | Consequence |
| --- | --- | --- |
| The only write is `PUT /modules/{m}/translations/{tag}/layers/{layer}` | `publish-translations.controller.ts` | adding a language and editing one are the same call |
| No `DELETE` exists | no `Method.Delete` anywhere in `src` | deleting a language cannot be built |
| `default` accepts `en-US` only, and declares the key set | `publish-translations.service.ts` | a new language is a `managed` or `tenant` publish |
| `description` and `parameters` are rejected on `managed`/`tenant` | `defaultOwnedFieldViolations` | the page sends `value` (and `plural.forms`) alone |
| A `managed`/`tenant` key must exist in `default` | `unknownKeyViolations` | the editor's rows come from the key set, never from free text |
| A plural key needs every CLDR category of the target tag | `pluralViolations` | plural keys get one input per category |
| `tenant` resolves the tenant from the caller's token | `publish-translations.controller.ts` | the page's `?tenant=` box has no bearing on where a tenant publish lands |

Reads are anonymous and the gateway allows the authenticated write. A preflight from the
demo's own origin answers:

```
access-control-allow-origin: https://translation-demo.retailsvc.com
access-control-allow-methods: GET,POST,PUT,PATCH,DELETE,OPTIONS
access-control-allow-headers: ...,Authorization,...
```

### Loading a language to edit

`default/sv-SE` never exists, so `GET /modules/trs-demo-app/translations/sv-SE?format=raw`
resolves the managed file alone rather than merging English underneath it. That gives the
editor exactly what it needs:

- `404` — nothing published for this tag. This is the add-a-language starting state.
- `200` — the current managed values, ready to edit.

The key set, and the descriptions shown as help text, come from a separate
`en-US?format=raw` read.

The tenant layer has no single-layer read: `/tenants/{id}/modules/{m}/translations/{tag}`
merges default, managed and tenant. A tenant edit therefore loads both that and the base
read and treats a value as a tenant override only where the two differ. A tenant override
whose value equals the managed copy is indistinguishable from no override at all; that is
a limitation of the read API, noted in a comment rather than engineered around.

### Shape

```
src/
  hooks/useRoute.ts          #/admin, read from the hash, beside useTenantId
  api/publish.ts             PUT a layer file; read the key set; read a layer
  admin/AdminPage.tsx        token, layer, language, publish
  admin/KeyEditor.tsx        one row per declared key
  admin/PluralEditor.tsx     one input per CLDR category
  admin/violations.ts        render a 422 body
```

`App.tsx` renders the storefront shell or the admin page off `useRoute()`. The hash keeps
`server/index.mjs` unchanged — a deep link to `#/admin` is still a request for `/`.

The admin page's own text is plain English and adds no keys to the `default` layer. It is
an operator tool; the storefront is the thing the demo exists to demonstrate, and padding
the key set with tooling strings would blur that.

### The editor

One row per key from the `en-US` key set: the key, its description as help text, and a
value input carrying whatever the target language has published. Plural keys instead get
one input per category from `Intl.PluralRules(tag).resolvedOptions().pluralCategories`,
which is the same set `categoriesOf(langTag)` validates against. `cart.count` is such a
key, so a single input per row would silently destroy its plural forms on the first
publish.

Adding a language is a free-text tag field validated client-side against the full RFC 5646
rule before anything is sent, so the tag error appears without a round trip — the same
error this change stops i18next from provoking.

Publishing `PUT`s the layer file and reports what came back: `201` created, `200` replaced,
and a `422` rendered as its `message` array verbatim. Those strings name the offending key
and field (`entries.app.greeting.parameters is owned by the default layer`) and are written
to be read.

### Deliberately absent

- **Delete.** The service exposes publish only. The page says so, the way the README
  already documents the layer-gating gap, rather than offering a control that cannot work.
- **The `default` layer.** `.github/workflows/translations.yml` publishes it on every merge
  to `master`, so a hand edit here is reverted by the next merge.
- **Descriptions and parameters.** The service rejects them outside `default`.

### The token

Pasted into a `type="password"` field, held in React state, dropped on route change. Never
in the query string, `localStorage` or `sessionStorage`, and never logged. The app deploys
with `security: none`, so anyone can open `#/admin`; it is inert without a token holding
`trs.translation.publish`, and a note on the page says as much.

## 3. Seed files reject on publish

`seed/managed/fi-FI.json` and `seed/managed/sv-SE.json` carry `"parameters": [...]` on
their parameterised keys. `defaultOwnedFieldViolations` rejects that field outside the
`default` layer, so `scripts/publish-seed-layers.sh` would fail with a 422 today. It has
never run — the README records that no CI identity holds the role it needs.

The admin page is that script's interactive equivalent, so the files are corrected here:
drop `parameters`, keep `value` and `plural.forms`.

## Testing

`options.test.ts` asserts `load === "currentOnly"`, and a test asserts that initialising
with `sv-SE` requests `sv-SE` and never bare `sv`.

Admin tests follow `App.test.tsx`: stub `fetch`, assert method, URL, `Authorization` header
and request body; assert the token reaches neither storage nor the URL; assert a 422 body
renders its violations; assert the plural inputs for a tag match that language's
categories. TDD throughout — the failing test first.

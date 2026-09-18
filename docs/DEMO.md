# Demo: how a translation reaches the app

A word changes in this repository, a GitHub Action publishes it, and the deployed app shows
it — without a redeploy being what delivered the text. That last part is the point: the app
and its wording ship on separate tracks.

**App:** https://translation-demo.retailsvc.com
**Module:** `trs-demo-app` on https://translation.retailsvc.com

## Before you start

**Open the app in a fresh private window.** Reads come back
`Cache-Control: public, max-age=300`, and `i18next-http-backend` uses plain `fetch`, which
honours it. A tab that already loaded the page will not ask again for five minutes, and
pressing reload will not change that — there is no cache-busting code here on purpose. A
private window has no cache to hit.

Have two tabs ready: the app, and the repository's Actions tab.

## The loop

### 1. Show where the words live

[`translations/en-US.json`](../translations/en-US.json) — 12 keys, each with a value and a
description written for whoever translates it. That file is the module's key set: the
English wording it ships with, and the only keys any other language is allowed to carry.

### 2. Open a pull request that changes one word

The `Translations` workflow runs as a dry run and reports what a real run would do:

```
Loaded 12 entries from translations/en-US.json
Dry run: would publish the default layer for trs-demo-app to https://translation.retailsvc.dev.
```

Two lines, about 20 seconds. Nothing is published.

Be careful what you claim for this step. Per [the publishing
guide](https://github.com/extenda/engineering-cloud-core-common/blob/master/docs/translation-service/public/integration/PUBLISHING-FROM-CI.md),
a dry run reports publish-or-skip **and nothing more** — validation happens on publish, so
a file that will be rejected with `422` passes a dry run silently. It tells a reviewer that
a real run would publish. It does not tell anyone the content is good.

### 3. Merge

Two workflows run:

| Workflow | What it does | Roughly |
| --- | --- | --- |
| `Translations` | publishes the `default` layer to staging, then production, then reads it back anonymously and asserts the copy is live | ~2 min |
| `Build and Deploy` | builds, tests, pushes the image, attests it and deploys to Cloud Run | ~3 min |

The read-back step is the part worth showing. It is not a log line claiming success — it
fetches the module as any anonymous client would and asserts the response is the resolved
file and that the plural key came back as compiled ICU:

```bash
body=$(curl -sf "$HOST/api/v1/modules/trs-demo-app/translations/en-US")
echo "$body" | jq -e '.layer == "resolved"'
echo "$body" | jq -e '.entries["cart.count"] | contains("plural")'
```

### 4. Show the wording live

Refresh the app in the private window. The new wording is there.

Worth saying out loud: **the deploy did not carry the text.** You can prove it by reading
the API directly in front of the audience —

```bash
curl -s https://translation.retailsvc.com/api/v1/modules/trs-demo-app/translations/en-US | jq .entries
```

— and pointing out that the app made exactly that request, anonymously, with no token and
no proxy.

## What each layer can and cannot do from CI

Someone always asks why only English publishes from the pipeline.

| Layer | Who authors it | From CI? |
| --- | --- | --- |
| `default` | the module team, in this repository | **yes** — `googletoken.check("trs.translation-api")`, and the cloud-core pipeline accounts are allowed consumers |
| `managed` | product management, for every tenant | **no** — `trs.translation.publish` **and** the caller must be in the Extenda tenant |
| `tenant` | a tenant, for itself | **no** — `trs.translation.publish`, which a GCP service account token does not satisfy |

`check_permission` resolves an Extenda IAM grant for a principal in a tenant. A pipeline
credential is not such a principal, however it is configured, so the pipeline publishes the
English key set and nothing else. That is the design, not a gap in the workflow.

[The publishing page](../README.md#the-publishing-page) at `#/admin` is how the other two
layers get written, with a token from someone who holds the role. It loads a reviewed file
from `seed/` rather than asking anyone to retype one — worth showing, because it is the
answer to "so how does a translator's work actually get in?".

## Timings, so you can talk over the gaps

| Step | Observed |
| --- | --- |
| dry run on a pull request | ~20 s |
| publish to staging and production, with read-back | ~2 min |
| build, attest and deploy | ~3 min |
| until a browser that already loaded the page sees the change | up to 5 min |

The two workflows run in parallel, so a merge to a visible change is about three minutes —
plus the cache, which the private window removes.

## One thing that looks like a bug and is not

`Build and Deploy` refreshes the committed offline bundle by fetching the published file
(`scripts/bundle-translations.sh`, step *Refresh offline bundle*), and it runs **in
parallel** with `Translations`. It reaches that step within about half a minute, while the
publish takes around two — so on the very merge that changes a word, the image almost
always ships the *previous* wording in its offline bundle.

That is harmless and self-correcting: the bundle is what paints first, and the network read
lands on top of it a moment later with the new text. But if you are watching closely you
may catch a flicker of the old wording on first load, and the bundle inside that image
stays stale until the next deploy.

If you would rather not explain that on stage, deploy twice: merge the wording change, let
both workflows finish, then re-run `Build and Deploy` so the bundle matches. The second run
takes about three minutes and changes nothing else.

## If the network fails on stage

The app renders from `src/offline/trs-demo-app.en-US.json`, a committed copy of the
published file, and only then fetches over the top of it. A dead connection shows real
text rather than raw keys. That is also a fine thing to demonstrate deliberately: open the
app with devtools offline and note that the words are still there.

## What this demo does not show

- **A tenant's own language.** `GET /modules/{id}/language-tags` covers the `default` and
  `managed` layers only, so a language a tenant publishes for itself is never listed. Reach
  one by naming it in the address:
  [`?tenant=CIR7nQwtS0rA6t0S6ejd&lang=sv-SE`](https://translation-demo.retailsvc.com/?tenant=CIR7nQwtS0rA6t0S6ejd&lang=sv-SE).
- **Deleting a language.** The service exposes publish only. There is no endpoint for it.

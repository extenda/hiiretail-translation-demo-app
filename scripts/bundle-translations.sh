#!/usr/bin/env bash
# Fetch the published files at build time so a first launch has text before it has network.
# Run in CI before packaging; the output is committed so a fresh clone works offline too.
set -euo pipefail

MODULE=trs-demo-app
HOST=${TRS_HOST:-https://translation.retailsvc.com}
OUT=src/offline

if [ "$#" -eq 0 ]; then
  echo "usage: $0 <lang-tag> [lang-tag...]" >&2
  exit 64
fi

mkdir -p "$OUT"
for TAG in "$@"; do
  # -f so a 404 (nothing published yet) fails loudly instead of bundling an error body.
  # .entries so we bundle the flat map `resources` needs, not the whole envelope.
  curl -fsS "${HOST}/api/v1/modules/${MODULE}/translations/${TAG}" \
    | jq '.entries' > "${OUT}/${MODULE}.${TAG}.json"
  echo "bundled ${TAG}"
done

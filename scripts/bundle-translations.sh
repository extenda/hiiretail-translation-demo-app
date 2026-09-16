#!/usr/bin/env bash
# Fetch the published files at build time so a first launch has text before it has network.
# Run in CI before packaging; the output is committed so a fresh clone works offline too.
set -euo pipefail

MODULE=trs-demo-app
HOST=${TRS_HOST:-https://translation.retailsvc.com}
OUT=${TRS_OUT:-src/offline}

if [ "$#" -eq 0 ]; then
  echo "usage: $0 <lang-tag> [lang-tag...]" >&2
  exit 64
fi

mkdir -p "$OUT"

# Fetch into a temp file and move it into place only once it holds a whole document.
# Redirecting straight at the target would truncate it before curl even runs, so a 404 —
# the module not published yet, say — would destroy the committed copy that exists
# precisely to survive a failed fetch, and the build would then read an empty file.
failed=0
for TAG in "$@"; do
  TMP=$(mktemp)
  # -f so a 404 fails loudly instead of bundling an error body. .entries so we bundle the
  # flat map `resources` needs, not the whole envelope; -e so a null one is a failure too.
  if curl -fsS "${HOST}/api/v1/modules/${MODULE}/translations/${TAG}" \
    | jq -e '.entries' > "$TMP"; then
    mv "$TMP" "${OUT}/${MODULE}.${TAG}.json"
    echo "bundled ${TAG}"
  else
    rm -f "$TMP"
    echo "could not refresh ${TAG}; keeping the committed copy" >&2
    failed=1
  fi
done

exit "$failed"

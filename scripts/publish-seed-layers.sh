#!/usr/bin/env bash
# Publishes the managed and tenant layers.
#
# NOT runnable by CI. These layers are gated on check_permission("trs.translation.publish"),
# an Extenda IAM grant resolved for a principal in a tenant — a GCP service account token
# does not satisfy it, so the pipeline's credential cannot publish them. Run this by hand
# with a token from a principal holding the Translation Admin role:
#
#   TRS_TOKEN=... ./scripts/publish-seed-layers.sh
set -euo pipefail

MODULE=trs-demo-app
HOST=${TRS_HOST:-https://translation.retailsvc.com}
TENANT=${TRS_SEED_TENANT:-demo-tenant}
: "${TRS_TOKEN:?set TRS_TOKEN to a token holding trs.translation.publish}"

# The seed files are flat key maps, matching the shape a read answers under `entries`. A
# publish body is the envelope around that map, so wrap it here rather than storing the
# same translations twice in two shapes.
publish() {
  local url=$1 file=$2
  jq '{entries: .}' "$file" \
    | curl -fsS -X PUT "$url" \
      -H "Authorization: Bearer ${TRS_TOKEN}" \
      -H "Content-Type: application/json" \
      --data-binary @- > /dev/null
  echo "published ${file} -> ${url}"
}

for file in seed/managed/*.json; do
  tag=$(basename "$file" .json)
  publish "${HOST}/api/v1/modules/${MODULE}/translations/${tag}/layers/managed" "$file"
done

for file in "seed/tenant/${TENANT}"/*.json; do
  tag=$(basename "$file" .json)
  publish "${HOST}/api/v1/modules/${MODULE}/translations/${tag}/layers/tenant" "$file"
done

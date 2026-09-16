import { expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BUNDLE = "src/offline/trs-demo-app.en-US.json";

/*
 * The committed bundle is the app's offline fallback, so a refresh that cannot reach the
 * service must leave it exactly as it was. A plain `curl ... > file` does not: the shell
 * truncates the file before curl runs, so a 404 empties the very file that exists to
 * survive one. That failure is invisible in CI, where the step is `continue-on-error`, and
 * surfaces as `EOF while parsing a value` when vite reads the empty JSON.
 */
function refreshInto(dir) {
  return spawnSync("./scripts/bundle-translations.sh", ["en-US"], {
    // Port 1 refuses immediately, so this exercises the failed-fetch path without a network.
    env: { ...process.env, TRS_HOST: "http://127.0.0.1:1", TRS_OUT: dir },
    encoding: "utf8",
  });
}

it("keeps the committed bundle when the service cannot be reached", () => {
  const dir = mkdtempSync(join(tmpdir(), "trs-bundle-"));
  const target = join(dir, "trs-demo-app.en-US.json");
  const committed = readFileSync(BUNDLE, "utf8");
  writeFileSync(target, committed);

  refreshInto(dir);

  expect(readFileSync(target, "utf8")).toBe(committed);
});

it("reports the failure so a refresh never passes silently", () => {
  const dir = mkdtempSync(join(tmpdir(), "trs-bundle-"));
  writeFileSync(join(dir, "trs-demo-app.en-US.json"), readFileSync(BUNDLE, "utf8"));

  expect(refreshInto(dir).status).not.toBe(0);
});

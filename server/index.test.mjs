import { afterAll, beforeAll, expect, it } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "./index.mjs";

const root = mkdtempSync(join(tmpdir(), "trs-demo-"));
writeFileSync(join(root, "index.html"), "<h1>root</h1>");
writeFileSync(join(root, "app.js"), "export const a = 1;");

let server;
let base;

beforeAll(async () => {
  server = createServer(root);
  await new Promise((resolve) => server.listen(0, resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

afterAll(() => new Promise((resolve) => server.close(resolve)));

it("serves index.html at the root", async () => {
  const res = await fetch(`${base}/`);
  expect(res.status).toBe(200);
  expect(await res.text()).toContain("root");
});

it("serves a static asset with a javascript content type", async () => {
  const res = await fetch(`${base}/app.js`);
  expect(res.status).toBe(200);
  expect(res.headers.get("content-type")).toContain("javascript");
});

it("falls back to index.html for an unknown path so client routing works", async () => {
  const res = await fetch(`${base}/anything`);
  expect(res.status).toBe(200);
  expect(await res.text()).toContain("root");
});

it("refuses to escape the served root", async () => {
  const res = await fetch(`${base}/../secret`);
  expect(res.status).toBeLessThan(500);
  expect(await res.text()).not.toContain("secret");
});

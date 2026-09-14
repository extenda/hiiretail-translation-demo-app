import { createServer as createHttpServer } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".woff2": "font/woff2",
};

async function resolveFile(root, urlPath) {
  // normalize collapses any ../ before we join, so a request cannot escape the root.
  const candidate = resolve(root, "." + normalize(urlPath));
  if (candidate !== root && !candidate.startsWith(root + "/")) {
    return join(root, "index.html");
  }

  try {
    const info = await stat(candidate);
    if (info.isFile()) return candidate;
  } catch {
    // Not a file on disk — fall through to the single page entry point.
  }

  return join(root, "index.html");
}

export function createServer(root) {
  const served = resolve(root);

  return createHttpServer(async (req, res) => {
    const urlPath = new URL(req.url, "http://localhost").pathname;
    const file = await resolveFile(served, urlPath === "/" ? "/index.html" : urlPath);

    res.setHeader("Content-Type", TYPES[extname(file)] ?? "application/octet-stream");
    res.statusCode = 200;
    createReadStream(file).pipe(res);
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT ?? 8080);
  createServer(process.env.PUBLIC_HTML ?? "/var/www").listen(port, () => {
    console.log(`serving on ${port}`);
  });
}

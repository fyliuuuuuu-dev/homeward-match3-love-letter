import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, extname, normalize, resolve, sep } from "node:path";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
export const rootDirectory = resolve(scriptDirectory, "..");

const contentTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml; charset=utf-8"],
  [".md", "text/markdown; charset=utf-8"]
]);

function safePath(urlPath, root) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const relative = normalize(decoded === "/" ? "index.html" : decoded.replace(/^\/+/, ""));
  const candidate = resolve(root, relative);
  return candidate === root || candidate.startsWith(`${root}${sep}`) ? candidate : null;
}

export function createStaticServer(root = rootDirectory) {
  return createServer(async (request, response) => {
    if (!request.url || !["GET", "HEAD"].includes(request.method || "")) {
      response.writeHead(405, { Allow: "GET, HEAD" });
      response.end("Method not allowed");
      return;
    }
    const filePath = safePath(request.url, root);
    if (!filePath) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }
    try {
      const info = await stat(filePath);
      if (!info.isFile()) throw new Error("not a file");
      response.writeHead(200, {
        "Content-Type": contentTypes.get(extname(filePath)) || "application/octet-stream",
        "Content-Length": info.size,
        "Cache-Control": "no-store"
      });
      if (request.method === "HEAD") response.end();
      else createReadStream(filePath).pipe(response);
    } catch {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
    }
  });
}

const launchedDirectly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (launchedDirectly) {
  const host = process.env.HOMEWARD_HOST || "127.0.0.1";
  const port = Number(process.env.HOMEWARD_PORT || 8080);
  const server = createStaticServer();
  server.listen(port, host, () => {
    console.log(`Homeward is running at http://${host}:${port}`);
    console.log("Press Ctrl+C to stop.");
  });
}

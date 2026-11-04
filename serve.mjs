import http from "node:http";
import fs from "node:fs";
import path from "node:path";
const root = path.resolve("dist"),
  port = Number(process.env.PORT || 4173);
if (!fs.existsSync(path.join(root, "index.html"))) {
  console.error("Missing dist/. Run npm ci && npm run build first.");
  process.exit(1);
}
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json",
};
http
  .createServer((req, res) => {
    if (!["GET", "HEAD"].includes(req.method)) {
      res.writeHead(405);
      return res.end();
    }
    let pathname;
    try {
      pathname = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
    } catch {
      res.writeHead(400);
      return res.end();
    }
    let file = path.resolve(root, "." + pathname);
    if (file !== root && !file.startsWith(root + path.sep)) {
      res.writeHead(403);
      return res.end();
    }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      if (path.extname(pathname) && !pathname.endsWith(".html")) {
        res.writeHead(404);
        return res.end("Not found");
      }
      file = path.join(root, "index.html");
    }
    res.setHeader(
      "Content-Type",
      types[path.extname(file)] || "application/octet-stream",
    );
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader(
      "Cache-Control",
      path.basename(file) === "sw.js" || file.endsWith(".html")
        ? "no-cache"
        : "public, max-age=3600",
    );
    if (file.endsWith("sw.js")) res.setHeader("Service-Worker-Allowed", "/");
    res.writeHead(200);
    if (req.method === "HEAD") return res.end();
    fs.createReadStream(file).pipe(res);
  })
  .listen(port, "0.0.0.0", () =>
    console.log(
      `Kitab Studio is running at http://localhost:${port}\nKeep the same origin and port to retain access to your local books.\nFor Android installation deploy dist/ to an HTTPS origin.`,
    ),
  );

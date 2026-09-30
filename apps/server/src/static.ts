import { Readable } from "node:stream";
import { realpath, open } from "node:fs/promises";
import { constants } from "node:fs";
import { extname, join, sep } from "node:path";
import type { FastifyInstance } from "fastify";

const TYPES: Record<string, string> = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".webmanifest": "application/manifest+json", ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".jpg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2" };
export function registerFrontend(app: FastifyInstance, directory: string): void {
  app.get("/*", async (request, reply) => {
    let path: string;
    try { path = decodeURIComponent(request.url.split("?")[0]!); } catch { return reply.code(404).send({ ok: false, error: { code: "NOT_FOUND", message: "File not found." } }); }
    const denied = () => reply.code(404).send({ ok: false, error: { code: "NOT_FOUND", message: "File not found." } });
    if (path.includes("\\") || path.includes("\0") || path.split("/").some(part => part.startsWith("."))) return denied();
    if (path === "/") path = "/index.html";
    if (!(["/index.html", "/manifest.webmanifest", "/sw.js", "/favicon.ico", "/icon.svg", "/icons/emily-192.png", "/icons/emily-512.png", "/icons/emily-maskable-512.png"].includes(path) || path.startsWith("/assets/") || /^\/icon-[A-Za-z0-9_-]+\.(png|svg)$/.test(path))) return denied();
    const type = TYPES[extname(path)];
    if (!type) return denied();
    try {
      const root = await realpath(directory);
      const target = await realpath(join(root, path));
      if (!target.startsWith(root + sep)) return denied();
      const file = await open(target, constants.O_RDONLY | constants.O_NOFOLLOW);
      const stat = await file.stat();
      if (!stat.isFile() || stat.size > 20_000_000) { await file.close(); return denied(); }
      reply.header("Content-Type", type).header("Content-Length", stat.size).header("Cache-Control", path.startsWith("/assets/") ? "public, max-age=31536000, immutable" : "no-cache");
      if (request.method === "HEAD") { await file.close(); return reply.send(Readable.from([])); }
      const stream = file.createReadStream();
      reply.raw.once("close", () => stream.destroy());
      return reply.send(stream);
    } catch { return denied(); }
  });
}

import { request as httpsRequest } from "node:https";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { Readable } from "node:stream";
import { lstat, open } from "node:fs/promises";
import { constants } from "node:fs";
import { join } from "node:path";
import type { FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "./errors.js";

const CDN_SUFFIXES = ["music.126.net"];
/** CDN URLs are adapter results, never client input. Upgrade the provider's legacy HTTP URLs. */
export function providerMediaUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 4096) return undefined;
  try {
    const u = new URL(value);
    if (!["https:", "http:"].includes(u.protocol) || u.username || u.password || u.hash || u.port ||
      !CDN_SUFFIXES.some(suffix => u.hostname === suffix || u.hostname.endsWith(`.${suffix}`))) return undefined;
    u.protocol = "https:";
    return u.toString();
  } catch { return undefined; }
}
export function isPublicAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const octets = address.split(".").map(Number);
    const [a = 0, b = 0] = octets;
    return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 168 || b === 0)) || (a === 100 && b >= 64 && b <= 127) ||
      (a === 198 && (b === 18 || b === 19 || b === 51)) || (a === 203 && b === 0));
  }
  if (isIP(address) === 6) {
    const lower = address.toLowerCase();
    // Public global-unicast only; deny mapped/compatible IPv4, link-local, ULA and documentation space.
    return /^[23][0-9a-f]{0,3}:/.test(lower) && !lower.startsWith("2001:db8:") && !lower.startsWith("2001:0:") && !lower.startsWith("2002:");
  }
  return false;
}
export type MediaResult = { status: number; headers: Record<string, string>; stream: Readable };
export type MediaOpener = (url: string, range: string | undefined) => Promise<MediaResult>;

/** Resolve once and pin the chosen public address in TLS lookup to prevent DNS rebinding. */
export async function openProviderMedia(url: string, range: string | undefined, redirects = 0): Promise<MediaResult> {
  const safe = providerMediaUrl(url);
  if (!safe || safe !== url) throw new AppError(502, "UNSAFE_MEDIA_URL", "The provider returned an unsupported media host.");
  const u = new URL(safe);
  let addresses: Awaited<ReturnType<typeof lookup>>[];
  try {
    addresses = await lookup(u.hostname, { all: true, verbatim: true });
    if (!addresses.length || addresses.some(result => !isPublicAddress(result.address))) throw new Error();
  } catch { throw new AppError(502, "UNSAFE_MEDIA_ADDRESS", "The provider media address could not be safely resolved."); }
  const address = addresses[0]!;
  return new Promise<MediaResult>((resolve, reject) => {
    const headers: Record<string, string> = { Accept: "audio/*,application/octet-stream", Referer: "https://music.163.com/" };
    if (range) headers.Range = range;
    const req = httpsRequest(u, {
      headers, method: "GET", family: address.family,
      lookup: (_hostname, options, callback) => {
        if (options.all) callback(null, [address]);
        else callback(null, address.address, address.family);
      }
    }, async response => {
      const status = response.statusCode || 502;
      if ([301, 302, 303, 307, 308].includes(status)) {
        response.resume();
        const location = response.headers.location;
        const next = location ? providerMediaUrl(new URL(location, u).toString()) : undefined;
        if (redirects >= 3 || !next) { reject(new AppError(502, "UNSAFE_MEDIA_REDIRECT", "Provider media redirect was refused.")); return; }
        try { resolve(await openProviderMedia(next, range, redirects + 1)); }
        catch (error) { reject(error); }
        return;
      }
      if (![200, 206, 416].includes(status)) {
        response.resume();
        reject(new AppError(502, "MEDIA_UNAVAILABLE", "Provider audio is unavailable or its URL has expired."));
        return;
      }
      const type = response.headers["content-type"] || "application/octet-stream";
      const length = response.headers["content-length"];
      if (status !== 416 && (!/^(audio\/[^\r\n;]+|application\/octet-stream)(?:;.*)?$/i.test(type) || (length && (!/^\d+$/.test(length) || Number(length) > 150_000_000)))) {
        response.destroy();
        reject(new AppError(502, "INVALID_MEDIA_RESPONSE", "The provider returned an invalid audio response."));
        return;
      }
      const output: Record<string, string> = { "content-type": status === 416 ? "application/octet-stream" : type, "accept-ranges": "bytes" };
      if (length && /^\d+$/.test(length)) output["content-length"] = length;
      const contentRange = response.headers["content-range"];
      if (contentRange && /^bytes (?:\d+-\d+\/\d+|\*\/\d+)$/.test(contentRange)) output["content-range"] = contentRange;
      if (status === 206 && !output["content-range"]) {
        response.destroy(); reject(new AppError(502, "INVALID_MEDIA_RESPONSE", "The provider omitted its partial-audio range.")); return;
      }
      resolve({ status, headers: output, stream: response });
    });
    req.setTimeout(30_000, () => req.destroy(new Error("Media timeout")));
    const initialTimeout = setTimeout(() => req.destroy(new Error("Media timeout")), 15_000);
    req.once("response", () => clearTimeout(initialTimeout));
    req.once("error", () => { clearTimeout(initialTimeout); reject(new AppError(502, "MEDIA_UNAVAILABLE", "Provider audio could not be streamed.")); });
    req.end();
  });
}
export function validateRange(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.length > 64 || !/^bytes=(?:\d{1,12}-\d{0,12}|-\d{1,12})$/.test(value)) {
    throw new AppError(416, "INVALID_RANGE", "Only a single valid byte range is supported.");
  }
  const [start = "", end = ""] = value.slice(6).split("-");
  if ((!start && Number(end) === 0) || (start && end && Number(end) < Number(start))) throw new AppError(416, "INVALID_RANGE", "Invalid byte range.");
  return value;
}
export async function sendLocalAudio(directory: string, id: string, request: FastifyRequest, reply: FastifyReply): Promise<unknown> {
  if (!/^[a-f0-9]{64}$/.test(id)) throw new AppError(404, "AUDIO_NOT_FOUND", "DJ audio was not found.");
  const range = validateRange(request.headers.range);
  const path = join(directory, `${id}.mp3`);
  let file;
  let before;
  try {
    // O_NOFOLLOW is not implemented by Windows; inspect the entry as well as the handle.
    before = await lstat(path);
    if (before.isSymbolicLink() || !before.isFile()) throw new Error();
    file = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
  } catch { throw new AppError(404, "AUDIO_NOT_FOUND", "DJ audio was not found or is no longer cached."); }
  const stat = await file.stat();
  const after = await lstat(path).catch(() => undefined);
  if (!after || after.isSymbolicLink() || before.dev !== stat.dev || before.ino !== stat.ino ||
    after.dev !== stat.dev || after.ino !== stat.ino || !stat.isFile() || stat.size === 0 || stat.size > 10_000_000) {
    await file.close(); throw new AppError(404, "AUDIO_NOT_FOUND", "DJ audio was not found.");
  }
  let start = 0;
  let end = stat.size - 1;
  if (range) {
    const [s = "", e = ""] = range.slice(6).split("-");
    if (!s) start = Math.max(0, stat.size - Number(e));
    else { start = Number(s); if (e) end = Math.min(end, Number(e)); }
    if (start >= stat.size || end < start) {
      await file.close(); return reply.code(416).header("Content-Range", `bytes */${stat.size}`).send();
    }
    reply.code(206).header("Content-Range", `bytes ${start}-${end}/${stat.size}`);
  }
  reply.header("Content-Type", "audio/mpeg").header("Accept-Ranges", "bytes").header("Content-Length", end - start + 1);
  if (request.method === "HEAD") { await file.close(); return reply.send(Readable.from([])); }
  const stream = file.createReadStream({ start, end });
  reply.raw.once("close", () => stream.destroy());
  return reply.send(stream);
}

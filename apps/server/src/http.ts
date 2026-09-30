import { AppError, asRecord } from "./errors.js";

/** POST only: credentials stay out of adapter URLs/access logs. Redirects are never followed. */
export async function postJson(base: string, path: string, body: unknown, timeoutMs: number, token?: string): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(new URL(path, base), { method: "POST", headers, body: JSON.stringify(body), redirect: "error", signal: controller.signal });
    if (!response.ok) {
      if ([401, 403].includes(response.status)) throw new AppError(502, "PROVIDER_AUTH_FAILED", "The configured provider rejected authentication.");
      throw new AppError(502, "PROVIDER_UNAVAILABLE", "The configured provider is unavailable. Try again later.");
    }
    if (!response.body) throw new Error();
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 4_000_000) throw new Error();
        chunks.push(value);
      }
    } finally { await reader.cancel().catch(() => undefined); }
    const value: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error();
    return asRecord(value);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(502, controller.signal.aborted ? "PROVIDER_TIMEOUT" : "PROVIDER_UNAVAILABLE", controller.signal.aborted ? "The configured provider timed out." : "The configured provider returned no usable response.");
  } finally { clearTimeout(timer); }
}

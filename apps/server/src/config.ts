import { resolve, dirname, basename, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";

export const ENGLISH_FEMALE_VOICES = [
  "en-US-EmmaMultilingualNeural", "en-US-EmmaNeural", "en-US-JennyNeural",
  "en-US-AriaNeural", "en-GB-SoniaNeural", "en-IE-EmilyNeural", "en-AU-NatashaNeural"
] as const;
export const DEFAULT_VOICE = ENGLISH_FEMALE_VOICES[0];
export type AppConfig = {
  dataDir: string;
  ownerPassword: string | undefined;
  publicOrigin: string | undefined;
  sessionTtlMs: number;
  credentialKey: Buffer | undefined;
  neteaseBase: string | undefined;
  neteaseToken: string | undefined;
  neteaseCookie: string | undefined;
  modelBase: string | undefined;
  modelKey: string | undefined;
  modelName: string | undefined;
  httpTimeoutMs: number;
  ttsEnabled: boolean;
  ttsCommand: string;
  ttsTimeoutMs: number;
  voice: string;
  webDir: string | undefined;
  port: number;
  host: string;
};

function numberEnv(env: NodeJS.ProcessEnv, name: string, fallback: number, min: number, max: number): number {
  const raw = env[name];
  if (raw === undefined || raw === "") return fallback;
  if (!/^\d+$/.test(raw)) throw new Error(`Invalid ${name}.`);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new Error(`Invalid ${name}.`);
  return value;
}

export function isLoopbackHost(hostname: string): boolean {
  return ["localhost", "127.0.0.1", "[::1]", "::1"].includes(hostname.toLowerCase());
}

/** Operator-only configuration; request bodies never influence these origins. */
function apiBase(raw: string | undefined, name: string): string | undefined {
  if (!raw) return undefined;
  try {
    const u = new URL(raw);
    if (u.username || u.password || u.search || u.hash || !u.hostname ||
      !(u.protocol === "https:" || (u.protocol === "http:" && isLoopbackHost(u.hostname)))) throw new Error();
    if (u.pathname.includes("//") || /%2f|%5c|%2e/i.test(u.pathname)) throw new Error();
    return `${u.origin}${u.pathname.replace(/\/$/, "")}/`;
  } catch { throw new Error(`Invalid ${name}: use HTTPS, or HTTP on loopback only, with no credentials/query.`); }
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const publicBase = apiBase(env.EMILY_PUBLIC_ORIGIN, "EMILY_PUBLIC_ORIGIN");
  if (publicBase && new URL(publicBase).pathname !== "/") throw new Error("EMILY_PUBLIC_ORIGIN must be an origin only.");
  const password = env.EMILY_OWNER_PASSWORD || undefined;
  if (password && (password.length < 12 || password.length > 1024)) throw new Error("EMILY_OWNER_PASSWORD must be 12–1024 characters.");
  let credentialKey: Buffer | undefined;
  if (env.EMILY_CREDENTIAL_KEY) {
    if (!/^[a-fA-F0-9]{64}$/.test(env.EMILY_CREDENTIAL_KEY)) throw new Error("EMILY_CREDENTIAL_KEY must be 64 hex characters.");
    credentialKey = Buffer.from(env.EMILY_CREDENTIAL_KEY, "hex");
  }
  const voice = env.EMILY_TTS_VOICE || DEFAULT_VOICE;
  if (!(ENGLISH_FEMALE_VOICES as readonly string[]).includes(voice)) throw new Error("EMILY_TTS_VOICE is not an allowlisted English female voice.");
  const ttsCommand = env.EMILY_TTS_COMMAND || "uvx";
  const executableName = basename(ttsCommand).toLowerCase();
  const absoluteExecutable = isAbsolute(ttsCommand) && !/[\0\r\n]/.test(ttsCommand) &&
    ["uvx", "edge-tts", ...(process.platform === "win32" ? ["uvx.exe", "edge-tts.exe"] : [])].includes(executableName);
  if (!(ttsCommand === "uvx" || ttsCommand === "edge-tts" || absoluteExecutable)) {
    throw new Error("EMILY_TTS_COMMAND must be uvx, edge-tts, or their absolute executable path.");
  }
  if (env.EMILY_TTS_ENABLED && !["true", "false"].includes(env.EMILY_TTS_ENABLED)) throw new Error("Invalid EMILY_TTS_ENABLED.");
  const defaultData = resolve(dirname(fileURLToPath(import.meta.url)), "../data");
  return {
    dataDir: resolve(env.EMILY_DATA_DIR || defaultData), ownerPassword: password,
    publicOrigin: publicBase ? new URL(publicBase).origin : undefined,
    sessionTtlMs: numberEnv(env, "EMILY_SESSION_TTL_SECONDS", 43_200, 300, 604_800) * 1000,
    credentialKey, neteaseBase: apiBase(env.EMILY_NETEASE_API_BASE, "EMILY_NETEASE_API_BASE"),
    neteaseToken: env.EMILY_NETEASE_API_TOKEN || undefined, neteaseCookie: env.EMILY_NETEASE_COOKIE || undefined,
    modelBase: apiBase(env.EMILY_MODEL_BASE_URL, "EMILY_MODEL_BASE_URL"),
    modelKey: env.EMILY_MODEL_API_KEY || undefined, modelName: env.EMILY_MODEL_NAME || undefined,
    httpTimeoutMs: numberEnv(env, "EMILY_HTTP_TIMEOUT_MS", 12_000, 100, 60_000),
    ttsEnabled: env.EMILY_TTS_ENABLED !== "false", ttsCommand,
    ttsTimeoutMs: numberEnv(env, "EMILY_TTS_TIMEOUT_MS", 25_000, 100, 120_000), voice,
    webDir: env.EMILY_WEB_DIST_DIR ? resolve(env.EMILY_WEB_DIST_DIR) : undefined,
    port: numberEnv(env, "EMILY_PORT", 3000, 0, 65_535), host: env.EMILY_HOST || "127.0.0.1"
  };
}

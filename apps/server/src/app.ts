import { Readable } from "node:stream";
import fastify, { type FastifyInstance } from "fastify";
import { MAX_PROGRAMME_TRACKS } from "@emily/shared";
import type { ApiResponse, AuthSession, FeedbackRequest, ProgrammeRequest, ListeningRequest, RadioSettings, SetupStatus } from "@emily/shared";
const EMILY_VERSION = "0.3.0-dev";
import { loadConfig, FEMALE_VOICES, type AppConfig } from "./config.js";
import { Store } from "./store.js";
import { OwnerAuth } from "./auth.js";
import { NeteaseAdapter } from "./netease.js";
import { ProgrammeSelector } from "./model.js";
import { ListeningConversation } from "./conversation.js";
import { EdgeTts, type TtsPort } from "./tts.js";
import { Radio } from "./radio.js";
import { AppError, fail } from "./errors.js";
import { openProviderMedia, providerMediaUrl, sendLocalAudio, validateRange, type MediaOpener } from "./media.js";
import { registerFrontend } from "./static.js";

export type AppOptions = {
  env?: NodeJS.ProcessEnv;
  config?: AppConfig;
  clock?: () => number;
  /** Explicit test seams; the production entrypoint never sets these. */
  tts?: TtsPort;
  mediaOpener?: MediaOpener;
  logger?: boolean;
};
export type EmilyApp = FastifyInstance & { services: { store: Store; auth: OwnerAuth; radio: Radio; music: NeteaseAdapter } };
const success = <T>(data: T): ApiResponse<T> => ({ ok: true, data });
const objectSchema = (properties: Record<string, unknown>, required: string[] = []) => ({ type: "object", additionalProperties: false, properties, required });
const idSchema = { type: "string", pattern: "^[1-9][0-9]{0,17}$" };
const qrSchema = { type: "string", pattern: "^[a-f0-9]{64}$" };
const textSchema = (maxLength: number) => ({ type: "string", minLength: 1, maxLength, pattern: "^[^\\u0000-\\u001f\\u007f]+$" });
const emptyQuery = objectSchema({});
const emptyBody = objectSchema({});

/** Constructing/importing an app never binds a listener. */
export function buildApp(options: AppOptions = {}): EmilyApp {
  const config = options.config || loadConfig(options.env);
  const clock = options.clock || Date.now;
  const app = fastify({
    logger: options.logger ?? false, disableRequestLogging: true,
    bodyLimit: 16_384, requestTimeout: 30_000, connectionTimeout: 150_000,
    trustProxy: false, ajv: { customOptions: { removeAdditional: false, coerceTypes: false, useDefaults: false } }
  }) as unknown as EmilyApp;
  const store = new Store(config.dataDir, config.credentialKey);
  const auth = new OwnerAuth(config, store, clock);
  const music = new NeteaseAdapter(config, store, clock);
  const selector = new ProgrammeSelector(config);
  const conversation = new ListeningConversation(config, music, store);
  const tts = options.tts || new EdgeTts(config, clock);
  const radio = new Radio(config, store, music, selector, tts, clock);
  const mediaOpener = options.mediaOpener || openProviderMedia;
  app.decorate("services", { store, auth, music, radio });
  app.addHook("onClose", async () => { await conversation.close(); await radio.close(); store.close(); });
  app.addHook("preValidation", async request => {
    // Empty action bodies are optional in the wire contract; explicit null/non-object bodies still fail.
    if (["POST", "PATCH"].includes(request.method) && request.body === undefined) request.body = {};
  });

  app.addHook("onRequest", async (request, reply) => {
    reply.header("X-Content-Type-Options", "nosniff").header("Referrer-Policy", "no-referrer");
    if (!request.url.startsWith("/api/")) return;
    reply.header("Cache-Control", "private, no-store");
    auth.checkOrigin(request);
    const publicRoutes = ["/api/health", "/api/session", "/api/login", "/api/logout"];
    if (!publicRoutes.includes(request.routeOptions.url || "")) auth.require(request);
    const route = request.routeOptions.url || "";
    if (["/api/setup", "/api/music/playlists", "/api/music/search", "/api/music/lyrics/:id"].includes(route) && !store.takeRate("provider-read", 90, 60_000, clock())) {
      throw new AppError(429, "PROVIDER_RATE_LIMITED", "Please wait before making another provider request.");
    }
    if (route === "/api/conversation" && !store.takeRate("conversation", 12, 300_000, clock())) {
      throw new AppError(429, "CONVERSATION_RATE_LIMITED", "请稍等再继续对话选曲。");
    }
    if (route === "/api/programme" && !store.takeRate("programme", 8, 300_000, clock())) {
      throw new AppError(429, "PROGRAMME_RATE_LIMITED", "Please wait before creating another programme.");
    }
  });
  const setup = async (): Promise<SetupStatus> => {
    const [musicStatus, available] = await Promise.all([music.status(), tts.available(radio.settings().voice)]);
    return { music: musicStatus, model: { configured: selector.configured }, tts: { available, voice: radio.settings().voice, language: radio.settings().hostLanguage } };
  };
  app.get("/api/health", { schema: { querystring: emptyQuery } }, async () => success({ status: "ok" as const, version: EMILY_VERSION }));
  app.get("/api/session", { schema: { querystring: emptyQuery } }, async request => success(auth.session(request)));
  app.post<{ Body: { password: string } }>("/api/login", { schema: { body: objectSchema({ password: { type: "string", minLength: 1, maxLength: 1024 } }, ["password"]), querystring: emptyQuery } }, async (request, reply): Promise<ApiResponse<AuthSession>> => success(auth.login(request.body.password, request, reply)));
  app.post("/api/logout", { schema: { body: emptyBody, querystring: emptyQuery } }, async (request, reply) => success(auth.logout(request, reply)));
  app.get("/api/setup", { schema: { querystring: emptyQuery } }, async () => success(await setup()));
  app.get("/api/settings", { schema: { querystring: emptyQuery } }, async () => success(radio.settings()));
  app.patch<{ Body: Partial<RadioSettings> }>("/api/settings", {
    schema: { body: { ...objectSchema({
      hostLanguage: { enum: ["en", "zh"], type: "string" }, voice: { type: "string", enum: [...FEMALE_VOICES] },
      djEnabled: { type: "boolean" }, discovery: { type: "boolean" }, mood: textSchema(160), volume: { type: "number", minimum: 0, maximum: 1 }
    }), minProperties: 1 }, querystring: emptyQuery }
  }, async request => success(radio.updateSettings(request.body)));
  app.post("/api/music/login/qr", { schema: { body: emptyBody, querystring: emptyQuery } }, async request => success(await music.createQr(auth.require(request))));
  app.get<{ Params: { key: string } }>("/api/music/login/qr/:key", { schema: { params: objectSchema({ key: qrSchema }, ["key"]), querystring: emptyQuery } }, async request => success(await music.pollQr(request.params.key, auth.require(request))));
  app.post("/api/music/disconnect", { schema: { body: emptyBody, querystring: emptyQuery } }, async () => radio.exclusive(async () => { music.disconnect(); radio.clear(); return success(await setup()); }));
  app.get("/api/music/playlists", { schema: { querystring: emptyQuery } }, async () => success({ items: await music.playlists() }));
  app.get<{ Querystring: { q: string } }>("/api/music/search", { schema: { querystring: objectSchema({ q: textSchema(120) }, ["q"]) } }, async request => {
    const query = request.query.q.trim();
    if (!query) throw new AppError(400, "INVALID_INPUT", "Search text must not be empty.");
    return success({ items: await music.search(query) });
  });
  app.get<{ Params: { id: string } }>("/api/music/lyrics/:id", { schema: { params: objectSchema({ id: idSchema }, ["id"]), querystring: emptyQuery } }, async request => {
    if (!store.track(request.params.id)) throw new AppError(404, "TRACK_NOT_FOUND", "Lyrics are available only for the owner's real catalogue.");
    return success(await music.lyrics(request.params.id));
  });
  app.post<{ Body: ProgrammeRequest }>("/api/programme", {
    schema: { body: objectSchema({ playlistId: idSchema, trackIds: { type: "array", minItems: 1, maxItems: 100, uniqueItems: true, items: idSchema }, prompt: textSchema(600), limit: { type: "integer", minimum: 1, maximum: MAX_PROGRAMME_TRACKS }, roaming: { type: "boolean" }, ordered: { type: "boolean" } }), querystring: emptyQuery }
  }, async request => {
    const body = request.body || {};
    if (body.playlistId && body.trackIds) throw new AppError(400, "INVALID_INPUT", "Choose a playlist or explicit tracks, not both.");
    return success(await radio.programme(body));
  });
  app.post<{ Body: ListeningRequest }>("/api/conversation", {
    schema: { body: objectSchema({ messages: { type: "array", minItems: 1, maxItems: 12, items: objectSchema({ role: { type: "string", enum: ["user", "assistant"] }, text: textSchema(800) }, ["role", "text"]) }, context: objectSchema({ prompt: textSchema(600), trackIds: { type: "array", maxItems: MAX_PROGRAMME_TRACKS, uniqueItems: true, items: idSchema } }, ["prompt", "trackIds"]) }, ["messages"]), querystring: emptyQuery }
  }, async request => success(await conversation.respond(request.body, radio.settings())));
  app.get("/api/now", { schema: { querystring: emptyQuery } }, async () => success(radio.now()));
  app.get("/api/queue", { schema: { querystring: emptyQuery } }, async () => success({ items: radio.now().queue }));
  app.post<{ Body: { trackId?: string } }>("/api/player/play", { schema: { body: objectSchema({ trackId: idSchema }), querystring: emptyQuery } }, async request => success(await radio.play(request.body?.trackId)));
  app.post<{ Body: { enabled: boolean } }>("/api/player/roaming", { schema: { body: objectSchema({ enabled: { type: "boolean" } }, ["enabled"]), querystring: emptyQuery } }, async request => success(radio.setRoaming(request.body.enabled)));
  app.post("/api/player/pause", { schema: { body: emptyBody, querystring: emptyQuery } }, async () => success(await radio.pause()));
  app.post("/api/player/next", { schema: { body: emptyBody, querystring: emptyQuery } }, async () => success(await radio.move(1)));
  app.post("/api/player/previous", { schema: { body: emptyBody, querystring: emptyQuery } }, async () => success(await radio.move(-1)));
  app.post<{ Body: FeedbackRequest }>("/api/feedback", { schema: { body: objectSchema({ trackId: idSchema, kind: { type: "string", enum: ["like", "less_like_this"] } }, ["trackId", "kind"]), querystring: emptyQuery } }, async request => {
    if (!store.track(request.body.trackId)) throw new AppError(404, "TRACK_NOT_FOUND", "Feedback is only accepted for a track in your real catalogue.");
    store.feedback(request.body, clock());
    return success({ saved: true as const });
  });
  app.get("/api/history", { schema: { querystring: emptyQuery } }, async () => success({ items: store.history() }));
  app.get<{ Params: { id: string } }>("/api/audio/:id", { schema: { params: objectSchema({ id: qrSchema }, ["id"]), querystring: emptyQuery } }, async (request, reply) => sendLocalAudio(tts.audioDir, request.params.id, request, reply));
  app.get<{ Params: { id: string } }>("/api/media/track/:id", { schema: { params: objectSchema({ id: idSchema }, ["id"]), querystring: emptyQuery } }, async (request, reply) => {
    const range = validateRange(request.headers.range);
    const url = await music.audio(request.params.id);
    if (!providerMediaUrl(url)) throw new AppError(502, "UNSAFE_MEDIA_URL", "The provider returned an unsupported media host.");
    const media = await mediaOpener(url, range);
    reply.code(media.status);
    for (const [name, value] of Object.entries(media.headers)) {
      if (["content-type", "content-length", "content-range", "accept-ranges"].includes(name.toLowerCase())) reply.header(name, value);
    }
    if (request.method === "HEAD") { media.stream.destroy(); return reply.send(Readable.from([])); }
    reply.raw.once("close", () => media.stream.destroy());
    return reply.send(media.stream);
  });
  if (config.webDir) registerFrontend(app, config.webDir);
  app.setNotFoundHandler(async (_request, reply) => reply.code(404).send(fail(new AppError(404, "NOT_FOUND", "Route not found."))));
  app.setErrorHandler(async (error, _request, reply) => {
    if (error instanceof AppError) return reply.code(error.statusCode).send(fail(error));
    const frameworkError = error as { validation?: unknown; statusCode?: number };
    if (frameworkError?.validation || [400, 413, 415].includes(frameworkError?.statusCode || 0)) {
      const status = frameworkError.statusCode || 400;
      return reply.code(status).send(fail(new AppError(status, "INVALID_INPUT", "Request data is invalid or too large.")));
    }
    // Never log raw request objects, cookies, provider response bodies, stderr or error stacks.
    app.log.error({ code: "INTERNAL_ERROR" }, "Unexpected application failure");
    return reply.code(500).send(fail(new AppError(500, "INTERNAL_ERROR", "Unexpected server error.")));
  });
  return app;
}
export const createApp = buildApp;

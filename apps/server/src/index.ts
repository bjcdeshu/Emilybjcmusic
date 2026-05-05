import fastify from "fastify";
import type {
  ApiResponse,
  HealthResponse,
  NowPlayingState,
  PlayerActionResponse,
  PlayRequest,
  QueueResponse
} from "@emily/shared";
import { getNow, getQueue, next, pause, play } from "./mockState.js";

const EMILY_VERSION = "0.2.0";

const app = fastify({
  logger: true
});

app.get("/api/health", async (): Promise<ApiResponse<HealthResponse>> => {
  return {
    ok: true,
    data: {
      status: "ok",
      version: EMILY_VERSION
    }
  };
});

app.get("/api/now", async (): Promise<ApiResponse<NowPlayingState>> => {
  return {
    ok: true,
    data: getNow()
  };
});

app.get("/api/queue", async (): Promise<ApiResponse<QueueResponse>> => {
  return {
    ok: true,
    data: getQueue()
  };
});

app.post<{ Body: PlayRequest }>(
  "/api/player/play",
  async (request): Promise<ApiResponse<PlayerActionResponse>> => {
    return {
      ok: true,
      data: play(request.body ?? {})
    };
  }
);

app.post("/api/player/pause", async (): Promise<ApiResponse<PlayerActionResponse>> => {
  return {
    ok: true,
    data: pause()
  };
});

app.post("/api/player/next", async (): Promise<ApiResponse<PlayerActionResponse>> => {
  return {
    ok: true,
    data: next()
  };
});

app.setNotFoundHandler(async () => {
  return {
    ok: false,
    error: {
      code: "NOT_FOUND",
      message: "Route not found."
    }
  };
});

app.setErrorHandler(async (error, _request, reply) => {
  app.log.error(error);
  return reply.status(500).send({
    ok: false,
    error: {
      code: "INTERNAL_ERROR",
      message: "Unexpected server error."
    }
  });
});

const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const host = process.env.HOST ?? "0.0.0.0";

try {
  await app.listen({ port, host });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}

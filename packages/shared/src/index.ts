export type ApiSuccess<T> = {
  ok: true;
  data: T;
};

export type ApiFailure = {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export type HealthResponse = {
  status: "ok";
  version: string;
};

export type Track = {
  id: string;
  title: string;
  artist: string;
  album?: string;
  coverUrl?: string;
  audioUrl?: string;
  source: "netease" | "local" | "unknown";
  durationMs?: number;
};

export type QueueItem = {
  id: string;
  track: Track;
  reason?: string;
  requestedBy: "model" | "user" | "fallback";
  status: "pending" | "resolved" | "failed" | "played";
};

export type DjSegment = {
  id: string;
  text: string;
  audioUrl?: string;
  status: "text_only" | "tts_pending" | "tts_ready" | "tts_failed";
  createdAt: string;
};

export type NowPlayingState = {
  status: "idle" | "playing" | "paused" | "loading" | "error";
  track?: Track;
  dj?: DjSegment;
  queue: QueueItem[];
  startedAt?: string;
  positionMs?: number;
  updatedAt: string;
};

export type QueueResponse = {
  items: QueueItem[];
};

export type PlayerActionResponse = {
  now: NowPlayingState;
};

export type PlayRequest = {
  trackId?: string;
};

export const EMILY_VERSION = "0.2.0";

export type ApiSuccess<T> = { ok: true; data: T };
export type ApiFailure = { ok: false; error: { code: string; message: string; details?: unknown } };
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;
export type HealthResponse = { status: "ok"; version: string };

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
  language?: "en" | "zh";
  voice?: string;
};
export type NowPlayingState = {
  status: "idle" | "playing" | "paused" | "loading" | "error";
  track?: Track;
  dj?: DjSegment;
  queue: QueueItem[];
  startedAt?: string;
  positionMs?: number;
  updatedAt: string;
  programmeTitle?: string;
  /** Opaque programme identity; metadata updates never become transport actions. */
  programmeId?: string;
  roaming?: { enabled: boolean; scope: "playlist"; preparing: boolean; message?: string };
  warning?: string;
};
export type QueueResponse = { items: QueueItem[] };
export type PlayerActionResponse = { now: NowPlayingState };
export type PlayRequest = { trackId?: string };
export const MAX_QUEUE_ITEMS = 48;
export type QueueAddRequest = { trackId: string; programmeId: string; /** Optional owner wording, volatile until intro preparation; never saved as chat. */ listenerNote?: string };
export type QueueAddResponse = PlayerActionResponse & { track: Track; outcome: "added" | "already_present"; message: string };
export type VoicePreviewResponse = { segment: DjSegment };

export type AuthSession = { authenticated: boolean; configured: boolean };
export type MusicIdentity = { id: string; name: string; avatarUrl?: string };
export type SetupStatus = {
  music: { configured: boolean; connected: boolean; user?: MusicIdentity; message?: string };
  model: { configured: boolean };
  tts: { available: boolean; voice: string; language: "en" | "zh" };
};
export const ENGLISH_FEMALE_VOICES = [
  "en-US-EmmaMultilingualNeural", "en-US-EmmaNeural", "en-US-JennyNeural",
  "en-US-AriaNeural", "en-GB-SoniaNeural", "en-IE-EmilyNeural", "en-AU-NatashaNeural"
] as const;
export const CHINESE_FEMALE_VOICES = ["zh-CN-XiaoxiaoNeural", "zh-CN-XiaoyiNeural", "zh-TW-HsiaoChenNeural", "zh-TW-HsiaoYuNeural"] as const;
export const FEMALE_VOICES = [...CHINESE_FEMALE_VOICES, ...ENGLISH_FEMALE_VOICES] as const;
export function voiceLanguage(voice: string): "zh" | "en" { return voice.startsWith("zh-") ? "zh" : "en"; }
export type LyricsResponse = { trackId: string; status: "synced" | "plain" | "instrumental" | "missing"; lines: { timeMs: number; text: string }[]; text?: string };
export type RadioSettings = {
  hostLanguage: "en" | "zh";
  voice: string;
  djEnabled: boolean;
  discovery: boolean;
  mood: string;
  volume: number;
};
export type PlaylistSummary = { id: string; name: string; trackCount?: number; coverUrl?: string };
export type PlaylistResponse = { items: PlaylistSummary[] };
export type MusicSearchResponse = { items: Track[] };
export type MusicQrSession = { key: string; qrImageUrl: string; qrUrl?: string; expiresAt: string };
export type MusicQrPollResponse = {
  status: "waiting" | "scanned" | "connected" | "expired";
  message?: string;
  user?: MusicIdentity;
};
export const MAX_PROGRAMME_TRACKS = 12;
export type ProgrammeRequest = { playlistId?: string; trackIds?: string[]; prompt?: string; limit?: number; roaming?: boolean; ordered?: boolean };
export type ListeningMessage = { role: "user" | "assistant"; text: string };
export type ListeningMode = "enqueue" | "replace";
export type ListeningRequest = { messages: ListeningMessage[]; mode?: ListeningMode; context?: { prompt: string; trackIds: string[] } };
export type ListeningResponse = {
  reply: string; tracks: Track[]; warnings: string[]; programme?: ProgrammeRequest;
  direction?: string; context?: { prompt: string; trackIds: string[] };
  mode?: ListeningMode; match?: "exact" | "choose_version"; clarifications?: string[];
};
export type ProgrammeResponse = PlayerActionResponse & {
  selectionSource: "model" | "playlist";
  warnings: string[];
};
export type FeedbackRequest = { trackId: string; kind: "like" | "less_like_this" };
export type HistoryEntry = { id: string; title: string; createdAt: string; tracks: Track[] };
export type HistoryResponse = { items: HistoryEntry[] };

export const EMILY_VERSION = "0.3.0-dev";

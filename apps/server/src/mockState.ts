import type {
  DjSegment,
  NowPlayingState,
  PlayerActionResponse,
  PlayRequest,
  QueueItem,
  QueueResponse,
  Track
} from "@emily/shared";

const createdAt = new Date().toISOString();

const tracks: Track[] = [
  {
    id: "mock-1",
    title: "Monday Night Exhale",
    artist: "Emily Radio",
    album: "Phase 2 Mock Set",
    source: "local",
    durationMs: 207000,
    coverUrl:
      "https://images.unsplash.com/photo-1494232410401-ad00d5433cfa?auto=format&fit=crop&w=900&q=80",
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"
  },
  {
    id: "mock-2",
    title: "Soft Signal",
    artist: "Night Console",
    album: "Phase 2 Mock Set",
    source: "local",
    durationMs: 185000,
    coverUrl:
      "https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=900&q=80",
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3"
  },
  {
    id: "mock-3",
    title: "Low Light Queue",
    artist: "Localhost Ensemble",
    album: "Phase 2 Mock Set",
    source: "local",
    durationMs: 221000,
    coverUrl:
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80",
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3"
  }
];

const djSegments: DjSegment[] = [
  {
    id: "dj-1",
    text: "晚上先慢一点，Emily 先用一首 mock 曲目确认播放器闭环。",
    status: "text_only",
    createdAt
  },
  {
    id: "dj-2",
    text: "下一首会保持低速和轻盈，方便我们先验证队列状态。",
    status: "text_only",
    createdAt
  },
  {
    id: "dj-3",
    text: "Phase 2 只做本地状态，不急着接真实音乐和模型。",
    status: "text_only",
    createdAt
  }
];

let currentIndex = 0;
let status: NowPlayingState["status"] = "idle";
let startedAt: string | undefined;

function makeQueue(): QueueItem[] {
  return tracks.map((track, index) => ({
    id: `queue-${track.id}`,
    track,
    reason: index === currentIndex ? "当前 mock 播放项" : "用于验证下一首与队列展示",
    requestedBy: "fallback",
    status: index < currentIndex ? "played" : "resolved"
  }));
}

export function getNow(): NowPlayingState {
  const state: NowPlayingState = {
    status,
    queue: makeQueue(),
    positionMs: status === "playing" ? 12000 : 0,
    updatedAt: new Date().toISOString()
  };

  const track = tracks[currentIndex] ?? tracks[0];
  const dj = djSegments[currentIndex] ?? djSegments[0];

  if (track) {
    state.track = track;
  }

  if (dj) {
    state.dj = dj;
  }

  if (startedAt) {
    state.startedAt = startedAt;
  }

  return state;
}

export function getQueue(): QueueResponse {
  return {
    items: makeQueue()
  };
}

export function play(request: PlayRequest = {}): PlayerActionResponse {
  if (request.trackId) {
    const nextIndex = tracks.findIndex((track) => track.id === request.trackId);

    if (nextIndex >= 0) {
      currentIndex = nextIndex;
    }
  }

  status = "playing";
  startedAt = new Date().toISOString();

  return {
    now: getNow()
  };
}

export function pause(): PlayerActionResponse {
  status = "paused";

  return {
    now: getNow()
  };
}

export function next(): PlayerActionResponse {
  currentIndex = (currentIndex + 1) % tracks.length;
  status = "playing";
  startedAt = new Date().toISOString();

  return {
    now: getNow()
  };
}

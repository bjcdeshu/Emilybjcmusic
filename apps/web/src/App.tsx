import { useEffect, useState } from "react";
import { Pause, Play, SkipBack, SkipForward } from "lucide-react";
import type { ApiResponse, NowPlayingState, PlayerActionResponse, QueueResponse } from "@emily/shared";

type LoadState = "loading" | "ready" | "error";

export function App() {
  const [now, setNow] = useState<NowPlayingState | null>(null);
  const [queueCount, setQueueCount] = useState(0);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      const [nowResponse, queueResponse] = await Promise.all([
        fetchJson<NowPlayingState>("/api/now"),
        fetchJson<QueueResponse>("/api/queue")
      ]);

      setNow(nowResponse);
      setQueueCount(queueResponse.items.length);
      setLoadState("ready");
      setError(null);
    } catch (caught) {
      setLoadState("error");
      setError(caught instanceof Error ? caught.message : "Unable to reach Emily API.");
    }
  }

  async function runAction(action: "play" | "pause" | "next") {
    const endpoint = action === "play" ? "/api/player/play" : `/api/player/${action}`;
    const init: RequestInit = {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      }
    };

    if (action === "play") {
      init.body = JSON.stringify({ trackId: now?.track?.id });
    }

    const response = await fetchJson<PlayerActionResponse>(endpoint, init);

    setNow(response.now);
    setQueueCount(response.now.queue.length);
  }

  useEffect(() => {
    void refresh();
  }, []);

  const isPlaying = now?.status === "playing";

  return (
    <main className="shell">
      <section className="player" aria-label="Emily player">
        <div className="topbar">
          <div>
            <p className="eyebrow">Phase 2 mock loop</p>
            <h1>Emily</h1>
          </div>
          <span className={`badge ${loadState}`}>{badgeText(loadState, now?.status)}</span>
        </div>

        <div
          className="artwork"
          style={now?.track?.coverUrl ? { backgroundImage: `url(${now.track.coverUrl})` } : undefined}
          aria-hidden="true"
        >
          <div className="artwork-core">E</div>
        </div>

        <section className="track-copy">
          <p className="kicker">{now?.track?.album ?? "Mock player state"}</p>
          <h2>{now?.track?.title ?? "正在连接 Emily"}</h2>
          <p>{now?.track?.artist ?? "等待后端返回当前播放状态"}</p>
        </section>

        <section className="dj-card" aria-label="DJ segment">
          <p>Emily says</p>
          <strong>{now?.dj?.text ?? error ?? "准备读取 mock 串场文案。"}</strong>
        </section>

        <div className="controls" aria-label="Player controls">
          <button type="button" aria-label="Previous track" disabled>
            <SkipBack aria-hidden="true" size={20} />
          </button>
          <button
            type="button"
            className="play"
            aria-label={isPlaying ? "Pause" : "Play"}
            onClick={() => void runAction(isPlaying ? "pause" : "play")}
          >
            {isPlaying ? <Pause aria-hidden="true" size={24} fill="currentColor" /> : <Play aria-hidden="true" size={24} fill="currentColor" />}
          </button>
          <button type="button" aria-label="Next track" onClick={() => void runAction("next")}>
            <SkipForward aria-hidden="true" size={20} />
          </button>
        </div>

        <div className="progress" aria-hidden="true">
          <span />
        </div>

        <section className="queue">
          <div>
            <p>Status</p>
            <strong>{now?.status ?? "loading"}</strong>
          </div>
          <div>
            <p>Queue</p>
            <strong>{queueCount} tracks</strong>
          </div>
        </section>
      </section>
    </main>
  );
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const payload = (await response.json()) as ApiResponse<T>;

  if (!payload.ok) {
    throw new Error(payload.error.message);
  }

  return payload.data;
}

function badgeText(loadState: LoadState, playerStatus?: string) {
  if (loadState === "loading") {
    return "Checking API";
  }

  if (loadState === "error") {
    return "API offline";
  }

  return `API ok · ${playerStatus ?? "idle"}`;
}

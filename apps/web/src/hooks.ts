import { useEffect, useRef, useState } from "react";
import type { NowPlayingState } from "@emily/shared";
import { safeUrl } from "./api";
import { initialPlayback, RadioAudio } from "./playback";

export function useRadioAudio(callbacks: {
  advance: () => Promise<NowPlayingState>;
  onResolved: (now: NowPlayingState) => void;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const playerRef = useRef<RadioAudio | null>(null);
  const callbackRef = useRef(callbacks);
  callbackRef.current = callbacks;
  const [playback, setPlayback] = useState(initialPlayback);
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const player = new RadioAudio(audio, {
      onChange: setPlayback,
      sourceUrl: safeUrl,
      advance: () => callbackRef.current.advance(),
      onResolved: (now) => callbackRef.current.onResolved(now)
    });
    playerRef.current = player;
    return () => { player.destroy(); playerRef.current = null; };
  }, []);
  return { audioRef, playerRef, playback };
}

export function useMediaSession(
  now: NowPlayingState | null,
  playback: ReturnType<typeof useRadioAudio>["playback"],
  controls: { play: () => void; pause: () => void; next: () => void; previous: () => void; seek: (time: number) => void }
) {
  const controlRef = useRef(controls);
  controlRef.current = controls;
  const timeRef = useRef(0);
  timeRef.current = playback.time;
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const actions: Array<[MediaSessionAction, MediaSessionActionHandler]> = [
      ["play", () => controlRef.current.play()], ["pause", () => controlRef.current.pause()],
      ["nexttrack", () => controlRef.current.next()], ["previoustrack", () => controlRef.current.previous()],
      ["seekto", (details) => { if (details.seekTime !== undefined) controlRef.current.seek(details.seekTime); }],
      ["seekbackward", (details) => controlRef.current.seek(timeRef.current - (details.seekOffset ?? 15))],
      ["seekforward", (details) => controlRef.current.seek(timeRef.current + (details.seekOffset ?? 15))],
      ["stop", () => controlRef.current.pause()]
    ];
    for (const [action, handler] of actions) {
      try { navigator.mediaSession.setActionHandler(action, handler); } catch { /* Browser-specific support. */ }
    }
    return () => {
      for (const [action] of actions) {
        try { navigator.mediaSession.setActionHandler(action, null); } catch { /* Unsupported action. */ }
      }
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.playbackState = "none";
    };
  }, []);
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    if (!now?.track) { navigator.mediaSession.metadata = null; return; }
    const artwork = safeUrl(now.track.coverUrl);
    if (typeof MediaMetadata !== "undefined") {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: playback.phase === "dj" ? `${now.programmeTitle || "Emily Radio"} · Emily says` : now.track.title,
        artist: playback.phase === "dj" ? "Emily" : now.track.artist,
        album: now.programmeTitle || now.track.album || "Emily Personal Radio",
        artwork: artwork ? [{ src: artwork }] : []
      });
    }
  }, [now, playback.phase]);
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.playbackState = playback.status === "playing" ? "playing" : now?.track ? "paused" : "none";
    try {
      if (playback.duration > 0) {
        navigator.mediaSession.setPositionState({ duration: playback.duration, playbackRate: 1, position: Math.min(playback.time, playback.duration) });
      } else navigator.mediaSession.setPositionState();
    } catch { /* Live streams and older browsers may not expose position state. */ }
  }, [now?.track, playback.status, playback.duration, playback.time]);
}

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function usePwa() {
  const [online, setOnline] = useState(navigator.onLine);
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null);
  const [updateReady, setUpdateReady] = useState(false);
  useEffect(() => {
    const onlineChanged = () => setOnline(navigator.onLine);
    const beforeInstall = (event: Event) => { event.preventDefault(); setInstallPrompt(event as InstallPrompt); };
    const installed = () => setInstallPrompt(null);
    const update = () => setUpdateReady(true);
    window.addEventListener("online", onlineChanged);
    window.addEventListener("offline", onlineChanged);
    window.addEventListener("beforeinstallprompt", beforeInstall);
    window.addEventListener("appinstalled", installed);
    window.addEventListener("emily:update-ready", update);
    return () => {
      window.removeEventListener("online", onlineChanged); window.removeEventListener("offline", onlineChanged);
      window.removeEventListener("beforeinstallprompt", beforeInstall); window.removeEventListener("appinstalled", installed);
      window.removeEventListener("emily:update-ready", update);
    };
  }, []);
  async function install() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  }
  return { online, canInstall: !!installPrompt, install, updateReady };
}

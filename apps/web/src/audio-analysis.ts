import { useEffect, useRef, type RefObject } from "react";

export type AudioAnalysis = { context: AudioContext; analyser: AnalyserNode };
/** One graph for the lifetime of the audio element, not per view/track.
 * The existing audio element and playback engine still own all transport. */
export function useAudioAnalysis(audioRef: RefObject<HTMLAudioElement | null>) {
  const graph = useRef<AudioAnalysis | null>(null);
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    let source: MediaElementAudioSourceNode | undefined;
    function connect() {
      try {
        if (!graph.current) {
          const context = new AudioContext();
          const analyser = context.createAnalyser();
          analyser.fftSize = 256; analyser.smoothingTimeConstant = .75;
          source = context.createMediaElementSource(audio!);
          source.connect(analyser); analyser.connect(context.destination);
          graph.current = { context, analyser };
        }
        if (graph.current.context.state === "suspended") void graph.current.context.resume().catch(() => {});
      } catch { /* Unsupported Web Audio: show a flat signal, never synthetic data. */ }
    }
    audio.addEventListener("play", connect);
    return () => {
      audio.removeEventListener("play", connect);
      source?.disconnect();
      const context = graph.current?.context; graph.current = null;
      if (context) void context.close().catch(() => {});
    };
  }, [audioRef]);
  return graph;
}

import type { DjSegment } from "@emily/shared";
import type { TtsPort } from "./tts.js";
import { GeminiTtsPreview } from "./gemini-tts.js";

/** Explicit saved voice owns the provider. Never silently retry via another engine. */
export class HostingTts implements TtsPort {
  readonly audioDir: string;
  constructor(private readonly edge: TtsPort, private readonly gemini: GeminiTtsPreview) { this.audioDir = edge.audioDir; }
  available(voice: string): Promise<boolean> { return voice.startsWith("gemini:") ? this.gemini.available(voice) : this.edge.available(voice); }
  segment(text: string, voice: string): Promise<DjSegment> { return voice.startsWith("gemini:") ? this.gemini.segment(text, voice) : this.edge.segment(text, voice); }
  matches(segment: DjSegment, voice: string): boolean {
    return voice.startsWith("gemini:") ? this.gemini.matches(segment, voice) : segment.voice === voice && !segment.provider;
  }
}

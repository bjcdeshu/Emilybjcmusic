import { execFile } from "node:child_process";

/** Technical integrity only, not pronunciation, transcription or listening approval.
 * Fixed local decoder, no shell/network/metadata logging, bounded PCM and runtime. */
export async function validateTtsAudio(file: string, env: NodeJS.ProcessEnv): Promise<boolean> {
  return new Promise(resolve => {
    execFile("ffmpeg", ["-nostdin", "-v", "error", "-xerror", "-max_alloc", "33554432",
      "-protocol_whitelist", "file,pipe", "-threads", "1", "-f", "mp3", "-i", file,
      "-map", "0:a:0", "-t", "121", "-ac", "1", "-ar", "16000", "-f", "s16le", "pipe:1"],
    { timeout: 10_000, killSignal: "SIGKILL", maxBuffer: 4_000_000, windowsHide: true, env, encoding: "buffer" }, (error, pcm) => {
      if (error || pcm.length % 2 || pcm.length < 8_000 || pcm.length >= 3_840_000) { resolve(false); return; }
      let energy = 0;
      for (let i = 0; i < pcm.length; i += 2) { const value = pcm.readInt16LE(i) / 32768; energy += value * value; }
      // Reject empty/near-silent output. Do not impose a guessed speaking speed.
      resolve(energy / (pcm.length / 2) > 10 ** (-65 / 10));
    });
  });
}

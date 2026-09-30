import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
export { buildApp, createApp } from "./app.js";
export type { AppOptions, EmilyApp } from "./app.js";

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const config = loadConfig();
    const app = buildApp({ config, logger: true });
    await app.listen({ port: config.port, host: config.host });
    let stopping = false;
    const stop = async () => {
      if (stopping) return;
      stopping = true;
      await app.close();
      if (process.connected) process.disconnect();
      process.exitCode = 0;
    };
    process.once("SIGINT", () => { void stop(); });
    process.once("SIGTERM", () => { void stop(); });
    // Optional parent-only IPC lifecycle, not a network shutdown endpoint.
    if (process.send) process.on("message", message => {
      if (message && typeof message === "object" && "type" in message && message.type === "shutdown") void stop();
    });
  } catch {
    process.stderr.write("Emily startup failed. Check EMILY_* application configuration and private data permissions.\n");
    process.exitCode = 1;
  }
}

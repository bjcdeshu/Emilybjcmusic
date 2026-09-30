import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Development never installs a worker or caches private development traffic.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).then((registration) => {
      if (registration.waiting) window.dispatchEvent(new Event("emily:update-ready"));
      registration.addEventListener("updatefound", () => {
        registration.installing?.addEventListener("statechange", () => {
          if (registration.waiting && navigator.serviceWorker.controller) window.dispatchEvent(new Event("emily:update-ready"));
        });
      });
    }).catch(() => {
      // Normal streaming still works if install/offline support is unavailable.
    });
  }, { once: true });
}

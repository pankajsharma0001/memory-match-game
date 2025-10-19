// lib/socket.js
import { io } from "socket.io-client";

function createSocket() {
  const s = io({
    path: "/api/socket",
    autoConnect: true,
    // transports: ["websocket"], // optional if you want to force websocket
  });

  s.on("connect", () => console.log("[getSocket] connected", s.id));
  s.on("connect_error", (err) => console.error("[getSocket] connect_error", err));
  s.on("error", (err) => console.error("[getSocket] error", err));
  return s;
}

export default function getSocket() {
  if (typeof window === "undefined") return null;

  // Persist socket instance on window so HMR / Fast Refresh doesn't create duplicates
  if (!window.__MEMORY_SOCKET__) {
    window.__MEMORY_SOCKET__ = createSocket();
  } else if (window.__MEMORY_SOCKET__ && window.__MEMORY_SOCKET__.disconnected) {
    // Try to reconnect if it was disconnected
    try {
      window.__MEMORY_SOCKET__.connect();
    } catch (e) {
      console.warn("[getSocket] reconnect failed", e);
    }
  }

  return window.__MEMORY_SOCKET__;
}

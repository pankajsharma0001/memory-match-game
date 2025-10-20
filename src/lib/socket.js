// lib/socket.js
import { io } from "socket.io-client";

let socket;

export default function getSocket() {
  if (typeof window === "undefined") return null;
  
  if (!socket) {
    try {
      socket = io({
        path: "/api/socket",
        timeout: 20000, // Increased from 10000 to 20000
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        autoConnect: true,
        forceNew: false
      });

      socket.on("connect", () => {
        console.log("[socket] Connected to server");
      });

      socket.on("connect_error", (err) => {
        console.error("[socket] Connection error:", err.message);
        // Don't throw error - just log it
      });

      socket.on("disconnect", (reason) => {
        console.log("[socket] Disconnected:", reason);
      });
    } catch (error) {
      console.error("[socket] Initialization error:", error);
      return null;
    }
  }
  
  return socket;
}
// pages/online.js
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import getSocket from "../lib/socket";

export default function Online() {
  const [roomId, setRoomId] = useState("");
  const [error, setError] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const router = useRouter();
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    
    // Pre-initialize socket server without waiting
    fetch("/api/socket").catch(() => {});

    const s = getSocket();
    if (!s) {
      setError("Socket not available");
      return;
    }

    setSocket(s);

    // Simple connection handler
    const onConnect = () => {
      console.log("[online.js] socket connected", s.id);
      setIsConnected(true);
      setError("");
    };

    const onConnectError = (err) => {
      console.error("[online.js] connection error:", err);
      // Don't set error state - just log it
    };

    s.on("connect", onConnect);
    s.on("connect_error", onConnectError);

    // If already connected, set state immediately
    if (s.connected) {
      setIsConnected(true);
    }

    const onRoomCreated = (payload) => {
      console.log("[online.js] roomCreated payload", payload);
      const room = typeof payload === "string" ? payload : payload?.room;
      const firstPlayer = typeof payload === "string" ? s.id : payload?.firstPlayer ?? s.id;
      if (!room) {
        setError("Server returned invalid room data");
        return;
      }
      setError("");
      router.push({ pathname: "/onlineGame", query: { room, firstPlayer } });
    };

    const onRoomJoined = ({ room, firstPlayer } = {}) => {
      if (!room) return;
      console.log("[online.js] roomJoined", room, firstPlayer);
      setError("");
      router.push({ pathname: "/onlineGame", query: { room, firstPlayer } });
    };

    const onRoomError = (msg) => {
      console.warn("[online.js] roomError", msg);
      setError(msg);
    };

    s.on("roomCreated", onRoomCreated);
    s.on("roomJoined", onRoomJoined);
    s.on("roomError", onRoomError);

    return () => {
      s.off("connect", onConnect);
      s.off("connect_error", onConnectError);
      s.off("roomCreated", onRoomCreated);
      s.off("roomJoined", onRoomJoined);
      s.off("roomError", onRoomError);
    };
  }, [router]);

  const createRoom = () => {
    if (!socket) {
      setError("Socket not ready. Please wait a moment and try again.");
      return;
    }
    console.log("[online.js] emit createRoom");
    setError("");
    socket.emit("createRoom");
  };

  const joinRoom = () => {
    if (!socket) {
      setError("Socket not ready. Please wait a moment and try again.");
      return;
    }
    if (!roomId.trim()) {
      setError("Please enter a room code");
      return;
    }
    const code = roomId.trim().toUpperCase();
    console.log("[online.js] emit joinRoom", code);
    setError("");
    socket.emit("joinRoom", code);
  };

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 text-white text-center">
      <h1 className="text-4xl font-bold mb-6">🌐 Online Multiplayer</h1>

      {!isConnected && (
        <div className="mb-4 text-yellow-200">
          ⚡ Connecting to server... (First load may take a moment)
        </div>
      )}

      {isConnected && (
        <div className="mb-4 text-green-200">
          ✅ Connected to server
        </div>
      )}

      <button 
        onClick={createRoom} 
        className="bg-green-500 px-6 py-3 rounded-lg mb-4 font-semibold hover:bg-green-600 transition"
      >
        Create Room
      </button>

      <div className="flex gap-3 items-center">
        <input
          value={roomId}
          onChange={(e) => setRoomId(e.target.value.toUpperCase())}
          placeholder="Enter room code"
          className="px-3 py-2 rounded text-black"
        />
        <button 
          onClick={joinRoom} 
          className="bg-blue-500 px-4 py-2 rounded-lg hover:bg-blue-600 transition"
        >
          Join
        </button>
      </div>

      {error && (
        <div className="mt-4">
          <p className="text-red-200 bg-red-900/30 px-4 py-2 rounded mb-2">
            {error}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="text-sm bg-yellow-500 px-3 py-1 rounded hover:bg-yellow-600"
          >
            Retry
          </button>
        </div>
      )}

      <button 
        onClick={() => router.push("/memoryHome")} 
        className="mt-6 text-white/80 hover:text-white"
      >
        ← Back
      </button>
    </div>
  );
}
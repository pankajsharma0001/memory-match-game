// pages/online.js
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import getSocket from "../lib/socket";

export default function Online() {
  const [roomId, setRoomId] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const s = getSocket();
    if (!s) return;
    setSocket(s);

    const onConnect = () => console.log("[online.js] socket connected", s.id);
    const onDisconnect = (reason) => console.log("[online.js] socket disconnected", reason);
    s.on("connect", onConnect);
    s.on("disconnect", onDisconnect);

    // roomCreated can be either a string (legacy) or an object { room, firstPlayer }
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
      s.off("disconnect", onDisconnect);
      s.off("roomCreated", onRoomCreated);
      s.off("roomJoined", onRoomJoined);
      s.off("roomError", onRoomError);
    };
  }, [router]);

  const createRoom = () => {
    if (!socket) return console.warn("[online.js] socket not ready yet");
    console.log("[online.js] emit createRoom");
    socket.emit("createRoom");
  };

  const joinRoom = () => {
    if (!socket) return console.warn("[online.js] socket not ready yet");
    if (!roomId.trim()) return;
    const code = roomId.trim().toUpperCase();
    console.log("[online.js] emit joinRoom", code);
    socket.emit("joinRoom", code);
    setError("");
  };

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 text-white text-center">
      <h1 className="text-4xl font-bold mb-6">🌐 Online Multiplayer</h1>

      <button onClick={createRoom} className="bg-green-500 px-6 py-3 rounded-lg mb-4 font-semibold hover:bg-green-600 transition">
        Create Room
      </button>

      <div className="flex gap-3 items-center">
        <input
          value={roomId}
          onChange={(e) => setRoomId(e.target.value.toUpperCase())}
          placeholder="Enter room code"
          className="px-3 py-2 rounded text-black"
        />
        <button onClick={joinRoom} className="bg-blue-500 px-4 py-2 rounded-lg hover:bg-blue-600 transition">
          Join
        </button>
      </div>

      {error && <p className="mt-4 text-red-200">{error}</p>}

      <button onClick={() => router.push("/memoryHome")} className="mt-6 text-white/80 hover:text-white">
        ← Back
      </button>
    </div>
  );
}

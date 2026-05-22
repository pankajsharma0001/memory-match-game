// pages/online.js - UPDATED FOR PUSHER
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import { getPusherClient } from "../lib/pusher-client";

export default function Online() {
  const [roomId, setRoomId] = useState("");
  const [error, setError] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const router = useRouter();
  const [pusher, setPusher] = useState(null);
  const [userId] = useState(() => 
    Math.random().toString(36).substring(2) + Date.now().toString(36)
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    
    const pusherClient = getPusherClient();
    if (!pusherClient) {
      setError("Real-time service not available");
      return;
    }

    setPusher(pusherClient);
    setIsConnected(true);

    return () => {
      // Cleanup if needed
    };
  }, []);

  const createRoom = async () => {
    try {
      setError("");
      
      const response = await fetch('/api/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'create',
          userId: userId
        }),
      });

      const data = await response.json();

      if (data.success) {
        router.push({ 
          pathname: "/onlineGame", 
          query: { 
            room: data.room, 
            firstPlayer: data.firstPlayer,
            userId: userId
          } 
        });
      } else {
        setError(data.error || 'Failed to create room');
      }
    } catch (err) {
      console.error('Create room error:', err);
      setError('Network error - please try again');
    }
  };

  const joinRoom = async () => {
    if (!roomId.trim()) {
      setError("Please enter a room code");
      return;
    }

    try {
      setError("");
      const code = roomId.trim().toUpperCase();
      
      const response = await fetch('/api/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'join',
          roomCode: code,
          userId: userId
        }),
      });

      const data = await response.json();

      if (data.success) {
        router.push({ 
          pathname: "/onlineGame", 
          query: { 
            room: data.room, 
            firstPlayer: data.firstPlayer,
            userId: userId
          } 
        });
      } else {
        setError(data.error || 'Failed to join room');
      }
    } catch (err) {
      console.error('Join room error:', err);
      setError('Network error - please try again');
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center relative overflow-hidden text-white py-12 px-4">
      {/* 🎨 Cosmic Animated Background */}
      <div className="cosmic-bg"></div>

      {/* ✨ Floating Blur Orbs */}
      <div className="floating-orb orb-1 opacity-20"></div>
      <div className="floating-orb orb-2 opacity-25"></div>
      <div className="floating-orb orb-3 opacity-15"></div>

      {/* Connection status badge */}
      <div className="absolute top-6 right-6 z-20 flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1.5 rounded-full backdrop-blur-md">
        <span className={`status-dot ${isConnected ? "connected" : "connecting"}`}></span>
        <span className="text-xs text-white/70 font-semibold">
          {isConnected ? "Connected to server" : "Connecting..."}
        </span>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="z-10 w-full max-w-md"
      >
        <div className="glass-card-static p-8 text-center flex flex-col items-center shadow-2xl">
          <div className="text-6xl mb-4 animate-pulse">🌐</div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-cyan-400 via-violet-400 to-rose-400 bg-clip-text text-transparent mb-2">
            Online Arena
          </h1>
          <p className="text-white/60 text-sm mb-8">
            Create a private lobby or enter a code to match against a friend in real time.
          </p>

          {/* Action cards or buttons */}
          <div className="w-full flex flex-col gap-6">
            <button
              onClick={createRoom}
              className="btn-primary w-full py-3.5 text-base flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(139,92,246,0.3)]"
            >
              <span>✨ Create New Room</span>
            </button>

            <div className="relative flex items-center justify-center my-2">
              <span className="absolute bg-[#0f172a] px-3 text-xs uppercase tracking-widest text-white/40 font-bold border border-white/5 rounded-full">
                OR
              </span>
              <div className="w-full border-t border-white/10"></div>
            </div>

            <div className="flex flex-col gap-3 text-left">
              <label className="text-xs font-bold uppercase tracking-wider text-white/50 ml-1">
                Enter Room Code
              </label>
              <div className="flex gap-2">
                <input
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                  placeholder="CODE"
                  className="glass-input text-center text-lg font-black tracking-widest"
                  maxLength={4}
                />
                <button
                  onClick={joinRoom}
                  className="btn-secondary px-6 font-bold flex items-center gap-1.5"
                >
                  Join
                </button>
              </div>
            </div>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 w-full"
            >
              <div className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/20 px-4 py-3 rounded-lg flex flex-col gap-2 items-center">
                <p>{error}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="text-xs underline text-rose-200 hover:text-white"
                >
                  Click here to refresh and retry
                </button>
              </div>
            </motion.div>
          )}

          <button
            onClick={() => router.push("/memoryHome")}
            className="mt-8 text-sm text-white/50 hover:text-white transition flex items-center gap-1.5"
          >
            ← Exit to Main Menu
          </button>
        </div>
      </motion.div>
    </div>
  );
}
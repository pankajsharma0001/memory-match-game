// pages/online.js - UPDATED FOR PUSHER
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
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
    <div className="h-screen flex flex-col items-center justify-center bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 text-white text-center">
      <h1 className="text-4xl font-bold mb-6">🌐 Online Multiplayer</h1>

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
          maxLength={4}
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
// pages/onlineGame.js
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import getSocket from "../lib/socket";
import MemoryMatch from "./memory";

export default function OnlineGame() {
  const router = useRouter();
  const { room, firstPlayer } = router.query;

  const [socket, setSocket] = useState(null);
  const [isMyTurn, setIsMyTurn] = useState(false);
  const [opponentJoined, setOpponentJoined] = useState(false);
  const [opponentDisconnected, setOpponentDisconnected] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const s = getSocket();
    if (!s) return;
    setSocket(s);

    const onConnect = () => console.log("[onlineGame] socket connected", s.id);
    const onDisconnect = (reason) => console.log("[onlineGame] disconnected", reason);
    s.on("connect", onConnect);
    s.on("disconnect", onDisconnect);

    return () => {
      s.off("connect", onConnect);
      s.off("disconnect", onDisconnect);
    };
  }, []);

  const isHost = socket && firstPlayer && socket.id === String(firstPlayer);

  useEffect(() => {
    if (!socket) return;
    console.log("[onlineGame] listening for playerJoined/opponentLeft/startGame, room:", room, "firstPlayer:", firstPlayer);

    const onPlayerJoined = ({ room: joinedRoom } = {}) => {
      if (!joinedRoom || joinedRoom === room) {
        console.log("[onlineGame] playerJoined event received", joinedRoom);
        setOpponentJoined(true);
      }
    };
    const onOpponentLeft = (payload) => {
      console.log("[onlineGame] opponentLeft", payload);
      setOpponentDisconnected(true);
    };

    const onStartGame = ({ room: r, firstPlayer: fp } = {}) => {
      console.log("[onlineGame] startGame", r, fp);
      if (r && fp) {
        setGameStarted(true);
        router.replace({ pathname: "/onlineGame", query: { room: r, firstPlayer: fp } }, undefined, { shallow: true });
      }
    };

    socket.on("playerJoined", onPlayerJoined);
    socket.on("opponentLeft", onOpponentLeft);
    socket.on("startGame", onStartGame);

    return () => {
      socket.off("playerJoined", onPlayerJoined);
      socket.off("opponentLeft", onOpponentLeft);
      socket.off("startGame", onStartGame);
    };
  }, [socket, room, firstPlayer, router]);

  useEffect(() => {
    if (!socket || !room) return;

    const askStatus = () => {
      try {
        socket.emit("roomStatus", { room }, (res) => {
          if (!res || !res.ok) return;
          const status = res.status;
          console.log("[onlineGame] roomStatus", status);
          if (status.players >= 2) setOpponentJoined(true);
          if (status.started) setGameStarted(true);
        });
      } catch (e) {
        socket.once("roomStatus", ({ status } = {}) => {
          if (!status) return;
          if (status.players >= 2) setOpponentJoined(true);
          if (status.started) setGameStarted(true);
        });
      }
    };

    if (socket.connected) {
      askStatus();
    } else {
      socket.once("connect", askStatus);
    }

    return () => {
      socket.off("connect", askStatus);
    };
  }, [socket, room]);

  // FIXED: Move this useEffect to the top level (not nested inside another useEffect)
  useEffect(() => {
    if (!socket || !gameStarted) return;

    const onTurnChange = (payload) => {
      console.log("[onlineGame] turnChanged", payload);
      setIsMyTurn(true);
    };

    socket.on("turnChange", onTurnChange);

    return () => {
      socket.off("turnChange", onTurnChange);
    };
  }, [socket, gameStarted]);

  if (opponentDisconnected) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 text-white text-center">
        <h1 className="text-3xl font-bold mb-4">😢 Opponent Disconnected</h1>
        <button onClick={() => router.push("/memoryHome")} className="bg-white text-indigo-600 px-6 py-3 rounded-lg font-semibold hover:bg-indigo-50 transition">Return to Menu</button>
      </div>
    );
  }

  if (!gameStarted) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 text-white text-center">
        <h1 className="text-3xl font-bold mb-4">{isHost ? "Waiting for Opponent..." : "Joining room..."}</h1>
        <p className="text-lg">Room Code: <strong>{room}</strong></p>
        <div className="mt-4">
          {isHost ? (
            <p className="text-sm opacity-90">Share this code with a friend — the game will start when they join.</p>
          ) : (
            <p className="text-sm opacity-90">Waiting for the host to start the game...</p>
          )}
        </div>
        <button onClick={() => router.push("/memoryHome")} className="mt-6 text-white/80 hover:text-white">← Exit</button>
      </div>
    );
  }

  return (
    <MemoryMatch
      mode="online"
      isMyTurn={isMyTurn}
      setIsMyTurn={setIsMyTurn}
      socket={socket}
      roomId={room}
      isHost={isHost}
      gameStarted={gameStarted}
      onBack={() => router.push("/memoryHome")}
    />
  );
}
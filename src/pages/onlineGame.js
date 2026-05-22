// pages/onlineGame.js - UPDATED EVENT BINDINGS
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import { getPusherClient } from "../lib/pusher-client";
import MemoryMatch from "./memory";

export default function OnlineGame() {
  const router = useRouter();
  const { room, firstPlayer, userId } = router.query;

  const [channel, setChannel] = useState(null);
  const [isMyTurn, setIsMyTurn] = useState(false);
  const [opponentJoined, setOpponentJoined] = useState(false);
  const [opponentDisconnected, setOpponentDisconnected] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!room || !userId) return;

    let activeChannel = null;

    const initializePusher = async () => {
      try {
        const pusher = getPusherClient();
        if (!pusher) {
          setIsLoading(false);
          return;
        }

        // Monitor connection status using the pusher instance
        pusher.connection.bind('state_change', (states) => {
          setConnectionStatus(states.current);
        });

        pusher.connection.bind('connected', () => {
          setConnectionStatus('connected');
        });

        pusher.connection.bind('disconnected', () => {
          setConnectionStatus('disconnected');
        });

        // Subscribe to room channel
        const roomChannel = pusher.subscribe(`room-${room}`);
        activeChannel = roomChannel;
        
        roomChannel.bind('pusher:subscription_succeeded', () => {
          console.log('✅ Subscribed to room:', room);
          setIsLoading(false);
          setConnectionStatus('connected');
        });

        // Handle player joined
        roomChannel.bind('client-player-joined', (data) => {
          console.log('🎮 Player joined:', data);
          setOpponentJoined(true);
          setGameStarted(true);
          console.log('🚀 Setting gameStarted to TRUE because player joined');
        });

        roomChannel.bind('client-player-left', (data) => {
          console.log('👋 Player left:', data);
          setOpponentDisconnected(true);
        });

        setChannel(roomChannel);

        // Check room status immediately
        try {
          const statusResponse = await fetch(`/api/rooms?room=${room}`);
          if (statusResponse.ok) {
            const statusData = await statusResponse.json();
            
            if (statusData.success) {
              const roomData = statusData.room;
              console.log('📊 Room status:', roomData);
              if (roomData.players && roomData.players.length >= 2) {
                setOpponentJoined(true);
                setGameStarted(true);
                console.log('🚀 Game should start - 2 players in room');
              }
            }
          } else {
            console.warn('⚠️ Room status check failed:', statusResponse.status);
          }
        } catch (error) {
          console.error('❌ Failed to check room status:', error);
        }

      } catch (error) {
        console.error('❌ Pusher initialization error:', error);
        setIsLoading(false);
        setConnectionStatus('error');
      }
    };

    initializePusher();

    return () => {
      if (activeChannel) {
        activeChannel.unbind_all();
        const pusher = getPusherClient();
        if (pusher) {
          pusher.unsubscribe(`room-${room}`);
        }
      }
    };
  }, [room, userId]);

  // FIXED: Improved server-deck-ready handler
  useEffect(() => {
    if (!channel) return;

    const handleServerDeckReady = (data) => {
      console.log('🎮 Server deck ready received in onlineGame:', data);
      // Force state update for rematch
      setGameStarted(true);
      setOpponentJoined(true);
      console.log('🔄 Rematch: gameStarted set to TRUE');
    };

    channel.bind('server-deck-ready', handleServerDeckReady);

    return () => {
      channel.unbind('server-deck-ready', handleServerDeckReady);
    };
  }, [channel]);

  const isHost = userId === firstPlayer;

  // Send game event to opponent
  const sendGameEvent = (eventType, data) => {
    if (!channel) {
      console.warn('❌ No channel available to send event:', eventType);
      return;
    }
    
    console.log('📤 Sending event:', eventType, data);
    
    channel.trigger(`client-${eventType}`, {
      ...data,
      senderId: userId,
      room: room,
      timestamp: Date.now()
    });
  };

  const copyToClipboard = () => {
    if (!room) return;
    navigator.clipboard.writeText(room);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // DEBUG: Log important state changes
  useEffect(() => {
    console.log('🔄 OnlineGame State:', {
      room,
      userId,
      isHost,
      gameStarted,
      opponentJoined,
      channel: !!channel,
      isLoading,
      connectionStatus
    });
  }, [room, userId, isHost, gameStarted, opponentJoined, channel, isLoading, connectionStatus]);

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center relative overflow-hidden text-white py-12 px-4 text-center">
        <div className="cosmic-bg"></div>
        <div className="floating-orb orb-1 opacity-20"></div>
        <div className="floating-orb orb-2 opacity-25"></div>
        <div className="floating-orb orb-3 opacity-15"></div>

        <div className="glass-card-static p-8 max-w-sm w-full flex flex-col items-center shadow-2xl z-10">
          <div className="pulse-dots mb-6">
            <span></span>
            <span></span>
            <span></span>
          </div>
          <h2 className="text-xl font-bold mb-2">Connecting to Arena...</h2>
          <p className="text-xs text-white/50 mb-4">Establishing secure connection</p>
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1 rounded-full">
            <span className="status-dot connecting"></span>
            <span className="text-[10px] uppercase font-bold text-white/70 tracking-wider">Status: {connectionStatus}</span>
          </div>
        </div>
      </div>
    );
  }

  if (opponentDisconnected) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center relative overflow-hidden text-white py-12 px-4 text-center">
        <div className="cosmic-bg"></div>
        <div className="floating-orb orb-1 opacity-20"></div>
        <div className="floating-orb orb-2 opacity-25"></div>
        <div className="floating-orb orb-3 opacity-15"></div>

        <div className="glass-card-static p-8 max-w-md w-full flex flex-col items-center shadow-2xl z-10">
          <div className="text-6xl mb-4">😢</div>
          <h1 className="text-3xl font-extrabold text-white mb-2">Connection Lost</h1>
          <p className="text-sm text-white/60 mb-8">
            Your opponent has disconnected or left the game session.
          </p>
          <button
            onClick={() => router.push("/memoryHome")}
            className="btn-primary w-full py-3"
          >
            Return to Main Menu
          </button>
        </div>
      </div>
    );
  }

  const showWaitingScreen = !gameStarted || !opponentJoined;

  if (showWaitingScreen) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center relative overflow-hidden text-white py-12 px-4 text-center">
        <div className="cosmic-bg"></div>
        <div className="floating-orb orb-1 opacity-20"></div>
        <div className="floating-orb orb-2 opacity-25"></div>
        <div className="floating-orb orb-3 opacity-15"></div>

        {/* Connection status badge */}
        <div className="absolute top-6 right-6 z-20 flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1.5 rounded-full backdrop-blur-md">
          <span className={`status-dot ${connectionStatus === 'connected' ? 'connected' : 'connecting'}`}></span>
          <span className="text-xs text-white/70 font-semibold">
            Status: {connectionStatus}
          </span>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card-static p-8 max-w-md w-full flex flex-col items-center shadow-2xl z-10"
        >
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white mb-2">
            {isHost ? "Waiting for Opponent" : "Waiting for Host"}
          </h1>
          <p className="text-white/60 text-sm mb-6">
            {isHost ? "Send the code below to your friend to join the match." : "The match will start as soon as the host initializes the board."}
          </p>

          <div className="flex flex-col items-center gap-3 w-full mb-6">
            <span className="text-xs font-bold uppercase tracking-wider text-white/40">Lobby Code</span>
            <div className="flex items-center gap-2 w-full justify-center">
              <div className="room-code">{room}</div>
              <button
                onClick={copyToClipboard}
                className="btn-secondary p-3 flex items-center justify-center aspect-square text-base relative"
                title="Copy code to clipboard"
              >
                {copied ? "✅" : "📋"}
              </button>
            </div>
            {copied && <p className="text-xs text-emerald-400 font-bold animate-pulse mt-1">Code copied to clipboard!</p>}
          </div>

          <div className="w-full bg-white/5 border border-white/5 rounded-2xl p-4 mb-6">
            {isHost ? (
              <div className="flex flex-col items-center gap-2">
                <div className="pulse-dots mb-1">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
                <p className="text-xs text-white/60">Lobby is public. Ready to receive connections...</p>
                {opponentJoined && (
                  <p className="text-xs text-emerald-400 font-bold animate-pulse">Opponent joined! Syncing decks...</p>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div className="pulse-dots mb-1">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
                <p className="text-xs text-white/60">Lobby connection established. Waiting for host to build card board...</p>
              </div>
            )}
          </div>

          <button
            onClick={() => router.push("/memoryHome")}
            className="btn-danger w-full py-3"
          >
            Cancel & Exit Lobby
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <MemoryMatch
      mode="online"
      isMyTurn={isMyTurn}
      setIsMyTurn={setIsMyTurn}
      channel={channel}
      roomId={room}
      isHost={isHost}
      userId={userId}
      gameStarted={gameStarted}
      onSendGameEvent={sendGameEvent}
      onBack={() => router.push("/memoryHome")}
    />
  );
}
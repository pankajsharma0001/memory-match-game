// pages/onlineGame.js - UPDATED EVENT BINDINGS
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
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
  const [connectionStatus, setConnectionStatus] = useState('connecting'); // Add this state

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
      connectionStatus // Add connection status to debug logs
    });
  }, [room, userId, isHost, gameStarted, opponentJoined, channel, isLoading, connectionStatus]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 text-white">
        <div className="text-xl mb-4">Loading game...</div>
        <div className="animate-spin">🎮</div>
        <div className="text-sm mt-2">Status: {connectionStatus}</div>
      </div>
    );
  }

  if (opponentDisconnected) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 text-white text-center">
        <h1 className="text-3xl font-bold mb-4">😢 Opponent Disconnected</h1>
        <button onClick={() => router.push("/memoryHome")} className="bg-white text-indigo-600 px-6 py-3 rounded-lg font-semibold hover:bg-indigo-50 transition">
          Return to Menu
        </button>
      </div>
    );
  }

  // FIXED: Improved waiting screen condition with better rematch handling
  const showWaitingScreen = !gameStarted || !opponentJoined;

  if (showWaitingScreen) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 text-white text-center">
        <h1 className="text-3xl font-bold mb-4">
          {isHost ? "Waiting for Opponent..." : "Waiting for Game Start..."}
        </h1>
        <p className="text-lg">Room Code: <strong>{room}</strong></p>
        
        <div className="mt-4">
          {isHost ? (
            <div>
              <p className="text-sm opacity-90 mb-2">Share this code with a friend — the game will start when they join.</p>
              {opponentJoined && (
                <p className="text-green-300 animate-pulse">✅ Opponent joined! Starting game...</p>
              )}
            </div>
          ) : (
            <div>
              <p className="text-sm opacity-90 mb-2">Waiting for host to start the game...</p>
              <div className="animate-pulse">🎮</div>
            </div>
          )}
        </div>

        {/* Connection status indicator */}
        <div className="flex items-center gap-2 mt-4 text-sm">
          <div className={`w-2 h-2 rounded-full ${
            connectionStatus === 'connected' ? 'bg-green-500 animate-pulse' :
            connectionStatus === 'connecting' ? 'bg-yellow-500' :
            'bg-red-500'
          }`}></div>
          <span>Status: {connectionStatus}</span>
        </div>

        <button onClick={() => router.push("/memoryHome")} className="mt-6 text-white/80 hover:text-white">
          ← Exit
        </button>
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
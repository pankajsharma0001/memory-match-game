// pages/memory.js
import { useEffect, useMemo, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/router";
import confetti from "canvas-confetti";

const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  
  return debouncedValue;
};

const EMOJIS = [
  "🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐨","🐯","🦁","🐮",
  "🐸","🐵","🐔","🦄","🐙","🐝","🐞","🪲","🦋","🐢","🐬","🐳"
];

const DIFFICULTIES = {
  easy: 8,
  medium: 12,
  hard: 24,
};

function shuffle(array) {
  const a = array.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function MemoryMatch({
  mode = "single",
  difficulty = "easy",
  onBack,
  channel = null,
  roomId = null,
  isMyTurn = false,
  setIsMyTurn = () => {},
  isHost = false,
  gameStarted = false,
  userId = null,
  onSendGameEvent = () => {},
}) {
  const router = useRouter();
  
  const LOCAL_FLIP_DURATION = 500; // Normal speed for single/two player
  const LOCAL_MATCH_CHECK_DELAY = 600; // Normal delay for single/two player

  const ONLINE_FLIP_DURATION = 600; // Slower for online mode
  const ONLINE_MATCH_CHECK_DELAY = 1000; // Longer delay for online mode

  // Audio references
  const bgMusic = useRef(null);
  const flipSound = useRef(null);
  const matchSound = useRef(null);
  const mismatchSound = useRef(null);
  const winSound = useRef(null);
  const [musicOn, setMusicOn] = useState(true);

  // Game states
  const [selectedDifficulty, setSelectedDifficulty] = useState(difficulty);
  const pairsCount = DIFFICULTIES[selectedDifficulty];
  const [cards, setCards] = useState([]);
  const [flipped, setFlipped] = useState([]);
  const [matchedIds, setMatchedIds] = useState(new Set());
  const [moves, setMoves] = useState(0);
  const [disabled, setDisabled] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const timerRef = useRef(null);
  const [started, setStarted] = useState(false);
  const [bestScores, setBestScores] = useState({});
  const [currentPlayer, setCurrentPlayer] = useState(1);
  const [playerScores, setPlayerScores] = useState({ 1: 0, 2: 0 });
  const [onlineScores, setOnlineScores] = useState({});
  const [totalWins, setTotalWins] = useState({ red: 0, blue: 0 });
  const [winner, setWinner] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(false);

  const debouncedFlipped = useDebounce(flipped, 150);

  const lastSentFlip = useRef(null);

  // Particle container ref for bursts
  const particleContainer = useRef(null);

  // Name prompt states
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [playerName, setPlayerName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Rematch states
  const [rematchRequested, setRematchRequested] = useState(false);
  const [opponentRematchRequested, setOpponentRematchRequested] = useState(false);
  const [showRematchModal, setShowRematchModal] = useState(false);

  // Load best scores
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("memory_best")) || {};
      setBestScores(stored);
    } catch {}
  }, []);

  // Load audio
  useEffect(() => {
    bgMusic.current = new Audio("/sounds/bg-music.mp3");
    bgMusic.current.loop = true;
    bgMusic.current.volume = 0.2;
    if (musicOn) bgMusic.current.play().catch(() => {});

    flipSound.current = new Audio("/sounds/flip.mp3");
    matchSound.current = new Audio("/sounds/match.mp3");
    mismatchSound.current = new Audio("/sounds/mismatch.mp3");
    winSound.current = new Audio("/sounds/win.mp3");

    return () => {
      try {
        bgMusic.current.pause();
        bgMusic.current.currentTime = 0;
      } catch (e) {}
    };
  }, []);

  // Toggle background music
  const toggleMusic = () => {
    if (musicOn) {
      bgMusic.current.pause();
    } else {
      bgMusic.current.currentTime = 0;
      bgMusic.current.play().catch(() => {});
    }
    setMusicOn(!musicOn);
  };

  const createDeck = (isRematch = false) => {
    const chosen = EMOJIS.slice(0, pairsCount);
    const pairEmojis = shuffle([...chosen, ...chosen]);
    const deck = pairEmojis.map((emoji, idx) => ({
      id: idx,
      emoji,
      uuid: cryptoRandomId(),
    }));
    setCards(deck);

    setFlipped([]);
    setMatchedIds(new Set());
    setMoves(0);
    setSeconds(0);
    stopTimer();
    setStarted(false);
    setDisabled(false);
    setCurrentPlayer(1);
    setPlayerScores({ 1: 0, 2: 0 });
    setOnlineScores({});
    setWinner(null);
    setShowModal(false);
    setRematchRequested(false);
    setOpponentRematchRequested(false);
    setShowRematchModal(false);
  };

  // Auto-rematch
  useEffect(() => {
    if (mode === "online" && isHost && rematchRequested && opponentRematchRequested) {
      const timer = setTimeout(() => {
        createDeck(true);
      }, 1500);
      
      return () => clearTimeout(timer);
    }
  }, [mode, isHost, rematchRequested, opponentRematchRequested]);

  // Non-online modes create deck immediately
  useEffect(() => {
    if (mode !== "online") {
      createDeck();
    }
  }, [selectedDifficulty, mode]);

  // Handle server-sent deck ready events
  useEffect(() => {
    if (mode !== "online" || !channel) return;

    const handleServerDeckReady = (data) => {
      console.log("[MemoryMatch] server-deckReady received", data);
      if (!data.deck || !Array.isArray(data.deck)) return;
      
      console.log("[MemoryMatch] Setting deck from server event, cards:", data.deck.length);
      setCards(data.deck);
      setFlipped([]);
      setMatchedIds(new Set());
      setMoves(0);
      setSeconds(0);
      setStarted(false);
      setDisabled(false);
      setPlayerScores({ 1: 0, 2: 0 });
      setOnlineScores({});
      setWinner(null);
      setShowModal(false);
      
      // Close rematch modal if it's open
      setShowRematchModal(false);
      setRematchRequested(false);
      setOpponentRematchRequested(false);
      
      const iAmHost = userId === data.hostId;
      setIsMyTurn(iAmHost);
      setCurrentPlayer(iAmHost ? 1 : 2);
      
      console.log(`[MemoryMatch] Deck set. I am host: ${iAmHost}, my turn: ${iAmHost}`);
    };

    channel.bind("server-deck-ready", handleServerDeckReady);
    return () => {
      channel.unbind("server-deck-ready", handleServerDeckReady);
    };
  }, [mode, channel, userId]);

  // Host: start game via API when gameStarted becomes true
  useEffect(() => {
    if (mode !== "online") return;
    
    console.log("[MemoryMatch] Host useEffect - isHost:", isHost, "gameStarted:", gameStarted, "cards:", cards.length);
    
    if (!isHost) {
      console.log("[MemoryMatch] non-host waiting for deckReady");
      
      // Non-host fallback: request deck if missed the event
      if (gameStarted && cards.length === 0) {
        console.log("[MemoryMatch] Non-host requesting deck from API");
        fetch('/api/rooms', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'get-deck',
            roomCode: roomId,
          }),
        })
        .then(response => response.json())
        .then(data => {
          if (data.success) {
            console.log("[MemoryMatch] Got deck from API fallback");
            setCards(data.deck);
            setIsMyTurn(userId === data.hostId);
          }
        })
        .catch(error => {
          console.error('Error getting deck:', error);
        });
      }
      return;
    }

    // Host: start game via API
    if (gameStarted && cards.length === 0) {
      console.log("[MemoryMatch] gameStarted prop true — host starting game via API");
      
      fetch('/api/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'start-game',
          roomCode: roomId,
          hostId: userId
        }),
      })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          console.log("[MemoryMatch] Game started successfully via API");
          setCards(data.deck);
          setIsMyTurn(true);
        } else {
          console.error('Failed to start game:', data.error);
        }
      })
      .catch(error => {
        console.error('Error starting game:', error);
      });
    }
  }, [mode, isHost, gameStarted, cards.length, roomId, userId]);

  // FIXED: Timer logic - start timer when game starts, not on card flip
  useEffect(() => {
    if (mode !== "online") {
      // For single/two player, start timer immediately when game starts
      if (started && cards.length > 0) {
        timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
      }
    } else {
      // For online mode, start timer when game starts (cards are set)
      if (cards.length > 0 && !timerRef.current) {
        timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
      }
    }

    return () => {
      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [started, mode, cards.length]);

  const stopTimer = () => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // Auto-pause/resume on tab visibility
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        bgMusic.current?.pause();
      } else {
        if (musicOn) bgMusic.current?.play().catch(() => {});
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [musicOn]);

  // Handle game end
  useEffect(() => {
    if (cards.length > 0 && matchedIds.size === cards.length) {
      stopTimer();
      winSound.current?.play();

      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 },
        colors: ["#06b6d4", "#8b5cf6", "#f43f5e", "#f59e0b", "#10b981"]
      });

      // Two Player Mode
      if (mode === "two") {
        let roundWinner = null;
        if (playerScores[1] > playerScores[2]) roundWinner = "red";
        else if (playerScores[2] > playerScores[1]) roundWinner = "blue";

        if (roundWinner) {
          setTotalWins((prev) => ({ ...prev, [roundWinner]: prev[roundWinner] + 1 }));
        }
        setWinner(roundWinner ? roundWinner : "draw");
      }

      // Single Player Mode
      if (mode === "single") {
        const prev = bestScores[selectedDifficulty];
        const current = { moves, time: seconds };
        let shouldSave =
          !prev || current.moves < prev.moves || (current.moves === prev.moves && current.time < prev.time);
        if (shouldSave) {
          const updated = { ...bestScores, [selectedDifficulty]: current };
          setBestScores(updated);
          if (typeof window !== "undefined") {
            localStorage.setItem("memory_best", JSON.stringify(updated));
          }
        }
        setTimeout(() => setShowNamePrompt(true), 800);
      }

      // Online Multiplayer Mode
      if (mode === "online" && channel && isHost) {
        console.log("[DEBUG] onlineScores before game over:", onlineScores);
        
        if (isHost) {
          setTimeout(() => {
            const myScore = onlineScores[userId] || 0;
            const opponentIds = Object.keys(onlineScores).filter(id => id !== userId);
            const opponentId = opponentIds[0];
            const opponentScore = opponentIds.reduce((sum, id) => sum + (onlineScores[id] || 0), 0);
            
            console.log("[MemoryMatch] Final scores - You:", myScore, "Opponent:", opponentScore, "All scores:", onlineScores);
            
            let winnerId;
            if (myScore > opponentScore) {
              winnerId = userId;
            } else if (opponentScore > myScore) {
              winnerId = opponentId;
            } else {
              winnerId = "draw";
            }
            
            console.log("[MemoryMatch] Emitting winnerId:", winnerId);
            
            // Use API to send game over event
            fetch('/api/rooms', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                action: 'game-over',
                roomCode: roomId,
                hostId: userId,
                winnerId: winnerId,
                scores: onlineScores
              }),
            }).catch(error => {
              console.error('Error sending game over:', error);
            });
          }, 100);
        }
      }
      
      setTimeout(() => setShowModal(true), 1000);
    }
  }, [matchedIds, cards, moves, seconds]);

  // NEW: Handle server-sent game over events
  useEffect(() => {
    if (mode !== "online" || !channel) return;

    const handleServerGameOver = (data) => {
      console.log("[MemoryMatch] server-game-over received", data);
      
      setShowModal(true);
      
      if (data.scores) {
        setOnlineScores(data.scores);
      }
      
      if (data.winnerId === userId) {
        console.log("[MemoryMatch] Setting winner: you (we won!)");
        setWinner("you");
      } else if (data.winnerId === "draw") {
        console.log("[MemoryMatch] Setting winner: draw");
        setWinner("draw");
      } else {
        console.log("[MemoryMatch] Setting winner: opponent (we lost)");
        setWinner("opponent");
      }
    };

    channel.bind("server-game-over", handleServerGameOver);
    return () => channel.unbind("server-game-over", handleServerGameOver);
  }, [mode, channel, userId]);

  // FIXED: Handle flip with proper turn management
  const handleFlip = (index) => {
    if (index == null || !cards[index]) return;

    // Prevent flipping invalid cards
    if (disabled || flipped.includes(index) || matchedIds.has(cards[index]?.uuid)) return;
    if (mode === "online" && !isMyTurn) return;

    if (!started) setStarted(true);

    const newFlipped = [...flipped, index];

    if (newFlipped.length === 2 && newFlipped[0] === newFlipped[1]) {
      setFlipped([newFlipped[0]]);
      return;
    }

    setFlipped(newFlipped);
    flipSound.current?.play();

    // Send flip event via API instead of client event
    if (mode === "online" && channel) {
      if (index !== lastSentFlip.current || !debouncedFlipped.includes(index)) {
        lastSentFlip.current = index;

        fetch('/api/rooms', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'card-flip',
            roomCode: roomId,
            senderId: userId,
            flippedIndex: index,
            cardId: cards[index].id
          }),
        }).catch(error => {
          console.error('Error sending card flip:', error);
        });
      }
    }

    if (newFlipped.length === 2) {
      setDisabled(true);
      
      // For online mode, only the current player should validate matches
      if (mode === "online") {
        setTimeout(() => handleMatchCheck(newFlipped), ONLINE_FLIP_DURATION + 100);
      } else {
        // For local modes, validate with delay
        setTimeout(() => handleMatchCheck(newFlipped), LOCAL_FLIP_DURATION);
      }
    }
  };

  // NEW: Handle server-sent card flip events
  useEffect(() => {
    if (mode !== "online" || !channel) return;

    const handleServerCardFlip = (data) => {
      if (data.senderId === userId) return;
      
      console.log("[MemoryMatch] server-card-flip received:", data.flippedIndex);
      
      setFlipped(prev => {
        if (prev.includes(data.flippedIndex) || matchedIds.has(cards[data.flippedIndex]?.uuid)) {
          return prev;
        }
        return [...prev, data.flippedIndex];
      });

      if (flipSound.current) {
        flipSound.current.currentTime = 0;
        flipSound.current.play().catch(() => {});
      }
    };

    channel.bind("server-card-flip", handleServerCardFlip);
    return () => {
      channel.unbind("server-card-flip", handleServerCardFlip);
    };
  }, [mode, channel, userId, cards, matchedIds]);

  // FIXED: Match checking for current player
  const handleMatchCheck = (flippedIndices) => {
    const [i1, i2] = flippedIndices;

    if (i1 == null || i2 == null || i1 === i2) {
      setTimeout(() => {
        setFlipped([]);
        setDisabled(false);
      }, mode === "online" ? ONLINE_FLIP_DURATION : LOCAL_FLIP_DURATION);
      return;
    }

    const c1 = cards[i1], c2 = cards[i2];

    if (!c1 || !c2) {
      setTimeout(() => {
        setFlipped([]);
        setDisabled(false);
      }, mode === "online" ? ONLINE_FLIP_DURATION : LOCAL_FLIP_DURATION);
      return;
    }

    const isMatch = c1?.emoji === c2?.emoji;

    // Increment moves
    setMoves((m) => m + 1);

    if (isMatch) {
      setTimeout(() => {
        setMatchedIds((prev) => {
          const ns = new Set(prev);
          ns.add(c1.uuid);
          ns.add(c2.uuid);
          return ns;
        });

        setFlipped([]);
        matchSound.current?.play();
        setDisabled(false);

        // Update scores
        if (mode === "online" && channel) {
          const newScores = {
            ...onlineScores,
            [userId]: (onlineScores[userId] || 0) + 1
          };
          setOnlineScores(newScores);
          
          // Send score update via API
          fetch('/api/rooms', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              action: 'score-update',
              roomCode: roomId,
              senderId: userId,
              scores: newScores
            }),
          }).catch(error => {
            console.error('Error sending score update:', error);
          });

          // Send match result
          const nextMatched = Array.from(new Set([...Array.from(matchedIds), c1.uuid, c2.uuid]));
        
          fetch('/api/rooms', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              action: 'card-match',
              roomCode: roomId,
              senderId: userId,
              matchedIds: nextMatched,
              moves: moves + 1,
              isMatch: true
            }),
          }).catch(error => {
            console.error('Error sending card match:', error);
          });
        }

        // Update scores for two-player mode
        if (mode === "two") {
          setPlayerScores(prev => ({
            ...prev,
            [currentPlayer]: prev[currentPlayer] + 1
          }));
        }
      }, 300);
    } else {
      const mismatchDelay = mode === "online" ? ONLINE_MATCH_CHECK_DELAY : LOCAL_MATCH_CHECK_DELAY;

      setTimeout(() => {
        setFlipped([]);
        mismatchSound.current?.play();

        // Swap turns for 2-player local
        if (mode === "two") {
          setCurrentPlayer((p) => (p === 1 ? 2 : 1));
        }

        // In online mode, tell opponent to take turn via API
        if (mode === "online" && channel) {
          fetch('/api/rooms', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              action: 'turn-change',
              roomCode: roomId,
              senderId: userId
            }),
          }).catch(error => {
            console.error('Error sending turn change:', error);
          });
          
          setIsMyTurn(false);
        }

        setDisabled(false);
      }, mismatchDelay);
    }
  };

  // NEW: Handle server-sent card match events
  useEffect(() => {
    if (mode !== "online" || !channel) return;

    const handleServerCardMatch = (data) => {
      if (data.senderId === userId) return;
      
      console.log("[MemoryMatch] server-card-match received:", data.matchedIds);
      setMatchedIds(new Set(data.matchedIds || []));
      setMoves(data.moves || 0);
      setFlipped([]); // Clear flipped state when opponent matches
      
      if (matchSound.current) {
        matchSound.current.currentTime = 0;
        matchSound.current.play().catch(() => {});
      }
    };

    channel.bind("server-card-match", handleServerCardMatch);
    return () => {
      channel.unbind("server-card-match", handleServerCardMatch);
    };
  }, [mode, channel, userId]);

  // NEW: Handle server-sent turn change events
  useEffect(() => {
    if (mode !== "online" || !channel) return;

    const handleServerTurnChange = (data) => {
      if (data.senderId === userId) return;
      
      console.log("[MemoryMatch] server-turn-change received");
      setIsMyTurn(true);
      setDisabled(false);
      setFlipped([]); // Clear any flipped cards (flips them back)
      
      if (mismatchSound.current) {
        mismatchSound.current.currentTime = 0;
        mismatchSound.current.play().catch(() => {});
      }
    };

    channel.bind("server-turn-change", handleServerTurnChange);
    return () => {
      channel.unbind("server-turn-change", handleServerTurnChange);
    };
  }, [mode, channel, userId]);

  // NEW: Handle server-sent score update events
  useEffect(() => {
    if (mode !== "online" || !channel) return;

    const handleServerScoreUpdate = (data) => {
      if (data.senderId === userId) return;
      
      console.log("[MemoryMatch] server-score-update received:", data.scores);
      setOnlineScores(data.scores || {});
    };

    channel.bind("server-score-update", handleServerScoreUpdate);
    return () => channel.unbind("server-score-update", handleServerScoreUpdate);
  }, [mode, channel, userId]);

  // Auto-start rematch when both players have requested (host only)
  useEffect(() => {
    if (mode === "online" && isHost && rematchRequested && opponentRematchRequested) {
      console.log("[MemoryMatch] Both players ready for rematch, host starting game");
      const timer = setTimeout(() => {
        startRematch();
      }, 1500);
      
      return () => clearTimeout(timer);
    }
  }, [mode, isHost, rematchRequested, opponentRematchRequested]);

  // Debug state
  useEffect(() => {
    console.log("[DEBUG MemoryMatch]", {
      mode,
      isHost,
      gameStarted,
      cardsCount: cards.length,
      channel: !!channel,
      userId,
      isMyTurn,
      flipped,
      matchedIds: matchedIds.size,
      disabled
    });
  }, [mode, isHost, gameStarted, cards.length, channel, userId, isMyTurn, flipped, matchedIds, disabled]);

  const restart = () => {
  if (mode === "online" && channel) {
    setRematchRequested(true);
    
    // Send rematch request via API
    fetch('/api/rooms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'rematch-request',
        roomCode: roomId,
        senderId: userId
      }),
    }).catch(error => {
      console.error('Error sending rematch request:', error);
    });
    
    setShowRematchModal(true);
    setShowModal(false);
  } else {
    createDeck();
    if (musicOn) {
      bgMusic.current.pause();
      bgMusic.current.currentTime = 0;
      bgMusic.current.play().catch(() => {});
    }
  }
};

// NEW: Function to handle starting rematch
const startRematch = () => {
  if (mode === "online" && channel) {
    console.log("[MemoryMatch] Starting rematch via API");
    
    // Use API to start rematch for both players
    fetch('/api/rooms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'start-rematch',
        roomCode: roomId,
        senderId: userId
      }),
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        console.log("[MemoryMatch] Rematch started successfully via API");
        setShowRematchModal(false);
        setRematchRequested(false);
        setOpponentRematchRequested(false);
      } else {
        console.error('Failed to start rematch:', data.error);
      }
    })
    .catch(error => {
      console.error('Error starting rematch:', error);
    });
  }
};
  // NEW: Handle server-sent rematch events
  useEffect(() => {
    if (mode !== "online" || !channel) return;

    const handleServerRematchRequest = (data) => {
      if (data.senderId === userId) return;
      
      console.log("[MemoryMatch] server-rematch-request received");
      setOpponentRematchRequested(true);
      
      if (!rematchRequested) {
        setShowRematchModal(true);
      }
    };

    channel.bind("server-rematch-request", handleServerRematchRequest);
    return () => channel.unbind("server-rematch-request", handleServerRematchRequest);
  }, [mode, channel, userId, rematchRequested]);

  const handleBack = () => {
    try {
      bgMusic.current.pause();
      bgMusic.current.currentTime = 0;
    } catch (e) {}
    onBack();
  };

  const gridCols = useMemo(() => {
    if (pairsCount <= 8) return "grid-cols-4";
    if (pairsCount <= 12) return "grid-cols-4 md:grid-cols-6";
    return "grid-cols-[repeat(auto-fit,minmax(55px,1fr))] md:grid-cols-6 xl:grid-cols-8";
  }, [pairsCount]);

  const cardSize = useMemo(() => {
    if (selectedDifficulty === "hard") {
      return "w-[55px] h-[55px] sm:w-[65px] sm:h-[65px] md:w-[70px] md:h-[70px] lg:w-20 lg:h-20 xl:w-24 xl:h-24";
    }
    return "w-[70px] h-[70px] sm:w-[75px] sm:h-[75px] md:w-20 md:h-20 lg:w-24 lg:h-24";
  }, [selectedDifficulty]);

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center p-4 text-white overflow-hidden">
      {/* 🎨 Cosmic Animated Background */}
      <div className="cosmic-bg"></div>

      {/* ✨ Floating Blur Orbs */}
      <div className="floating-orb orb-1 opacity-20"></div>
      <div className="floating-orb orb-2 opacity-25"></div>
      <div className="floating-orb orb-3 opacity-15"></div>

      <div className="absolute inset-0 -z-10 pointer-events-none overflow-hidden">
        {[...Array(15)].map((_, i) => {
          const style = {
            top: `${Math.random() * 100}%`,
            left: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 5}s`,
            transform: `scale(${0.6 + Math.random() * 1.2})`,
            opacity: 0.3 + Math.random() * 0.4,
          };
          return <div key={i} className="mm-sparkle" style={style} />;
        })}
      </div>

      <div ref={particleContainer} className="absolute inset-0 pointer-events-none -z-5"></div>

      <div className="w-full max-w-5xl flex flex-col justify-between min-h-[90vh] z-10">
        {/* Sleek top header */}
        <header className="glass-card-static px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4 w-full mb-6">
          <div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight bg-gradient-to-r from-white via-white to-white/70 bg-clip-text text-transparent">
              🧠 Memory Match
            </h1>
            <p className="text-xs text-white/50">
              {mode === "two"
                ? "Pass & Play • Round Score"
                : mode === "online"
                ? `Online Match • Room: ${roomId}`
                : "Single Player Campaign"}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 justify-end">
            {mode === "two" && (
              <div className="flex flex-col items-center gap-1">
                <div className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-full border border-white/10 backdrop-blur-md">
                  <span className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-semibold transition-all ${currentPlayer === 1 ? "bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-[0_0_10px_rgba(244,63,94,0.3)]" : "text-white/60"}`}>
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                    Red: {playerScores[1]}
                  </span>
                  <span className="text-white/30 text-xs font-bold">VS</span>
                  <span className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-semibold transition-all ${currentPlayer === 2 ? "bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-[0_0_10px_rgba(59,130,246,0.3)]" : "text-white/60"}`}>
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                    Blue: {playerScores[2]}
                  </span>
                </div>
                <div className="text-[10px] uppercase tracking-wider text-white/40 mt-1">
                  Series Score: Red {totalWins.red} — {totalWins.blue} Blue
                </div>
              </div>
            )}

            {mode === "online" && (
              <div className="flex flex-col items-center gap-1">
                <div className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-full border border-white/10 backdrop-blur-md">
                  <span className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-semibold transition-all ${isMyTurn ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.3)]" : "text-white/60"}`}>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                    You: {onlineScores[userId] || 0}
                  </span>
                  <span className="text-white/30 text-xs font-bold">VS</span>
                  <span className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-semibold transition-all ${!isMyTurn ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_10px_rgba(6,182,212,0.3)]" : "text-white/60"}`}>
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-500"></span>
                    Opponent: {Object.entries(onlineScores)
                      .filter(([id]) => id !== userId)
                      .reduce((sum, [_, score]) => sum + score, 0)}
                  </span>
                </div>
                <div className="text-[10px] uppercase tracking-wider text-white/40 mt-1">
                  {isMyTurn ? "🟢 Your Turn" : "⏳ Opponent's Turn"}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <div className="stat-badge">
                <span className="opacity-60 text-[10px] uppercase tracking-wider">Moves</span>
                <span className="text-cyan-400 font-extrabold">{moves}</span>
              </div>
              <div className="stat-badge">
                <span className="opacity-60 text-[10px] uppercase tracking-wider">Time</span>
                <span className="text-cyan-400 font-extrabold">{formatTime(seconds)}</span>
              </div>
            </div>

            {mode === "single" && (
              <div className="relative">
                <button
                  onClick={() => setOpenDropdown((prev) => !prev)}
                  className="relative bg-white/10 backdrop-blur-md text-white font-semibold rounded-lg px-4 py-2 text-sm shadow-md border border-white/20 hover:bg-white/20 transition-all duration-300 focus:outline-none flex items-center gap-2"
                >
                  {selectedDifficulty === "easy" && "🌱 Easy"}
                  {selectedDifficulty === "medium" && "⚡ Medium"}
                  {selectedDifficulty === "hard" && "🔥 Hard"}
                  <span className="text-white/50 text-[10px]">▼</span>
                </button>

                <AnimatePresence>
                  {openDropdown && (
                    <motion.ul
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.2 }}
                      className="absolute right-0 z-50 w-36 mt-2 rounded-lg overflow-hidden bg-slate-900/95 backdrop-blur-lg border border-white/10 shadow-xl"
                    >
                      {[
                        { value: "easy", label: "🌱 Easy (4x4)" },
                        { value: "medium", label: "⚡ Medium (4x6)" },
                        { value: "hard", label: "🔥 Hard (6x8)" },
                      ].map((opt) => (
                        <li
                          key={opt.value}
                          onClick={() => {
                            setSelectedDifficulty(opt.value);
                            setOpenDropdown(false);
                          }}
                          className={`px-4 py-2.5 text-sm text-white cursor-pointer transition-all duration-200 hover:bg-white/10 ${
                            selectedDifficulty === opt.value ? "bg-white/15 font-bold" : ""
                          }`}
                        >
                          {opt.label}
                        </li>
                      ))}
                    </motion.ul>
                  )}
                </AnimatePresence>
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={restart} className="btn-secondary px-3 py-1.5 text-xs">🔄 Restart</button>
              <button onClick={handleBack} className="btn-danger px-3 py-1.5 text-xs">← Exit</button>
              <button onClick={toggleMusic} className="btn-secondary px-3 py-1.5 text-xs">
                {musicOn ? "🔊 Music" : "🔇 Music"}
              </button>
            </div>
          </div>
        </header>

        {/* Card grid section */}
        <section className={`grid ${gridCols} gap-2 sm:gap-3 md:gap-4 justify-items-center content-center flex-1 my-4 ${selectedDifficulty === "hard" ? "max-w-[360px] sm:max-w-[500px] md:max-w-none mx-auto" : ""}`}>
          {cards.map((card, idx) => {
            const isFlipped = flipped.includes(idx) || matchedIds.has(card.uuid);
            return (
              <div
                key={card.id}
                data-card-uuid={card.uuid}
                onClick={() => handleFlip(idx)}
                className={`game-card ${cardSize} ${matchedIds.has(card.uuid) ? "matched" : ""}`}
              >
                <div
                  className={`game-card-inner ${isFlipped ? "flipped" : ""} ${
                    mode === "online" ? "online-speed" : ""
                  }`}
                >
                  <div className="game-card-face game-card-back">❓</div>
                  <div className="game-card-face game-card-front">
                    <span className="card-emoji">{card.emoji}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </section>

        {/* Footer */}
        <footer className="flex items-center justify-between text-xs mt-4 border-t border-white/5 pt-4">
          {mode === "single" ? (
            <div>
              <p className="text-white/40">Best Score ({selectedDifficulty}):</p>
              {bestScores[selectedDifficulty] ? (
                <div className="text-white/80 mt-0.5">
                  <span className="font-semibold text-cyan-400">{bestScores[selectedDifficulty].moves} moves</span> • {formatTime(bestScores[selectedDifficulty].time)}
                </div>
              ) : (
                <div className="text-white/40 mt-0.5">No records set yet</div>
              )}
            </div>
          ) : (
            <div />
          )}

          <div className="text-white/30 text-right">Made with ❤️</div>
        </footer>

        {/* Game over modal */}
        {showModal && (
          <div className="modal-overlay">
            <div className="modal-card">
              <div className="text-5xl mb-4 animate-bounce">🏆</div>
              <h2 className="text-3xl font-extrabold mb-2 text-white">
                {mode === "online"
                  ? winner === "you"
                    ? "Victory!"
                    : winner === "opponent"
                      ? "Defeat"
                      : "It's a Draw!"
                  : mode === "two"
                    ? winner === "draw"
                      ? "It's a Draw!"
                      : winner === "red"
                        ? "Red Wins!"
                        : "Blue Wins!"
                    : "Clear!"}
              </h2>
              
              {mode === "online" && (
                <p className="mb-4 text-white/70 text-sm">
                  Scores &mdash; You: <span className="text-emerald-400 font-bold">{onlineScores[userId] || 0}</span> | Opponent: <span className="text-cyan-400 font-bold">{
                    Object.entries(onlineScores)
                      .filter(([id]) => id !== userId)
                      .reduce((sum, [_, score]) => sum + score, 0)
                  }</span>
                </p>
              )}

              {mode === "two" && (
                <p className="mb-4 text-white/70 text-sm">
                  Round Stats &mdash; Red: <span className="text-rose-400 font-bold">{playerScores[1]}</span> | Blue: <span className="text-blue-400 font-bold">{playerScores[2]}</span>
                </p>
              )}

              <div className="bg-white/5 rounded-xl p-4 mb-6 border border-white/5 text-left flex flex-col gap-2">
                <div className="flex justify-between text-sm">
                  <span className="text-white/60">Total Moves:</span>
                  <span className="text-white font-bold">{moves}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/60">Total Time:</span>
                  <span className="text-white font-bold">{formatTime(seconds)}</span>
                </div>
              </div>

              {mode === "single" && (
                <div className="mb-6 text-left">
                  <label className="block text-xs font-bold uppercase tracking-wider text-white/50 mb-2">
                    Enter Name for Leaderboard
                  </label>
                  <input
                    type="text"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value.slice(0, 15))}
                    placeholder="Enter your name..."
                    className="glass-input"
                  />
                </div>
              )}

              <div className="flex flex-col gap-3 mt-4">
                {mode === "single" && (
                  <button
                    onClick={async () => {
                      if (!playerName.trim() || submitting) return;
                      setSubmitting(true);
                      try {
                        const res = await fetch("/api/leaderboard", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            player: playerName.trim(),
                            difficulty: selectedDifficulty,
                            moves,
                            time: seconds,
                          }),
                        });
                        if (!res.ok) throw new Error("Failed to submit score");
                        router.push("/leaderboard");
                      } catch (err) {
                        alert("Could not save your score. Please try again!");
                        console.error(err);
                      } finally {
                        setSubmitting(false);
                      }
                    }}
                    disabled={!playerName.trim()}
                    className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? "Submitting..." : "Submit to Leaderboard"}
                  </button>
                )}

                <button
                  onClick={restart}
                  className="btn-primary w-full"
                >
                  Play Again
                </button>

                <button
                  onClick={handleBack}
                  className="btn-secondary w-full"
                >
                  Exit to Menu
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Rematch Modal */}
        {showRematchModal && (
          <div className="modal-overlay">
            <div className="modal-card">
              <h2 className="text-2xl font-extrabold mb-4 text-white">🔄 Play Again?</h2>
              
              {rematchRequested && !opponentRematchRequested && (
                <div className="flex flex-col items-center">
                  <p className="mb-6 text-white/70 text-sm">Waiting for opponent to accept rematch...</p>
                  <div className="pulse-dots mb-8">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                  <button
                    onClick={() => setShowRematchModal(false)}
                    className="btn-secondary w-full"
                  >
                    Cancel
                  </button>
                </div>
              )}
              
              {!rematchRequested && opponentRematchRequested && (
                <div>
                  <p className="mb-6 text-white/70 text-sm">Your opponent wants to play again!</p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setRematchRequested(true);
                        fetch('/api/rooms', {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                          },
                          body: JSON.stringify({
                            action: 'rematch-request',
                            roomCode: roomId,
                            senderId: userId
                          }),
                        }).catch(error => {
                          console.error('Error sending rematch request:', error);
                        });
                        
                        setTimeout(() => {
                          if (isHost) {
                            startRematch();
                          }
                        }, 1000);
                      }}
                      className="btn-primary flex-1"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => {
                        setShowRematchModal(false);
                        setOpponentRematchRequested(false);
                      }}
                      className="btn-secondary flex-1"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              )}
              
              {rematchRequested && opponentRematchRequested && (
                <div className="flex flex-col items-center">
                  <p className="mb-6 text-white/70 text-sm">Starting new game...</p>
                  <div className="pulse-dots mb-8">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                  {isHost && (
                    <p className="text-xs text-emerald-400 font-bold">Host is starting the game...</p>
                  )}
                  {!isHost && (
                    <p className="text-xs text-cyan-400 font-bold">Waiting for host to start...</p>
                  )}
                </div>
              )}
              
              {!rematchRequested && !opponentRematchRequested && (
                <div>
                  <p className="mb-6 text-white/70 text-sm">Would you like to request a rematch?</p>
                  <div className="flex gap-3">
                    <button
                      onClick={restart}
                      className="btn-primary flex-1"
                    >
                      Rematch
                    </button>
                    <button
                      onClick={() => setShowRematchModal(false)}
                      className="btn-secondary flex-1"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Utils
function formatTime(sec) {
  const s = sec % 60;
  const m = Math.floor(sec / 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function cryptoRandomId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID)
    return crypto.randomUUID();
  return Math.random().toString(36).slice(2, 9);
}
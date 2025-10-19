// pages/memory.js
import { useEffect, useMemo, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/router";

const EMOJIS = [
  "🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐨","🐯","🦁","🐮",
  "🐸","🐵","🐔","🦄","🐙","🐝","🐞","🪲","🦋","🐢","🐬","🐳"
];

// Hard mode now uses 24 pairs (6x8 = 48 cards)
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
  socket = null,
  roomId = null,
  isMyTurn = false,
  setIsMyTurn = () => {},
  isHost = false,
  gameStarted = false, // <-- ensure this prop exists and defaults to false
}) {
  const router = useRouter();
  
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
  const [totalWins, setTotalWins] = useState({ red: 0, blue: 0 });
  const [winner, setWinner] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(false);

  // Particle container ref for bursts
  const particleContainer = useRef(null);

  // Name prompt states
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [playerName, setPlayerName] = useState("");
  const [submitting, setSubmitting] = useState(false);

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

    // Cleanup on unmount
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

  const createDeck = () => {
    const chosen = EMOJIS.slice(0, pairsCount);
    const pairEmojis = shuffle([...chosen, ...chosen]);
    const deck = pairEmojis.map((emoji, idx) => ({
      id: idx,
      emoji,
      uuid: cryptoRandomId(),
    }));
    setCards(deck);

    if (mode === "online" && socket && roomId && isHost) {
      socket.emit("deckReady", { roomId, deck, hostId: socket.id });
    }

    setFlipped([]);
    setMatchedIds(new Set());
    setMoves(0);
    setSeconds(0);
    stopTimer();
    setStarted(false);
    setDisabled(false);
    setCurrentPlayer(1);
    setPlayerScores({ 1: 0, 2: 0 });
    setWinner(null);
    setShowModal(false);
  };

  // Non-online modes create deck immediately (single/two)
  useEffect(() => {
    if (mode !== "online") {
      createDeck();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDifficulty, mode]);

  // When a deck is received from the host (non-host clients)
  useEffect(() => {
  if (mode !== "online" || !socket) return;

  const onDeckReady = ({ deck, hostId } = {}) => {
    console.log("[MemoryMatch] deckReady received", { deckLength: deck?.length, hostId });
    if (!deck || !Array.isArray(deck)) return;
    setCards(deck);
    setFlipped([]); 
    setMatchedIds(new Set());
    setMoves(0);
    setSeconds(0);
    setStarted(false);
    setDisabled(false);
    setPlayerScores({ 1: 0, 2: 0 });
    const iAmHost = socket.id === hostId;
    setIsMyTurn(iAmHost);
    setCurrentPlayer(iAmHost ? 1 : 2);
  };

  socket.on("deckReady", onDeckReady);
  return () => socket.off("deckReady", onDeckReady);
}, [mode, socket]);

  // Host: wait for the server 'startGame' (or gameStarted prop) before creating deck.
  useEffect(() => {
    if (mode !== "online") return;
    if (!socket) {
      console.log("[MemoryMatch] waiting for socket...");
      return;
    }
    if (!isHost) {
      console.log("[MemoryMatch] non-host waiting for deckReady");
      setCards([]); // blank until deck arrives
      return;
    }
    if (!roomId) {
      console.log("[MemoryMatch] host waiting for roomId...");
      return;
    }

    // If the parent already passed gameStarted true (onlineGame received startGame),
    // create deck now.
    if (gameStarted) {
      console.log("[MemoryMatch] gameStarted prop true — host creating deck for room", roomId);
      createDeck();
      setIsMyTurn(true);
      return;
    }

    // Otherwise, listen for server 'startGame' and create deck once it arrives.
    const onStart = ({ room: r, firstPlayer: fp } = {}) => {
      if (r !== roomId) return;
      console.log("[MemoryMatch] startGame received for room", r, "firstPlayer:", fp);
      createDeck();
      setIsMyTurn(socket.id === fp);
    };
    socket.on("startGame", onStart);

    // ensure cleanup
    return () => {
      if (socket) socket.off("startGame", onStart);
    };
    // include selectedDifficulty so if host changes difficulty before start it still works
  }, [mode, socket, isHost, roomId, selectedDifficulty, gameStarted]);

  useEffect(() => {
    if (!started) return;

    // Start timer for both local & online
    if (mode === "online" && socket && socket.connected && isMyTurn) {
      timerRef.current = setInterval(() => {
        setSeconds((s) => {
          const newSec = s + 1;
          socket.emit("timerUpdate", { roomId, seconds: newSec });
          return newSec;
        });
      }, 1000);
    } else {
      // Local single or two-player mode
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    }

    // Only listen if socket exists and connected
    if (mode === "online" && socket && socket.connected) {
      socket.on("timerUpdate", ({ seconds }) => setSeconds(seconds));
    }

    return () => {
      clearInterval(timerRef.current);
      timerRef.current = null;

      if (mode === "online" && socket && socket.connected) {
        socket.off("timerUpdate");
      }
    };
  }, [started, mode, isMyTurn, socket, roomId]);

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

  // Particle burst function (positions relative to particleContainer)
  const spawnParticles = (clientX, clientY) => {
    const container = particleContainer.current;
    if (!container) return;
    const containerRect = container.getBoundingClientRect();
    const localX = clientX - containerRect.left;
    const localY = clientY - containerRect.top;

    for (let i = 0; i < 12; i++) {
      const particle = document.createElement("div");
      particle.className = "mm-particle";
      particle.style.left = `${localX}px`;
      particle.style.top = `${localY}px`;
      container.appendChild(particle);

      const angle = Math.random() * Math.PI * 2;
      const distance = 20 + Math.random() * 50;
      const tx = Math.cos(angle) * distance;
      const ty = Math.sin(angle) * distance;
      const rot = (Math.random() * 360) | 0;
      particle.animate(
        [
          { transform: `translate(0,0) rotate(0deg) scale(1)`, opacity: 1 },
          { transform: `translate(${tx}px, ${ty}px) rotate(${rot}deg) scale(0.3)`, opacity: 0 }
        ],
        { duration: 600 + Math.random() * 200, easing: "cubic-bezier(.2,.7,.2,1)" }
      ).onfinish = () => particle.remove();
    }
  };

  // Handle game end
  useEffect(() => {
    if (cards.length > 0 && matchedIds.size === cards.length) {
      stopTimer();
      winSound.current?.play();

      // Two Player Mode Logic
      if (mode === "two") {
        let roundWinner = null;
        if (playerScores[1] > playerScores[2]) roundWinner = "red";
        else if (playerScores[2] > playerScores[1]) roundWinner = "blue";

        if (roundWinner) {
          setTotalWins((prev) => ({ ...prev, [roundWinner]: prev[roundWinner] + 1 }));
        }
        setWinner(roundWinner ? roundWinner : "draw");
      }

      // Single Player Mode Logic
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
        // Ask for player name
        setTimeout(() => setShowNamePrompt(true), 800);
      }

      // Online Multiplayer Mode Logic
      if (mode === "online" && socket && roomId) {
        socket.emit("gameOver", {
          roomId,
          winnerId: socket.id,
          winnerScore: playerScores, // optional
        });
        setWinner("you");
      }

      // Show result modal
      setTimeout(() => setShowModal(true), 1000);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchedIds, cards, moves, seconds]);

  const handleFlip = (index) => {
    if (index == null || !cards[index]) return;

    // Prevent flipping invalid cards
    if (disabled || flipped.includes(index) || matchedIds.has(cards[index]?.uuid)) return;
    if (mode === "online" && !isMyTurn) return; // only your turn

    if (!started) setStarted(true);

    const newFlipped = [...flipped, index];

    if (newFlipped.length === 2 && newFlipped[0] === newFlipped[1]) {
      setFlipped([newFlipped[0]]);
      return;
    }

    setFlipped(newFlipped);
    flipSound.current?.play();

    // EMIT CARD FLIP TO OPPONENT - FOR EVERY FLIP
    if (mode === "online" && socket && roomId) {
      socket.emit("cardFlip", { 
        roomId, 
        flippedIndex: index,
        cardId: cards[index].id,
        senderId: socket.id 
      });
    }

    // Once two cards are flipped → check for match
    if (newFlipped.length === 2) {
      setDisabled(true);

      // Now handle the match logic - DON'T emit playerMove here anymore
      handleMatchCheck(newFlipped);
    }
  };

  const handleMatchCheck = (newFlipped) => {
  const [i1, i2] = newFlipped;

  if (i1 == null || i2 == null || i1 === i2) {
    setTimeout(() => {
      setFlipped([]);
      setDisabled(false);

      if (mode === "online" && socket && roomId) {
        socket.emit("resetFlipped", { roomId, senderId: socket.id });
      }
    }, 400);
    return;
  }

  const c1 = cards[i1], c2 = cards[i2];

  if (!c1 || !c2) {
    setTimeout(() => {
      setFlipped([]);
      setDisabled(false);

      if (mode === "online" && socket && roomId) {
        socket.emit("resetFlipped", { roomId, senderId: socket.id });
      }
    }, 400);
    return;
  }

  const isMatch = c1?.emoji === c2?.emoji;

  // Increment moves
  setMoves((m) => m + 1);

  // Handle local updates first
  if (isMatch) {
    setMatchedIds((prev) => {
      const ns = new Set(prev);
      ns.add(c1.uuid);
      ns.add(c2.uuid);
      return ns;
    });

    setFlipped([]);
    matchSound.current?.play();
    setDisabled(false);

    // Update scores for two-player mode
    if (mode === "two") {
      setPlayerScores(prev => ({
        ...prev,
        [currentPlayer]: prev[currentPlayer] + 1
      }));
    }

    // EMIT MATCH TO OPPONENT - MOVED HERE FOR BETTER TIMING
    if (mode === "online" && socket && roomId) {
      const nextMatched = Array.from(new Set([...Array.from(matchedIds), c1.uuid, c2.uuid]));
      
      socket.emit("cardMatch", {
        roomId,
        matchedIds: nextMatched,
        senderId: socket.id,
      });

      socket.emit("matchCheck", {
        roomId,
        matched: nextMatched,
        flipped: [],
        moves: moves + 1,
        isMatch: true,
        senderId: socket.id,
      });
    }
  } else {
    setTimeout(() => {
      setFlipped([]);
      mismatchSound.current?.play();

      // Swap turns for 2-player local
      if (mode === "two") {
        setCurrentPlayer((p) => (p === 1 ? 2 : 1));
      }

      // In online mode, tell opponent to take turn
      if (mode === "online" && socket && roomId) {
        socket.emit("turnChange", { roomId, senderId: socket.id });
        setIsMyTurn(false);
        
        // Also emit the mismatch result
        socket.emit("matchCheck", {
          roomId,
          matched: Array.from(matchedIds),
          flipped: [],
          moves: moves + 1,
          isMatch: false,
          senderId: socket.id,
        });
      }

      setDisabled(false);
    }, 800);
  }
};

  // Online event listeners - FIXED VERSION
  useEffect(() => {
    if (mode !== "online" || !socket || !roomId) return;
    if (!socket.connected) return;

    // Handle individual card flips from opponent
    const onCardFlip = ({ flippedIndex, cardId, senderId } = {}) => {
      if (senderId && socket && senderId === socket.id) return;
      
      console.log("[MemoryMatch] opponent flipped card:", flippedIndex, cardId);
      
      // Flip the same card on our screen
      setFlipped(prev => {
        // Don't add if already flipped or matched
        if (prev.includes(flippedIndex) || matchedIds.has(cards[flippedIndex]?.uuid)) {
          return prev;
        }
        return [...prev, flippedIndex];
      });

      flipSound.current?.play();
    };

    const onCardMatch = ({ matchedIds: newMatchedIds, senderId } = {}) => {
      if (senderId && socket && senderId === socket.id) return;
      
      console.log("[MemoryMatch] opponent matched cards:", newMatchedIds);
      setMatchedIds(new Set(newMatchedIds || []));
      matchSound.current?.play();
    };

    const onResetFlipped = ({ senderId } = {}) => {
      if (senderId && socket && senderId === socket.id) return;
      
      console.log("[MemoryMatch] opponent reset flipped cards");
      setFlipped([]);
      mismatchSound.current?.play();
    };

    // When opponent flips cards
    const onPlayerMove = ({ flipped: newFlipped = [], senderId } = {}) => {
      if (senderId && socket && senderId === socket.id) return;

      console.log("[MemoryMatch] onPlayerMove received", newFlipped, "from", senderId);
      setFlipped(newFlipped || []);
      flipSound.current?.play();

      if ((newFlipped || []).length > 0) {
        setDisabled(true);
      }
    };

    const onMatchCheck = ({ matched = [], flipped: newFlipped = [], moves: newMoves = 0, isMatch, senderId } = {}) => {
      if (senderId && socket && senderId === socket.id) return;

      console.log("[MemoryMatch] onMatchCheck", { isMatch, matched });

      setMatchedIds(new Set(matched || []));
      setFlipped(newFlipped || []);
      setMoves(newMoves || 0);

      if (isMatch) {
        setIsMyTurn(false);
        setDisabled(true);
      } else {
        setIsMyTurn(true);
        setDisabled(false);
      }
    };

    socket.on("cardFlip", onCardFlip);
    socket.on("cardMatch", onCardMatch);
    socket.on("resetFlipped", onResetFlipped);
    socket.on("playerMove", onPlayerMove);
    socket.on("matchCheck", onMatchCheck);
    socket.on("turnChange", ({ senderId }) => {
      if (senderId && senderId === socket.id) return;
      setIsMyTurn(true);
      setDisabled(false);
    });

    socket.on("timerUpdate", ({ seconds } = {}) => {
      setSeconds(seconds);
    });

    socket.on("gameOver", ({ winner } = {}) => {
      setShowModal(true);
      setWinner(winner === socket.id ? "you" : "opponent");
    });

    return () => {
      if (!socket) return;
      socket.off("cardFlip", onCardFlip);
      socket.off("cardMatch", onCardMatch);
      socket.off("resetFlipped", onResetFlipped);
      socket.off("playerMove", onPlayerMove);
      socket.off("matchCheck", onMatchCheck);
      socket.off("turnChange");
      socket.off("timerUpdate");
      socket.off("gameOver");
    };
  }, [mode, socket, roomId, cards, matchedIds]); // ADDED cards and matchedIds dependencies

  useEffect(() => {
    if (mode !== "online" || !socket) return;

    socket.on("gameOver", ({ winner } = {}) => {
      setShowModal(true);
      if (winner === socket.id) {
        setWinner("you");
      } else {
        setWinner("opponent");
      }
    });

    return () => {
      socket.off("gameOver");
    };
  }, [mode, socket]);

  const restart = () => {
    createDeck();
    if (musicOn) {
      bgMusic.current.pause();
      bgMusic.current.currentTime = 0;
      bgMusic.current.play().catch(() => {});
    }
  };

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

  const bgColor = "bg-transparent";

  return (
    <div className={`relative h-screen flex items-center justify-center p-2 text-white overflow-hidden`}>
      <div className="absolute inset-0 -z-20">
        <div className="w-full h-full animate-gradient bg-[length:200%_200%] rounded-md"></div>
      </div>

      <div className="absolute inset-0 -z-10 pointer-events-none overflow-hidden">
        {[...Array(20)].map((_, i) => {
          const style = {
            top: `${Math.random() * 100}%`,
            left: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 5}s`,
            transform: `scale(${0.6 + Math.random() * 1.2})`,
            opacity: 0.6 + Math.random() * 0.4,
          };
          return <div key={i} className="mm-sparkle" style={style} />;
        })}
      </div>

      <div ref={particleContainer} className="absolute inset-0 pointer-events-none -z-5"></div>

      <div className={`w-full h-full max-w-5xl flex flex-col justify-between ${bgColor} transition-colors duration-500`}>
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-3">
          <div className="flex items-center justify-between w-full sm:w-auto">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">🧠 Memory Match</h1>
              <p className="text-xs opacity-90">
                {mode === "two" ? `Current Turn: ${currentPlayer === 1 ? "🔴 Red" : "🔵 Blue"}` : "Find all matching pairs!"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 justify-end">
            {mode === "two" && (
              <div className="flex flex-col text-sm sm:text-base font-semibold text-center">
                <div 
                  className="flex gap-4 justify-center px-4 py-2 rounded-2xl"
                  style={{
                    background: currentPlayer === 1 
                      ? "rgba(248, 113, 113, 0.25)"
                      : "rgba(59, 130, 246, 0.25)",
                    backdropFilter: "blur(8px)",
                    minWidth: "180px",
                  }}
                >
                  <span className={`${currentPlayer === 1 ? "underline" : ""} text-red-100`}>🔴 Red: {playerScores[1]}</span>
                  <span className={`${currentPlayer === 2 ? "underline" : ""} text-blue-100`}>🔵 Blue: {playerScores[2]}</span>
                </div>
                <div className="text-xs mt-1 opacity-90">🏆 Total Wins — 🔴 {totalWins.red} | 🔵 {totalWins.blue}</div>
              </div>
            )}
            <div className="text-xs sm:text-sm text-right flex-shrink-0">
              <div>Moves: <span className="font-semibold">{moves}</span></div>
              <div>Time: <span className="font-semibold">{formatTime(seconds)}</span></div>
            </div>

            {mode === "single" && (
              <div className="relative">
                <button
                  onClick={() => setOpenDropdown((prev) => !prev)}
                  className="relative w-36 bg-white/15 backdrop-blur-md text-white font-semibold rounded-lg px-3 py-2 text-sm shadow-lg border border-white/30 hover:bg-white/25 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-pink-300 focus:scale-105 flex items-center justify-between"
                >
                  {selectedDifficulty === "easy" && "🌱 Easy (4x4)"}
                  {selectedDifficulty === "medium" && "⚡ Medium (4x6)"}
                  {selectedDifficulty === "hard" && "🔥 Hard (6x8)"}
                  <span className="text-white/80 text-xs">▼</span>
                </button>

                <AnimatePresence>
                  {openDropdown && (
                    <motion.ul
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.2 }}
                      className="absolute z-50 w-36 mt-2 rounded-lg overflow-hidden bg-white/20 backdrop-blur-lg border border-white/30 shadow-xl"
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
                          className={`px-3 py-2 text-sm text-white cursor-pointer transition-all duration-200 hover:bg-white/30 ${
                            selectedDifficulty === opt.value ? "bg-white/25" : ""
                          }`}
                        >
                          {opt.label}
                        </li>
                      ))}
                    </motion.ul>
                  )}
                </AnimatePresence>

                <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 animate-gradient-x opacity-50 blur-sm pointer-events-none"></div>
              </div>
            )}

            <button onClick={restart} className="bg-white text-indigo-700 px-3 py-1 rounded font-medium shadow text-sm">Restart</button>
            <button onClick={handleBack} className="bg-white text-red-600 px-3 py-1 rounded font-medium shadow text-sm">← Back</button>
            <button onClick={toggleMusic} className="bg-white text-indigo-700 px-3 py-1 rounded font-medium shadow text-sm">
              {musicOn ? "🔊 Music On" : "🔇 Music Off"}
            </button>
          </div>
        </header>

        <section className={`grid ${gridCols} gap-1.5 sm:gap-2 md:gap-3 justify-items-center content-center flex-1 [perspective:1200px] my-1 ${selectedDifficulty === "hard" ? "max-w-[360px] sm:max-w-[500px] md:max-w-none mx-auto" : ""}`}>
          {cards.map((card, idx) => {
            const isFlipped = flipped.includes(idx) || matchedIds.has(card.uuid);
            return (
              <div
                key={card.id}
                data-card-uuid={card.uuid}
                onClick={() => handleFlip(idx)}
                className={`${cardSize} cursor-pointer transform transition-transform duration-300 hover:scale-105`}
              >
                <div className={`relative w-full h-full transition-transform duration-500 [transform-style:preserve-3d] ${isFlipped ? "[transform:rotateY(180deg)]" : ""}`}>
                  <div className="absolute inset-0 rounded-lg flex items-center justify-center text-base sm:text-lg md:text-xl lg:text-2xl select-none [backface-visibility:hidden] [transform:rotateY(0deg)] bg-white/10 border border-white/10">❓</div>
                  <div className="absolute inset-0 rounded-lg flex items-center justify-center text-lg sm:text-xl md:text-2xl lg:text-3xl select-none [backface-visibility:hidden] [transform:rotateY(180deg)] bg-white text-gray-900 shadow-lg">
                    {card.emoji}
                  </div>
                </div>
              </div>
            );
          })}
        </section>

        <footer className="flex items-center justify-between text-xs mt-2 sm:mt-0">
          {mode === "single" ? (
            <div>
              <p>Best ({selectedDifficulty}):</p>
              {bestScores[selectedDifficulty] ? (
                <div>
                  <span className="font-semibold">{bestScores[selectedDifficulty].moves} moves</span> • {formatTime(bestScores[selectedDifficulty].time)}
                </div>
              ) : <div className="opacity-90">No record yet</div>}
            </div>
          ) : <div />}

          <div className="opacity-80 text-right">Made with ❤️</div>
        </footer>

        {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md">
          <div className="bg-white rounded-lg p-6 w-80 sm:w-96 text-center text-gray-900 animate-scale-in">
            <h2 className="text-2xl font-bold mb-2">
              {mode === "online"
                ? winner === "you"
                  ? "🏆 You Won!"
                  : winner === "opponent"
                    ? "😢 You Lost!"
                    : "🤝 Draw!"
                : mode === "two"
                  ? winner === "draw"
                    ? "🤝 Draw!"
                    : winner === "red"
                      ? "🏆 🔴 Red Wins!"
                      : "🏆 🔵 Blue Wins!"
                  : "🎉 You Won!"}
            </h2>

            <p className="mb-2 text-sm opacity-90">Moves: {moves} • Time: {formatTime(seconds)}</p>

            {mode === "single" && (
              <>
                <p className="text-sm mb-2">Enter your name for the leaderboard:</p>
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value.slice(0, 15))}
                  placeholder="Your name"
                  className="w-full px-3 py-2 border rounded mb-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </>
            )}

            <div className="flex flex-col sm:flex-row justify-center gap-3 mt-2">
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
                  className="bg-indigo-600 text-white px-4 py-2 rounded font-medium hover:bg-indigo-700 transition"
                >
                  {submitting ? "Submitting..." : "Submit"}
                </button>
              )}

              <button
                onClick={restart}
                className="bg-indigo-600 text-white px-4 py-2 rounded font-medium hover:bg-indigo-700 transition"
              >
                Play Again
              </button>

              <button
                onClick={handleBack}
                className="bg-red-600 text-white px-4 py-2 rounded font-medium hover:bg-red-700 transition"
              >
                Exit to Menu
              </button>
            </div>
          </div>
        </div>
      )}
      </div>

      <style jsx>{`
        .animate-gradient {
          background: linear-gradient(120deg, #4f46e5 0%, #7c3aed 35%, #ec4899 70%);
          width: 100%;
          height: 100%;
          background-size: 200% 200%;
          animation: mmGradient 12s ease infinite;
        }
        @keyframes mmGradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .mm-sparkle { position: absolute; width: 6px; height: 6px; border-radius: 999px; background: radial-gradient(circle at 30% 30%, rgba(255,255,255,0.95), rgba(255,255,255,0.7) 40%, rgba(255,255,255,0.1) 60%); filter: blur(0.6px); animation: mmFloat 6s linear infinite; }
        @keyframes mmFloat { 0% { transform: translateY(0) scale(1); opacity: 0; } 10% { opacity: 0.8; } 50% { transform: translateY(-18px) scale(1.05); opacity: 0.9; } 100% { transform: translateY(-40px) scale(0.9); opacity: 0; } }
        .mm-particle { position: absolute; width: 8px; height: 8px; border-radius: 50%; background: radial-gradient(circle at 30% 30%, rgba(255,255,255,1), rgba(255,255,255,0.8) 40%, rgba(255,255,255,0.2) 80%); pointer-events: none; will-change: transform, opacity; }
        @keyframes scaleIn { from { transform: scale(.96); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .animate-scale-in { animation: scaleIn 240ms ease both; }
      `}</style>
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

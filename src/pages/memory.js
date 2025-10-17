import { useEffect, useMemo, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

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

export default function MemoryMatch({ mode = "single", difficulty = "easy", onBack }) {
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
      bgMusic.current.pause();
      bgMusic.current.currentTime = 0;
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

  useEffect(() => {
    createDeck();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDifficulty]);

  useEffect(() => {
    if (started && timerRef.current === null) {
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    }
    return () => stopTimer();
  }, [started]);

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

      if (mode === "two") {
        let roundWinner = null;
        if (playerScores[1] > playerScores[2]) roundWinner = "red";
        else if (playerScores[2] > playerScores[1]) roundWinner = "blue";

        if (roundWinner) {
          setTotalWins((prev) => ({ ...prev, [roundWinner]: prev[roundWinner] + 1 }));
        }
        setWinner(roundWinner ? roundWinner : "draw");
      }

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
      }

      setTimeout(() => setShowModal(true), 1000);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchedIds, cards, moves, seconds]);

  const handleFlip = (index) => {
    if (disabled || flipped.includes(index) || matchedIds.has(cards[index].uuid)) return;

    if (!started) setStarted(true);
    flipSound.current?.play();
    const newFlipped = [...flipped, index];
    setFlipped(newFlipped);

    if (newFlipped.length === 2) {
      setDisabled(true);
      setMoves((m) => m + 1);
      const [i1, i2] = newFlipped;
      const c1 = cards[i1];
      const c2 = cards[i2];

      if (c1.emoji === c2.emoji) {
        setTimeout(() => {
          setMatchedIds((prev) => new Set(prev).add(c1.uuid).add(c2.uuid));
          setFlipped([]);
          setDisabled(false);
          matchSound.current?.play();

          // compute a good central point to spawn particles: use bounding rects of the two cards
          const el1 = document.querySelector(`[data-card-uuid="${c1.uuid}"]`);
          const el2 = document.querySelector(`[data-card-uuid="${c2.uuid}"]`);
          if (el1 && el2 && particleContainer.current) {
            const r1 = el1.getBoundingClientRect();
            const r2 = el2.getBoundingClientRect();
            const centerX = (r1.left + r1.right + r2.left + r2.right) / 4;
            const centerY = (r1.top + r1.bottom + r2.top + r2.bottom) / 4;
            spawnParticles(centerX, centerY);
          }

          if (mode === "two") {
            setPlayerScores((prev) => ({ ...prev, [currentPlayer]: prev[currentPlayer] + 1 }));
          }
        }, 600);
      } else {
        setTimeout(() => {
          setFlipped([]);
          setDisabled(false);
          mismatchSound.current?.play();
          if (mode === "two") setCurrentPlayer(currentPlayer === 1 ? 2 : 1);
        }, 900);
      }
    }
  };

  const restart = () => {
    createDeck();
    if (musicOn) {
      bgMusic.current.pause();
      bgMusic.current.currentTime = 0;
      bgMusic.current.play().catch(() => {});
    }
  };

  const handleBack = () => {
    bgMusic.current.pause();
    bgMusic.current.currentTime = 0;
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

  // Decide bg color for header area (keeps your original logic)
  const bgColor = "bg-transparent";

  return (
    <div className={`relative h-screen flex items-center justify-center p-2 text-white overflow-hidden`}>
      {/* Animated gradient background (behind everything) */}
      <div className="absolute inset-0 -z-20">
        <div className="w-full h-full animate-gradient bg-[length:200%_200%] rounded-md"></div>
      </div>

      {/* Floating sparkles (subtle decorative) */}
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

      {/* Particle burst container */}
      <div ref={particleContainer} className="absolute inset-0 pointer-events-none -z-5"></div>

      <div className={`w-full h-full max-w-5xl flex flex-col justify-between ${bgColor} transition-colors duration-500`}>
        {/* Header */}
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
                      ? "rgba(248, 113, 113, 0.25)"  // red translucent
                      : "rgba(59, 130, 246, 0.25)",  // blue translucent
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
                {/* Selected difficulty button */}
                <button
                  onClick={() => setOpenDropdown((prev) => !prev)}
                  className="relative w-36 bg-white/15 backdrop-blur-md text-white font-semibold rounded-lg px-3 py-2 text-sm shadow-lg border border-white/30 hover:bg-white/25 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-pink-300 focus:scale-105 flex items-center justify-between"
                >
                  {selectedDifficulty === "easy" && "🌱 Easy (4x4)"}
                  {selectedDifficulty === "medium" && "⚡ Medium (4x6)"}
                  {selectedDifficulty === "hard" && "🔥 Hard (6x8)"}
                  <span className="text-white/80 text-xs">▼</span>
                </button>

                {/* Animated dropdown menu */}
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

                {/* Glowing animated gradient border */}
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

        {/* Game Grid */}
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

        {/* Footer */}
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

        {/* Game Over Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md">
            <div className="bg-white rounded-lg p-6 w-80 sm:w-96 text-center text-gray-900 animate-scale-in">
              <h2 className="text-2xl font-bold mb-2">
                {mode==="two"
                  ? winner==="draw"
                    ? "🤝 Draw!"
                    : winner==="red"
                      ? "🏆 🔴 Red Wins!"
                      : "🏆 🔵 Blue Wins!"
                  : "🎉 You Won!"}
              </h2>
              <p className="mb-4 text-sm opacity-90">Moves: {moves} • Time: {formatTime(seconds)}</p>
              <div className="flex justify-center gap-3">
                <button onClick={restart} className="bg-indigo-600 text-white px-4 py-2 rounded font-medium shadow hover:bg-indigo-700 transition">Play Again</button>
                <button onClick={handleBack} className="bg-red-600 text-white px-4 py-2 rounded font-medium shadow hover:bg-red-700 transition">Exit to Menu</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Styles for gradient, sparkles, particles */}
      <style jsx>{`
        /* animated gradient */
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

        /* sparkles */
        .mm-sparkle {
          position: absolute;
          width: 6px;
          height: 6px;
          border-radius: 999px;
          background: radial-gradient(circle at 30% 30%, rgba(255,255,255,0.95), rgba(255,255,255,0.7) 40%, rgba(255,255,255,0.1) 60%);
          filter: blur(0.6px);
          animation: mmFloat 6s linear infinite;
        }
        @keyframes mmFloat {
          0% { transform: translateY(0) scale(1); opacity: 0; }
          10% { opacity: 0.8; }
          50% { transform: translateY(-18px) scale(1.05); opacity: 0.9; }
          100% { transform: translateY(-40px) scale(0.9); opacity: 0; }
        }

        /* particles (burst) */
        .mm-particle {
          position: absolute;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: radial-gradient(circle at 30% 30%, rgba(255,255,255,1), rgba(255,255,255,0.8) 40%, rgba(255,255,255,0.2) 80%);
          pointer-events: none;
          will-change: transform, opacity;
        }

        /* modal animation (kept simple) */
        @keyframes scaleIn {
          from { transform: scale(.96); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
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

import { useEffect, useMemo, useState, useRef } from "react";

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
  }, [matchedIds, cards, moves, seconds, mode, selectedDifficulty, bestScores, playerScores]);

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

  const bgColor =
    mode === "two"
      ? currentPlayer === 1
        ? "bg-red-400"
        : "bg-blue-400"
      : "bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600";

  return (
    <div className={`h-screen flex items-center justify-center p-2 transition-colors duration-500 ${bgColor} text-white`}>
      <div className="w-full h-full max-w-5xl flex flex-col justify-between">
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
                <div className="flex gap-4 justify-center">
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
              <select
                value={selectedDifficulty}
                onChange={(e) => setSelectedDifficulty(e.target.value)}
                className="text-black rounded px-2 py-1 text-sm"
              >
                <option value="easy">Easy (4x4)</option>
                <option value="medium">Medium (4x6)</option>
                <option value="hard">Hard (6x8)</option>
              </select>
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
              <div key={card.id} onClick={() => handleFlip(idx)} className={`${cardSize} cursor-pointer`}>
                <div className={`relative w-full h-full transition-transform duration-500 [transform-style:preserve-3d] ${isFlipped ? "[transform:rotateY(180deg)]" : ""}`}>
                  <div className="absolute inset-0 rounded-lg flex items-center justify-center text-base sm:text-lg md:text-xl lg:text-2xl select-none [backface-visibility:hidden] [transform:rotateY(0deg)] bg-white/10 border border-white/10">❓</div>
                  <div className="absolute inset-0 rounded-lg flex items-center justify-center text-base sm:text-lg md:text-xl lg:text-2xl select-none [backface-visibility:hidden] [transform:rotateY(180deg)] bg-white text-gray-900 shadow-lg">{card.emoji}</div>
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

import { useEffect, useMemo, useState, useRef } from "react";

const EMOJIS = [
  "🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐨","🐯","🦁","🐮",
  "🐸","🐵","🐔","🦄","🐙","🐝","🐞","🪲","🦋","🐢","🐬","🐳"
];

// Hard mode now uses 24 pairs (6x8 = 48 cards)
const DIFFICULTIES = {
  easy: 8,
  medium: 12,
  hard: 24
};

function shuffle(array) {
  const a = array.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function MemoryMatch({ mode = "single" }) {
  const [difficulty, setDifficulty] = useState("easy");
  const pairsCount = DIFFICULTIES[difficulty];
  const [cards, setCards] = useState([]);
  const [flipped, setFlipped] = useState([]);
  const [matchedIds, setMatchedIds] = useState(new Set());
  const [moves, setMoves] = useState(0);
  const [disabled, setDisabled] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const timerRef = useRef(null);
  const [started, setStarted] = useState(false);

  const [bestScores, setBestScores] = useState({});

  // Two-player states
  const [currentPlayer, setCurrentPlayer] = useState(1);
  const [playerScores, setPlayerScores] = useState({ 1: 0, 2: 0 });

  // Load best scores
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("memory_best")) || {};
      setBestScores(stored);
    } catch {}
  }, []);

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
    // reset two-player scores
    setCurrentPlayer(1);
    setPlayerScores({ 1: 0, 2: 0 });
  };

  useEffect(() => {
    createDeck();
  }, [difficulty]);

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

  useEffect(() => {
    if (cards.length > 0 && matchedIds.size === cards.length) {
      stopTimer();
      if (mode === "single") {
        const prev = bestScores[difficulty];
        const current = { moves, time: seconds };
        let shouldSave = !prev || current.moves < prev.moves || (current.moves === prev.moves && current.time < prev.time);
        if (shouldSave) {
          const updated = { ...bestScores, [difficulty]: current };
          setBestScores(updated);
          if (typeof window !== "undefined") {
            localStorage.setItem("memory_best", JSON.stringify(updated));
          }
        }
      }
    }
  }, [matchedIds, cards, moves, seconds, mode, difficulty, bestScores]);

  const handleFlip = (index) => {
    if (disabled || flipped.includes(index) || matchedIds.has(cards[index].uuid)) return;

    if (!started) setStarted(true);
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

          // update score for two-player mode
          if (mode === "two") {
            setPlayerScores((prev) => ({ ...prev, [currentPlayer]: prev[currentPlayer] + 1 }));
          }
        }, 600);
      } else {
        setTimeout(() => {
          setFlipped([]);
          setDisabled(false);

          // switch player turn if two-player mode
          if (mode === "two") {
            setCurrentPlayer(currentPlayer === 1 ? 2 : 1);
          }
        }, 900);
      }
    }
  };

  const restart = () => createDeck();

  const gridCols = useMemo(() => {
    if (pairsCount <= 8) return "grid-cols-4";
    if (pairsCount <= 12) return "grid-cols-4 md:grid-cols-6";
    return "grid-cols-[repeat(auto-fit,minmax(55px,1fr))] md:grid-cols-6 xl:grid-cols-8";
  }, [pairsCount]);

  const cardSize = useMemo(() => {
    if (difficulty === 'hard') {
      return "w-[55px] h-[55px] sm:w-[65px] sm:h-[65px] md:w-[70px] md:h-[70px] lg:w-20 lg:h-20 xl:w-24 xl:h-24";
    }
    return "w-[70px] h-[70px] sm:w-[75px] sm:h-[75px] md:w-20 md:h-20 lg:w-24 lg:h-24";
  }, [difficulty]);

  const allMatched = cards.length > 0 && matchedIds.size === cards.length;

  // background color
  const bgColor = mode === "two" ? (currentPlayer === 1 ? "bg-red-500" : "bg-blue-500") : "bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600";

  return (
    <div className={`h-screen flex items-center justify-center p-2 transition-colors duration-500 ${bgColor} text-white`}>
      <div className="w-full h-full max-w-5xl flex flex-col justify-between">
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-3">
          <div className="flex items-center justify-between w-full sm:w-auto">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">🧠 Memory Match</h1>
              <p className="text-xs opacity-90">Find all matching pairs!</p>
            </div>
            <div className="flex items-center gap-2 sm:hidden">
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className="text-black rounded px-2 py-1 text-xs"
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
              <button onClick={restart} className="bg-white text-indigo-700 px-2 py-1 rounded font-medium shadow text-xs">
                Restart
              </button>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-3">
            {mode === "two" && (
              <div className="flex gap-4 text-lg font-semibold">
                <span className={currentPlayer === 1 ? "underline" : ""}>Player 1: {playerScores[1]}</span>
                <span className={currentPlayer === 2 ? "underline" : ""}>Player 2: {playerScores[2]}</span>
              </div>
            )}
            <div className="text-sm">
              <div>Moves: <span className="font-semibold">{moves}</span></div>
              <div>Time: <span className="font-semibold">{formatTime(seconds)}</span></div>
            </div>

            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="text-black rounded px-2 py-1 text-sm"
            >
              <option value="easy">Easy (4×4)</option>
              <option value="medium">Medium (4×6)</option>
              <option value="hard">Hard (6×8)</option>
            </select>

            <button onClick={restart} className="bg-white text-indigo-700 px-3 py-1 rounded font-medium shadow text-sm">
              Restart
            </button>
          </div>
        </header>

        {/* Game Grid */}
        <section
          className={`grid ${gridCols} gap-1.5 sm:gap-2 md:gap-3 justify-items-center content-center flex-1 [perspective:1200px] my-1 ${difficulty === 'hard' ? 'max-w-[360px] sm:max-w-[500px] md:max-w-none mx-auto' : ''}`}
        >
          {cards.map((card, idx) => {
            const isFlipped = flipped.includes(idx) || matchedIds.has(card.uuid);
            return (
              <div key={card.id} onClick={() => handleFlip(idx)} className={`${cardSize} cursor-pointer`}>
                <div className={`relative w-full h-full transition-transform duration-500 [transform-style:preserve-3d] ${isFlipped ? "[transform:rotateY(180deg)]" : ""}`}>
                  <div className="absolute inset-0 rounded-lg flex items-center justify-center text-base sm:text-lg md:text-xl lg:text-2xl select-none [backface-visibility:hidden] [transform:rotateY(0deg)] bg-white/10 border border-white/10">
                    ❓
                  </div>
                  <div className="absolute inset-0 rounded-lg flex items-center justify-center text-base sm:text-lg md:text-xl lg:text-2xl select-none [backface-visibility:hidden] [transform:rotateY(180deg)] bg-white text-gray-900 shadow-lg">
                    {card.emoji}
                  </div>
                </div>
              </div>
            );
          })}
        </section>

        {/* Footer */}
        <footer className="flex items-center justify-between text-xs mt-2 sm:mt-0">
          <div>
            <p>Best ({difficulty}):</p>
            {mode === "single" && bestScores[difficulty] ? (
              <div>
                <span className="font-semibold">{bestScores[difficulty].moves} moves</span> • {formatTime(bestScores[difficulty].time)}
              </div>
            ) : (
              <div className="opacity-90">{mode === "single" ? "No record yet" : ""}</div>
            )}
          </div>

          <div className="text-right">
            {allMatched ? (
              <div className="flex flex-col items-end">
                <div className="text-base font-semibold">{mode === "two" ? "🎉 Game Over!" : "🎉 You won!"}</div>
                <div className="text-xs mb-1">
                  Moves: <b>{moves}</b> • Time: <b>{formatTime(seconds)}</b>
                </div>
                <button onClick={restart} className="bg-white text-indigo-700 px-3 py-1 rounded font-medium shadow text-xs">
                  Play Again
                </button>
              </div>
            ) : (
              <div className="opacity-90">Find all pairs to win</div>
            )}
          </div>
        </footer>
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
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).slice(2, 9);
}

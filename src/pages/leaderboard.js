import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/router";

export default function Leaderboard() {
  const [difficulty, setDifficulty] = useState("easy");
  const [scores, setScores] = useState([]);
  const [sortBy, setSortBy] = useState("moves"); // moves or time
  const [sortOrder, setSortOrder] = useState("asc"); // asc or desc

  const tabs = ["easy", "medium", "hard"];

  const router = useRouter();

  useEffect(() => {
    fetch(`/api/leaderboard?difficulty=${difficulty}`)
      .then((res) => res.json())
      .then((data) => setScores(data || []));
  }, [difficulty]);

  const sortedScores = useMemo(() => {
    const sorted = [...scores].sort((a, b) => {
      if (sortBy === "moves") {
        return sortOrder === "asc" ? a.moves - b.moves : b.moves - a.moves;
      } else {
        return sortOrder === "asc" ? a.time - b.time : b.time - a.time;
      }
    });
    return sorted.slice(0, 15);
  }, [scores, sortBy, sortOrder]);

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-start bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 text-white p-4 pt-10">
      {/* Title */}
      <h1 className="text-3xl sm:text-4xl font-bold mb-6 drop-shadow-lg">🏆 Leaderboard</h1>

      {/* Difficulty Tabs */}
      <div className="flex flex-wrap justify-center gap-3 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setDifficulty(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === difficulty
                ? "bg-white/30 border border-white/40 shadow-lg"
                : "bg-white/10 hover:bg-white/20"
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Table Container */}
      <div className="w-full max-w-full sm:max-w-3xl mx-auto">
        {/* Table Header */}
        <div className="flex bg-white/20 rounded-t-xl border border-white/20 text-sm h-10 items-center">
          <div className="flex-1 px-4 text-left font-semibold">Player</div>
          <div
            className="w-24 px-4 text-center font-semibold cursor-pointer select-none flex justify-center items-center"
            onClick={() => handleSort("moves")}
          >
            Moves
            <span className="ml-1">{sortBy === "moves" ? (sortOrder === "asc" ? "⬇️" : "⬆️") : ""}</span>
          </div>
          <div
            className="w-24 px-4 text-center font-semibold cursor-pointer select-none flex justify-center items-center"
            onClick={() => handleSort("time")}
          >
            Time
            <span className="ml-1">{sortBy === "time" ? (sortOrder === "asc" ? "⬇️" : "⬆️") : ""}</span>
          </div>
        </div>

        {/* Scrollable Scores */}
        <div className="max-h-[500px] overflow-y-auto border border-t-0 border-white/20 rounded-b-xl">
          {sortedScores.length > 0 ? (
            sortedScores.map((s, i) => (
              <div
                key={i}
                className="flex w-full border-b border-white/20 last:border-b-0 hover:bg-gradient-to-r hover:from-pink-500/30 hover:via-purple-500/30 hover:to-indigo-500/30 transition h-10 items-center"
              >
                <div className="flex-1 px-4 overflow-x-auto whitespace-nowrap">{s.player}</div>
                <div className="w-24 px-4 text-center flex-shrink-0">{s.moves}</div>
                <div className="w-24 px-4 text-center flex-shrink-0">{s.time}s</div>
              </div>
            ))
          ) : (
            <div className="px-4 py-4 text-center opacity-80">No scores yet for <strong>{difficulty}</strong></div>
          )}
        </div>
      </div>

      {/* Back Button */}
      <button
        onClick={() => router.push("/memoryHome")}
        className="mt-6 px-6 py-3 bg-white/20 border border-white/30 rounded-lg backdrop-blur-md text-white/90 font-medium hover:bg-white/30 transition-all"
      >
        ← Back
      </button>
    </div>
  );
}

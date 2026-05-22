import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/router";
import { motion, AnimatePresence } from "framer-motion";

export default function Leaderboard({ onBack }) {
  const [difficulty, setDifficulty] = useState("easy");
  const [scores, setScores] = useState([]);
  const [sortBy, setSortBy] = useState("moves"); // moves or time
  const [sortOrder, setSortOrder] = useState("asc"); // asc or desc
  const [isLoading, setIsLoading] = useState(true);

  const tabs = ["easy", "medium", "hard"];
  const router = useRouter();

  useEffect(() => {
    setIsLoading(true);
    fetch(`/api/leaderboard?difficulty=${difficulty}`)
      .then((res) => res.json())
      .then((data) => {
        setScores(data || []);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch leaderboard:", err);
        setIsLoading(false);
      });
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

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.push("/memoryHome");
    }
  };

  // Framer Motion variants
  const pageVariants = {
    hidden: { opacity: 0, scale: 0.98 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.4, ease: "easeOut" } },
  };

  const listContainerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
      },
    },
  };

  const rowVariants = {
    hidden: { opacity: 0, y: 12 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { type: "spring", stiffness: 100, damping: 15 },
    },
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-start relative overflow-x-hidden text-white p-4 pt-12 pb-20">
      {/* 🎨 Cosmic Animated Background */}
      <div className="cosmic-bg"></div>

      {/* ✨ Floating Blur Orbs */}
      <div className="floating-orb orb-1 opacity-20"></div>
      <div className="floating-orb orb-2 opacity-25"></div>
      <div className="floating-orb orb-3 opacity-15"></div>

      <motion.div
        variants={pageVariants}
        initial="hidden"
        animate="visible"
        className="w-full max-w-3xl flex flex-col items-center z-10"
      >
        {/* Header Title Section */}
        <div className="text-center mb-8">
          <motion.div
            className="text-6xl mb-3 inline-block drop-shadow-[0_0_30px_rgba(245,158,11,0.5)]"
            animate={{ rotate: [0, 5, -5, 0] }}
            transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}
          >
            🏆
          </motion.div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight neon-text-gradient drop-shadow-[0_2px_15px_rgba(0,0,0,0.5)]">
            Cosmic Champions
          </h1>
          <p className="text-white/60 text-sm mt-2 max-w-md">
            Behold the hall of records. High scores and galactic records sorted by precision and speed.
          </p>
        </div>

        {/* Difficulty Selector Tabs */}
        <div className="mb-8">
          <div className="pill-tabs">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setDifficulty(tab)}
                className={`pill-tab ${tab === difficulty ? "active" : ""}`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Table Container card */}
        <div className="glass-card-static w-full shadow-2xl overflow-hidden border border-white/10 rounded-2xl mb-8">
          <div className="overflow-x-auto">
            <table className="lb-table">
              <thead>
                <tr className="lb-header">
                  <th className="lb-rank text-center">Rank</th>
                  <th className="text-left">Player</th>
                  <th
                    className="w-28 text-center cursor-pointer select-none"
                    onClick={() => handleSort("moves")}
                  >
                    <div className="flex items-center justify-center gap-1.5 hover:text-white transition-colors">
                      Moves
                      <span className="text-[10px] text-cyan-400">
                        {sortBy === "moves" ? (sortOrder === "asc" ? "▲" : "▼") : "⇅"}
                      </span>
                    </div>
                  </th>
                  <th
                    className="w-28 text-center cursor-pointer select-none"
                    onClick={() => handleSort("time")}
                  >
                    <div className="flex items-center justify-center gap-1.5 hover:text-white transition-colors">
                      Time
                      <span className="text-[10px] text-violet-400">
                        {sortBy === "time" ? (sortOrder === "asc" ? "▲" : "▼") : "⇅"}
                      </span>
                    </div>
                  </th>
                </tr>
              </thead>

              {/* Table Body */}
              <AnimatePresence mode="wait">
                <motion.tbody
                  key={`${difficulty}-${sortBy}-${sortOrder}-${isLoading}`}
                  variants={listContainerVariants}
                  initial="hidden"
                  animate="visible"
                >
                  {isLoading ? (
                    <tr>
                      <td colSpan="4" className="py-24 text-center">
                        <div className="pulse-dots mb-4">
                          <span></span>
                          <span></span>
                          <span></span>
                        </div>
                        <p className="text-xs tracking-wider uppercase font-bold text-white/40">Scanning Galaxy scores...</p>
                      </td>
                    </tr>
                  ) : sortedScores.length > 0 ? (
                    sortedScores.map((score, index) => {
                      const rank = index + 1;
                      let rankDisplay = rank;
                      let medalClass = "";

                      if (rank === 1) {
                        rankDisplay = "🥇";
                        medalClass = "gold";
                      } else if (rank === 2) {
                        rankDisplay = "🥈";
                        medalClass = "silver";
                      } else if (rank === 3) {
                        rankDisplay = "🥉";
                        medalClass = "bronze";
                      }

                      return (
                        <motion.tr
                          key={score._id || index}
                          variants={rowVariants}
                          className="lb-row group"
                        >
                          <td className="lb-rank text-center font-bold">
                            {medalClass ? (
                              <span className={`lb-medal ${medalClass}`}>{rankDisplay}</span>
                            ) : (
                              <span className="text-white/40 font-mono text-sm">{rank}</span>
                            )}
                          </td>
                          <td className="font-semibold text-white/90 group-hover:text-white transition-colors max-w-[200px] truncate">
                            {score.player}
                          </td>
                          <td className="w-24 text-center font-bold text-cyan-400">
                            {score.moves}
                          </td>
                          <td className="w-24 text-center font-bold text-violet-400">
                            {score.time}s
                          </td>
                        </motion.tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="4" className="py-24 text-center">
                        <motion.div
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ type: "spring", stiffness: 100, delay: 0.1 }}
                        >
                          <div className="text-5xl mb-4">🌌</div>
                          <h3 className="text-lg font-extrabold text-white">Quiet Cosmos</h3>
                          <p className="text-xs text-white/50 max-w-xs mx-auto px-4 mt-1">
                            No high scores logged for <strong>{difficulty}</strong> yet. Play a game and write your name in the stars!
                          </p>
                        </motion.div>
                      </td>
                    </tr>
                  )}
                </motion.tbody>
              </AnimatePresence>
            </table>
          </div>
        </div>

        {/* Back Button */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          onClick={handleBack}
          className="btn-secondary w-full sm:w-auto px-8"
        >
          ← Back to Main Menu
        </motion.button>
      </motion.div>
    </div>
  );
}

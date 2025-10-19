import { useState } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/router";

// Lazy load components
const MemoryMatch = dynamic(() => import("./memory"), { ssr: false });
const Leaderboard = dynamic(() => import("./leaderboard"), { ssr: false });

export default function MemoryHome() {
  const router = useRouter();

  const [mode, setMode] = useState(null);
  const [difficulty, setDifficulty] = useState(null);
  const [view, setView] = useState("home"); // "home" | "difficulty" | "game" | "leaderboard"

  const fadeUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  const handleModeSelect = (selectedMode) => {
    setMode(selectedMode);
    setView("difficulty");
  };

  const startGame = (selectedMode, selectedDifficulty) => {
    setMode(selectedMode);
    setDifficulty(selectedDifficulty);
    setView("game");
  };

  return (
    <div className="h-screen flex flex-col items-center justify-center relative overflow-hidden text-white">
      {/* 🎨 Animated Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 animate-gradient-x"></div>

      {/* ✨ Floating Blur Orbs */}
      <div className="absolute w-72 h-72 bg-pink-500/30 rounded-full blur-3xl top-10 left-10 animate-pulse"></div>
      <div className="absolute w-72 h-72 bg-indigo-500/30 rounded-full blur-3xl bottom-10 right-10 animate-pulse"></div>

      <AnimatePresence mode="wait">
        {/* 🏠 HOME SCREEN */}
        {view === "home" && (
          <motion.div
            key="home"
            initial="hidden"
            animate="visible"
            exit={{ opacity: 0, y: -20 }}
            variants={fadeUp}
            transition={{ duration: 0.6 }}
            className="z-10 flex flex-col items-center text-center"
          >
            <motion.h1
              className="text-5xl font-extrabold mb-4 tracking-wide drop-shadow-lg"
              variants={fadeUp}
            >
              🧠 Memory Match
            </motion.h1>
            <motion.p
              className="text-lg mb-8 text-white/90"
              variants={fadeUp}
              transition={{ delay: 0.2 }}
            >
              Test your memory — solo or with a friend!
            </motion.p>

            <motion.div
              className="flex gap-6"
              variants={fadeUp}
              transition={{ delay: 0.3 }}
            >
              <button
                onClick={() => handleModeSelect("single")}
                className="relative group px-8 py-3 rounded-xl bg-white/15 backdrop-blur-md text-white font-semibold border border-white/30 shadow-lg overflow-hidden transition-all duration-300 hover:scale-105"
              >
                <span className="relative z-10">🎮 1 Player</span>
                <div className="absolute inset-0 bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 opacity-0 group-hover:opacity-40 transition-all duration-300"></div>
              </button>

              <button
                onClick={() => handleModeSelect("two")}
                className="relative group px-8 py-3 rounded-xl bg-white/15 backdrop-blur-md text-white font-semibold border border-white/30 shadow-lg overflow-hidden transition-all duration-300 hover:scale-105"
              >
                <span className="relative z-10">🤝 2 Players</span>
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500 via-indigo-500 to-pink-500 opacity-0 group-hover:opacity-40 transition-all duration-300"></div>
              </button>
            </motion.div>

            {/* 🏆 Leaderboard Button */}
            <motion.button
              onClick={() => router.push("/leaderboard")}
              className="mt-8 px-6 py-2 bg-white/20 border border-white/30 rounded-lg backdrop-blur-md text-white/90 font-medium hover:bg-white/30 hover:scale-105 transition-all"
              variants={fadeUp}
              transition={{ delay: 0.4 }}
            >
              🏆 View Leaderboard
            </motion.button>

            <motion.button
              onClick={() => router.push("/online")}
              className="mt-8 px-6 py-2 bg-white/20 border border-white/30 rounded-lg backdrop-blur-md text-white/90 font-medium hover:bg-white/30 hover:scale-105 transition-all"
            >
              <span className="relative z-10">🌐 Online Multiplayer</span>
              <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-teal-500 to-blue-500 opacity-0 group-hover:opacity-40 transition-all duration-300"></div>
            </motion.button>

          </motion.div>
        )}

        {/* ⚙️ DIFFICULTY SELECTION */}
        {view === "difficulty" && (
          <motion.div
            key="difficulty"
            initial="hidden"
            animate="visible"
            exit={{ opacity: 0, y: -20 }}
            variants={fadeUp}
            transition={{ duration: 0.6 }}
            className="z-10 flex flex-col items-center text-center"
          >
            <motion.h1
              className="text-4xl font-bold mb-6"
              variants={fadeUp}
              transition={{ delay: 0.2 }}
            >
              Select Difficulty
            </motion.h1>

            <motion.div
              className="flex flex-col sm:flex-row gap-6"
              variants={fadeUp}
              transition={{ delay: 0.3 }}
            >
              {[
                { level: "easy", label: "🌱 Easy (4x4)" },
                { level: "medium", label: "⚡ Medium (4x6)" },
                { level: "hard", label: "🔥 Hard (6x8)" },
              ].map(({ level, label }) => (
                <button
                  key={level}
                  onClick={() => startGame(mode, level)}
                  className="relative group px-6 py-3 rounded-xl bg-white/15 backdrop-blur-md text-white font-semibold border border-white/30 shadow-lg overflow-hidden transition-all duration-300 hover:scale-105"
                >
                  <span className="relative z-10">{label}</span>
                  <div className="absolute inset-0 bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 opacity-0 group-hover:opacity-40 transition-all duration-300"></div>
                </button>
              ))}
            </motion.div>

            <button
              onClick={() => {
                setView("home");
                setMode(null);
              }}
              className="mt-8 text-sm text-white/70 hover:text-white transition"
            >
              ← Back
            </button>
          </motion.div>
        )}

        {/* 🧩 GAME VIEW */}
        {view === "game" && mode && difficulty && (
          <MemoryMatch
            mode={mode}
            difficulty={difficulty}
            onBack={() => {
              setMode(null);
              setDifficulty(null);
              setView("home");
            }}
          />
        )}

        {/* 🏆 LEADERBOARD VIEW */}
        {view === "leaderboard" && (
          <motion.div
            key="leaderboard"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
            className="z-10 flex flex-col items-center justify-center w-full h-full"
          >
            <Leaderboard onBack={() => setView("home")} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

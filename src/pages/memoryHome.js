import { useState } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";

const MemoryMatch = dynamic(() => import("./memory"), { ssr: false });

export default function MemoryHome() {
  const [mode, setMode] = useState(null);
  const [difficulty, setDifficulty] = useState(null);

  const startGame = (selectedMode, selectedDifficulty) => {
    setMode(selectedMode);
    setDifficulty(selectedDifficulty);
  };

  // Animation variants
  const fadeUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  // 🌌 Main screen
  return (
    <div className="h-screen flex flex-col items-center justify-center relative overflow-hidden text-white">
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 animate-gradient-x"></div>

      {/* Subtle moving blur orbs for depth */}
      <div className="absolute w-72 h-72 bg-pink-500/30 rounded-full blur-3xl top-10 left-10 animate-pulse"></div>
      <div className="absolute w-72 h-72 bg-indigo-500/30 rounded-full blur-3xl bottom-10 right-10 animate-pulse"></div>

      <AnimatePresence mode="wait">
        {/* 🎯 MODE SELECTION */}
        {!mode && (
          <motion.div
            key="mode"
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
              transition={{ delay: 0.2 }}
            >
              🧠 Memory Match
            </motion.h1>
            <motion.p
              className="text-lg mb-8 text-white/90"
              variants={fadeUp}
              transition={{ delay: 0.3 }}
            >
              Test your memory — solo or with a friend!
            </motion.p>

            <motion.div
              className="flex gap-6"
              variants={fadeUp}
              transition={{ delay: 0.4 }}
            >
              <button
                onClick={() => setMode("single")}
                className="relative group px-8 py-3 rounded-xl bg-white/15 backdrop-blur-md text-white font-semibold border border-white/30 shadow-lg overflow-hidden transition-all duration-300 hover:scale-105"
              >
                <span className="relative z-10">🎮 1 Player</span>
                <div className="absolute inset-0 bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 opacity-0 group-hover:opacity-40 transition-all duration-300"></div>
              </button>

              <button
                onClick={() => setMode("two")}
                className="relative group px-8 py-3 rounded-xl bg-white/15 backdrop-blur-md text-white font-semibold border border-white/30 shadow-lg overflow-hidden transition-all duration-300 hover:scale-105"
              >
                <span className="relative z-10">🤝 2 Players</span>
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500 via-indigo-500 to-pink-500 opacity-0 group-hover:opacity-40 transition-all duration-300"></div>
              </button>
            </motion.div>
          </motion.div>
        )}

        {/* ⚙️ DIFFICULTY SELECTION */}
        {mode && !difficulty && (
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
              className="flex gap-6"
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
              onClick={() => setMode(null)}
              className="mt-8 text-sm text-white/70 hover:text-white transition"
            >
              ← Back
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Render game when both mode & difficulty are chosen */}
      {mode && difficulty && (
        <MemoryMatch
          mode={mode}
          difficulty={difficulty}
          onBack={() => {
            setMode(null);
            setDifficulty(null);
          }}
        />
      )}
    </div>
  );
}

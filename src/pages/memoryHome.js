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

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: "spring",
        stiffness: 100,
        damping: 15,
      },
    },
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
    <div className="min-h-screen w-full flex flex-col items-center justify-center relative overflow-x-hidden text-white py-12 px-4">
      {/* 🎨 Cosmic Animated Background */}
      <div className="cosmic-bg"></div>

      {/* ✨ Floating Blur Orbs */}
      <div className="floating-orb orb-1"></div>
      <div className="floating-orb orb-2"></div>
      <div className="floating-orb orb-3"></div>

      <AnimatePresence mode="wait">
        {/* 🏠 HOME SCREEN */}
        {view === "home" && (
          <motion.div
            key="home"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit={{ opacity: 0, y: -20, transition: { duration: 0.3 } }}
            className="z-10 flex flex-col items-center text-center max-w-4xl w-full"
          >
            {/* Logo Area */}
            <motion.div
              className="mb-8 flex flex-col items-center"
              variants={itemVariants}
            >
              <motion.span
                className="text-7xl md:text-8xl mb-4 inline-block drop-shadow-[0_0_35px_rgba(139,92,246,0.6)]"
                animate={{
                  y: [0, -10, 0],
                  scale: [1, 1.03, 1]
                }}
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              >
                🧠
              </motion.span>
              <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight neon-text-gradient drop-shadow-[0_2px_15px_rgba(0,0,0,0.5)]">
                Memory Match
              </h1>
              <p className="text-base md:text-lg mt-4 text-white/70 max-w-md">
                An ultra-premium memory challenge. Play solo, local pass-and-play, or online multiplayer!
              </p>
            </motion.div>

            {/* Mode Selection Grid */}
            <motion.div
              className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl w-full px-4 mt-4"
              variants={itemVariants}
            >
              <button
                onClick={() => handleModeSelect("single")}
                className="glass-card p-6 text-left flex flex-col items-start hover:border-[rgba(6,182,212,0.4)] group transition-all duration-300"
              >
                <div className="text-3xl mb-4 p-3 bg-cyan-500/10 rounded-xl group-hover:scale-110 transition-transform duration-300">
                  🎮
                </div>
                <h3 className="text-xl font-bold text-white mb-1 group-hover:text-cyan-400 transition-colors">
                  Solo Campaign
                </h3>
                <p className="text-sm text-white/60">
                  Train your mind, track your moves, and beat your best records.
                </p>
              </button>

              <button
                onClick={() => handleModeSelect("two")}
                className="glass-card p-6 text-left flex flex-col items-start hover:border-[rgba(139,92,246,0.4)] group transition-all duration-300"
              >
                <div className="text-3xl mb-4 p-3 bg-violet-500/10 rounded-xl group-hover:scale-110 transition-transform duration-300">
                  🤝
                </div>
                <h3 className="text-xl font-bold text-white mb-1 group-hover:text-violet-400 transition-colors">
                  Versus Mode
                </h3>
                <p className="text-sm text-white/60">
                  Challenge a friend next to you in turn-based competitive action.
                </p>
              </button>

              <button
                onClick={() => router.push("/online")}
                className="glass-card p-6 text-left flex flex-col items-start hover:border-[rgba(16,185,129,0.4)] group transition-all duration-300"
              >
                <div className="text-3xl mb-4 p-3 bg-emerald-500/10 rounded-xl group-hover:scale-110 transition-transform duration-300">
                  🌐
                </div>
                <h3 className="text-xl font-bold text-white mb-1 group-hover:text-emerald-400 transition-colors">
                  Online Arena
                </h3>
                <p className="text-sm text-white/60">
                  Host or join private rooms to match against players worldwide.
                </p>
              </button>

              <button
                onClick={() => router.push("/leaderboard")}
                className="glass-card p-6 text-left flex flex-col items-start hover:border-[rgba(245,158,11,0.4)] group transition-all duration-300"
              >
                <div className="text-3xl mb-4 p-3 bg-amber-500/10 rounded-xl group-hover:scale-110 transition-transform duration-300">
                  🏆
                </div>
                <h3 className="text-xl font-bold text-white mb-1 group-hover:text-amber-400 transition-colors">
                  Leaderboard
                </h3>
                <p className="text-sm text-white/60">
                  Behold the top champions and check the ultimate high scores.
                </p>
              </button>
            </motion.div>
          </motion.div>
        )}

        {/* ⚙️ DIFFICULTY SELECTION */}
        {view === "difficulty" && (
          <motion.div
            key="difficulty"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit={{ opacity: 0, y: -20, transition: { duration: 0.3 } }}
            className="z-10 flex flex-col items-center text-center max-w-2xl w-full px-4"
          >
            <motion.h2
              className="text-4xl md:text-5xl font-extrabold tracking-wide text-white mb-2"
              variants={itemVariants}
            >
              Choose Difficulty
            </motion.h2>
            <motion.p
              className="text-white/60 mb-8 max-w-md"
              variants={itemVariants}
            >
              Select your grid configuration. Larger boards require deeper concentration.
            </motion.p>

            <motion.div
              className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full mb-8"
              variants={itemVariants}
            >
              {[
                {
                  level: "easy",
                  title: "Easy",
                  grid: "4 × 4",
                  desc: "16 Cards • Chill",
                  emoji: "🌱",
                  borderClass: "hover:border-[rgba(16,185,129,0.4)] group-hover:text-emerald-400"
                },
                {
                  level: "medium",
                  title: "Medium",
                  grid: "4 × 6",
                  desc: "24 Cards • Regular",
                  emoji: "⚡",
                  borderClass: "hover:border-[rgba(245,158,11,0.4)] group-hover:text-amber-400"
                },
                {
                  level: "hard",
                  title: "Hard",
                  grid: "6 × 8",
                  desc: "48 Cards • Extreme",
                  emoji: "🔥",
                  borderClass: "hover:border-[rgba(244,63,94,0.4)] group-hover:text-rose-400"
                },
              ].map(({ level, title, grid, desc, emoji, borderClass }) => (
                <button
                  key={level}
                  onClick={() => startGame(mode, level)}
                  className={`glass-card p-6 flex flex-col items-center justify-center text-center transition-all duration-300 group ${borderClass}`}
                >
                  <span className="text-3xl mb-3 transform group-hover:scale-125 transition-transform duration-300">
                    {emoji}
                  </span>
                  <span className="text-xl font-bold text-white">{title}</span>
                  <span className="text-2xl font-black text-cyan-400 mt-1">{grid}</span>
                  <span className="text-xs text-white/50 mt-2">{desc}</span>
                </button>
              ))}
            </motion.div>

            <motion.button
              variants={itemVariants}
              onClick={() => {
                setView("home");
                setMode(null);
              }}
              className="btn-secondary mt-4"
            >
              ← Back to Main Menu
            </motion.button>
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


import { useState } from "react";
import dynamic from "next/dynamic";

// Dynamically import MemoryMatch to avoid SSR issues
const MemoryMatch = dynamic(() => import("./memory"), { ssr: false });

export default function MemoryHome() {
  const [mode, setMode] = useState(null);
  const [difficulty, setDifficulty] = useState(null);

  const startGame = (selectedMode, selectedDifficulty) => {
    setMode(selectedMode);
    setDifficulty(selectedDifficulty);
  };

  // If no mode selected, show buttons
  if (!mode) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 text-white p-4">
        <h1 className="text-4xl font-bold mb-6">🧠 Memory Match</h1>
        <p className="mb-4 text-lg">Choose a game mode:</p>
        <div className="flex gap-4">
          <button
            onClick={() => setMode("single")}
            className="px-6 py-3 bg-white text-indigo-700 rounded font-semibold shadow hover:bg-indigo-100 transition"
          >
            1 Player
          </button>
          <button
            onClick={() => setMode("two")}
            className="px-6 py-3 bg-white text-indigo-700 rounded font-semibold shadow hover:bg-indigo-100 transition"
          >
            2 Players
          </button>
        </div>
      </div>
    );
  }

  // Difficulty selection screen
  if (mode && !difficulty) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-gradient-to-br from-purple-600 via-pink-600 to-red-500 text-white p-4">
        <h1 className="text-3xl font-bold mb-6">Select Difficulty</h1>
        <div className="flex gap-4">
          <button
            onClick={() => startGame(mode, "easy")}
            className="px-6 py-3 bg-white text-purple-700 rounded font-semibold shadow hover:bg-purple-100 transition"
          >
            Easy
          </button>
          <button
            onClick={() => startGame(mode, "medium")}
            className="px-6 py-3 bg-white text-purple-700 rounded font-semibold shadow hover:bg-purple-100 transition"
          >
            Medium
          </button>
          <button
            onClick={() => startGame(mode, "hard")}
            className="px-6 py-3 bg-white text-purple-700 rounded font-semibold shadow hover:bg-purple-100 transition"
          >
            Hard
          </button>
        </div>
      </div>
    );
  }

  // Render the game with selected mode + difficulty
  return (
    <MemoryMatch
      mode={mode}
      difficulty={difficulty}
      onBack={() => {
        setMode(null);
        setDifficulty(null);
      }}
    />
  );
}

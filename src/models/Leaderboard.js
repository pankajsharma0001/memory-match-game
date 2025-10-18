// models/Leaderboard.js
import mongoose from "mongoose";

const LeaderboardSchema = new mongoose.Schema({
  player: { type: String, required: true },
  difficulty: { type: String, enum: ["easy", "medium", "hard"], required: true },
  moves: { type: Number, required: true },
  time: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.models.Leaderboard ||
  mongoose.model("Leaderboard", LeaderboardSchema);

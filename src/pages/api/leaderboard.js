// pages/api/leaderboard.js
import { connectDB } from "../../lib/mongodb";
import Leaderboard from "../../models/Leaderboard";

export default async function handler(req, res) {
  await connectDB();

  if (req.method === "POST") {
    const { player, difficulty, moves, time } = req.body;

    if (!player || !difficulty) {
      return res.status(400).json({ error: "Missing data" });
    }

    await Leaderboard.create({ player, difficulty, moves, time });

    return res.status(201).json({ message: "Score saved" });
  }

  if (req.method === "GET") {
    const { difficulty } = req.query;

    const filter = difficulty ? { difficulty } : {};
    const scores = await Leaderboard.find(filter)
      .sort({ moves: 1, time: 1 })
      .limit(10)
      .lean();

    return res.status(200).json(scores);
  }

  res.status(405).end();
}

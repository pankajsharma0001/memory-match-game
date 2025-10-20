// pages/api/rooms.js
import { pusherServer } from '../../lib/pusher-server';

// In-memory store for rooms
const rooms = new Map();

// Shuffle function for creating decks
function shuffle(array) {
  const a = array.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Emoji list for deck creation
const EMOJIS = [
  "🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐨","🐯","🦁","🐮",
  "🐸","🐵","🐔","🦄","🐙","🐝","🐞","🪲","🦋","🐢","🐬","🐳"
];

export default async function handler(req, res) { // ADDED async here
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // Handle OPTIONS request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  console.log(`[API rooms] ${req.method} request for room:`, req.query?.room, 'body:', req.body);

  if (req.method === 'GET') {
    const { room } = req.query;
    
    if (!room) {
      return res.status(400).json({ success: false, error: 'Room code required' });
    }

    const roomData = rooms.get(room);
    
    if (!roomData) {
      return res.status(404).json({ success: false, error: 'Room not found' });
    }

    console.log(`[API rooms] Returning room data for ${room}:`, roomData);
    return res.json({
      success: true,
      room: roomData
    });
  }

  if (req.method === 'POST') {
    const { action, userId, roomCode, hostId } = req.body;

    console.log(`[API rooms] POST action: ${action}`, { userId, roomCode, hostId });

    if (action === 'create') {
      const code = Math.random().toString(36).slice(2, 6).toUpperCase();
      const room = {
        id: code,
        host: userId,
        players: [userId],
        started: false,
        createdAt: Date.now(),
        deck: null
      };
      
      rooms.set(code, room);
      console.log(`[API rooms] Created room ${code} for user ${userId}`);

      return res.json({ 
        success: true, 
        room: code,
        firstPlayer: userId 
      });
    }

    if (action === 'join') {
      const room = rooms.get(roomCode);
      
      if (!room) {
        return res.status(404).json({ success: false, error: 'Room not found' });
      }
      
      if (room.players.length >= 2) {
        return res.status(400).json({ success: false, error: 'Room full' });
      }
      
      room.players.push(userId);
      rooms.set(roomCode, room);

      console.log(`[API rooms] User ${userId} joined room ${roomCode}. Players:`, room.players);

      // Notify all clients in the room
      try {
        await pusherServer.trigger(`room-${roomCode}`, 'client-player-joined', {
          playerId: userId,
          room: roomCode
        });
      } catch (error) {
        console.error('Pusher trigger error:', error);
      }
      
      return res.json({ 
        success: true, 
        room: roomCode,
        firstPlayer: room.host 
      });
    }

    // Start game and create deck
    if (action === 'start-game') {
      const room = rooms.get(roomCode);
      
      if (!room) {
        return res.status(404).json({ success: false, error: 'Room not found' });
      }
      
      if (room.host !== hostId) {
        return res.status(403).json({ success: false, error: 'Only host can start game' });
      }

      if (room.players.length < 2) {
        return res.status(400).json({ success: false, error: 'Need 2 players to start game' });
      }
      
      console.log(`[API rooms] Starting game for room ${roomCode} with ${room.players.length} players`);
      
      // Create deck (8 pairs for easy mode)
      const pairsCount = 8; // Easy mode by default
      const chosen = EMOJIS.slice(0, pairsCount);
      const pairEmojis = shuffle([...chosen, ...chosen]);
      const deck = pairEmojis.map((emoji, idx) => ({
        id: idx,
        emoji,
        uuid: Math.random().toString(36).slice(2, 9) + Date.now().toString(36),
      }));
      
      // Store deck in room
      room.deck = deck;
      room.started = true;
      rooms.set(roomCode, room);
      
      console.log(`[API rooms] Created deck with ${deck.length} cards for room ${roomCode}`);
      
      // Notify all players via server event
      try {
        await pusherServer.trigger(`room-${roomCode}`, 'server-deck-ready', {
          deck,
          hostId,
          room: roomCode
        });
        console.log(`[API rooms] Successfully sent server-deck-ready event for room ${roomCode}`);
      } catch (error) {
        console.error(`[API rooms] Failed to send server-deck-ready event:`, error);
      }
      
      return res.json({ 
        success: true, 
        deck,
        message: 'Game started successfully'
      });
    }

    // Get deck for a room (for players who join late or miss the event)
    if (action === 'get-deck') {
      const room = rooms.get(roomCode);
      
      if (!room) {
        return res.status(404).json({ success: false, error: 'Room not found' });
      }
      
      if (!room.deck) {
        return res.status(404).json({ success: false, error: 'No deck available for this room' });
      }
      
      console.log(`[API rooms] Returning deck for room ${roomCode}`);
      
      return res.json({ 
        success: true, 
        deck: room.deck,
        hostId: room.host
      });
    }

    // Card flip action
    if (action === 'card-flip') {
      const room = rooms.get(roomCode);
      if (!room) return res.status(404).json({ success: false, error: 'Room not found' });
      
      console.log(`[API rooms] Card flipped by ${req.body.senderId} at index ${req.body.flippedIndex}`);
      
      try {
        await pusherServer.trigger(`room-${roomCode}`, 'server-card-flip', {
          flippedIndex: req.body.flippedIndex,
          cardId: req.body.cardId,
          senderId: req.body.senderId
        });
        console.log(`[API rooms] Successfully sent server-card-flip event`);
      } catch (error) {
        console.error(`[API rooms] Failed to send server-card-flip event:`, error);
      }
      
      return res.json({ success: true });
    }

    // Card match action
    if (action === 'card-match') {
      const room = rooms.get(roomCode);
      if (!room) return res.status(404).json({ success: false, error: 'Room not found' });
      
      console.log(`[API rooms] Card match by ${req.body.senderId}, matched: ${req.body.matchedIds?.length || 0} cards`);
      
      try {
        await pusherServer.trigger(`room-${roomCode}`, 'server-card-match', {
          matchedIds: req.body.matchedIds,
          moves: req.body.moves,
          isMatch: req.body.isMatch,
          senderId: req.body.senderId
        });
        console.log(`[API rooms] Successfully sent server-card-match event`);
      } catch (error) {
        console.error(`[API rooms] Failed to send server-card-match event:`, error);
      }
      
      return res.json({ success: true });
    }

    // Turn change action
    if (action === 'turn-change') {
      const room = rooms.get(roomCode);
      if (!room) return res.status(404).json({ success: false, error: 'Room not found' });
      
      console.log(`[API rooms] Turn change by ${req.body.senderId}`);
      
      try {
        await pusherServer.trigger(`room-${roomCode}`, 'server-turn-change', {
          senderId: req.body.senderId
        });
        console.log(`[API rooms] Successfully sent server-turn-change event`);
      } catch (error) {
        console.error(`[API rooms] Failed to send server-turn-change event:`, error);
      }
      
      return res.json({ success: true });
    }

    // Score update action
    if (action === 'score-update') {
      const room = rooms.get(roomCode);
      if (!room) return res.status(404).json({ success: false, error: 'Room not found' });
      
      console.log(`[API rooms] Score update by ${req.body.senderId}`, req.body.scores);
      
      try {
        await pusherServer.trigger(`room-${roomCode}`, 'server-score-update', {
          scores: req.body.scores,
          senderId: req.body.senderId
        });
        console.log(`[API rooms] Successfully sent server-score-update event`);
      } catch (error) {
        console.error(`[API rooms] Failed to send server-score-update event:`, error);
      }
      
      return res.json({ success: true });
    }

    // Game over action
    if (action === 'game-over') {
      const room = rooms.get(roomCode);
      if (!room) return res.status(404).json({ success: false, error: 'Room not found' });
      
      console.log(`[API rooms] Game over in room ${roomCode}, winner: ${req.body.winnerId}`);
      
      try {
        await pusherServer.trigger(`room-${roomCode}`, 'server-game-over', {
          winnerId: req.body.winnerId,
          scores: req.body.scores
        });
        console.log(`[API rooms] Successfully sent server-game-over event`);
      } catch (error) {
        console.error(`[API rooms] Failed to send server-game-over event:`, error);
      }
      
      return res.json({ success: true });
    }

    // Rematch request action
    if (action === 'rematch-request') {
      const room = rooms.get(roomCode);
      if (!room) return res.status(404).json({ success: false, error: 'Room not found' });
      
      console.log(`[API rooms] Rematch requested by ${req.body.senderId}`);
      
      try {
        await pusherServer.trigger(`room-${roomCode}`, 'server-rematch-request', {
          senderId: req.body.senderId
        });
        console.log(`[API rooms] Successfully sent server-rematch-request event`);
      } catch (error) {
        console.error(`[API rooms] Failed to send server-rematch-request event:`, error);
      }
      
      return res.json({ success: true });
    }

    if (action === 'start-rematch') {
        const room = rooms.get(roomCode);
        if (!room) return res.status(404).json({ success: false, error: 'Room not found' });
        
        console.log(`[API rooms] Starting rematch for room ${roomCode}, requested by ${req.body.senderId}`);
        // Create new deck for rematch
        const pairsCount = 8;
        const chosen = EMOJIS.slice(0, pairsCount);
        const pairEmojis = shuffle([...chosen, ...chosen]);
        const deck = pairEmojis.map((emoji, idx) => ({
            id: idx,
            emoji,
            uuid: Math.random().toString(36).slice(2, 9) + Date.now().toString(36),
        }));
        
        // Update room with new deck
        room.deck = deck;
        room.started = true;
        rooms.set(roomCode, room);
        
        console.log(`[API rooms] Created new deck with ${deck.length} cards for rematch`);
        
        // Send new deck to all players
        try {
            await pusherServer.trigger(`room-${roomCode}`, 'server-deck-ready', {
            deck,
            hostId: room.host, // Use the original host
            room: roomCode
            });
            console.log(`[API rooms] Successfully sent new deck for rematch`);
        } catch (error) {
            console.error(`[API rooms] Failed to send new deck for rematch:`, error);
        }
        
        return res.json({ 
            success: true, 
            deck,
            message: 'Rematch started successfully'
        });
    }
  }

  res.status(405).json({ success: false, error: 'Method not allowed' });
}
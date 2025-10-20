// pages/api/socket.js
import { Server } from "socket.io";

export default function handler(req, res) {
  try {
    if (!res.socket.server.io) {
      console.log("[socket] init start");

      const io = new Server(res.socket.server, {
        path: "/api/socket",
      });

      // In-memory rooms store
      const rooms = {};

      io.on("connection", (socket) => {
        console.log("[socket] client connected:", socket.id);

        socket.on("createRoom", () => {
          try {
            const code = Math.random().toString(36).slice(2, 6).toUpperCase();
            if (rooms[code]) {
              console.warn("[socket] collision, generating alt code");
            }
            rooms[code] = { host: socket.id, players: [socket.id], started: false };
            socket.join(code);
            console.log("[socket] roomCreated", code, "host:", socket.id);
            socket.emit("roomCreated", { room: code, firstPlayer: socket.id });
          } catch (err) {
            console.error("[socket] createRoom error:", err);
            socket.emit("roomError", "Server error creating room");
          }
        });

        socket.on("joinRoom", (codeRaw) => {
          try {
            const code = (codeRaw || "").toString().toUpperCase();
            const room = rooms[code];
            if (!room) {
              socket.emit("roomError", "Room not found");
              return;
            }
            if (room.players.length >= 2) {
              socket.emit("roomError", "Room full");
              return;
            }
            room.players.push(socket.id);
            socket.join(code);
            console.log("[socket] playerJoined", code, socket.id);

            io.to(code).emit("playerJoined", { room: code, playerId: socket.id });
            socket.emit("roomJoined", { room: code, firstPlayer: room.host });
            io.to(room.host).emit("roomJoined", { room: code, firstPlayer: room.host });

            if (room.players.length === 2) {
              console.log("[socket] starting game for room:", code);
              // mark started so clients that missed the event can catch up
              room.started = true;
              io.to(code).emit("startGame", { room: code, firstPlayer: room.host });
            }
          } catch (err) {
            console.error("[socket] joinRoom error:", err);
            socket.emit("roomError", "Server error joining room");
          }
        });

        // expose small roomStatus endpoint for clients that missed events
        socket.on("roomStatus", ({ room } = {}, cb) => {
          try {
            const r = rooms[String(room || "").toUpperCase()];
            const status = {
              exists: !!r,
              players: r ? r.players.length : 0,
              host: r ? r.host : null,
              started: r ? !!r.started : false,
            };
            if (typeof cb === "function") cb({ ok: true, status });
            else socket.emit("roomStatus", { status });
          } catch (err) {
            console.error("[socket] roomStatus error:", err);
            if (typeof cb === "function") cb({ ok: false, error: "server error" });
            else socket.emit("roomError", "Server error");
          }
        });

        // Relay events
        [
          "deckReady",
          "playerMove",
          "matchCheck",
          "turnChange",
          "timerUpdate",
          "cardFlip",        // ADD THIS
          "cardMatch",       // ADD THIS
          "resetFlipped",    // ADD THIS
          "scoreUpdate",      // ADD THIS
          "rematchRequest",   // ADD THIS
          "rematchAccepted",  // ADD THIS
          "requestDeck",
        ].forEach((evt) => {
            socket.on(evt, (payload = {}) => {
              try {
                if (!payload || !payload.roomId) return;
                // use socket.to so the sender does not get its own event echoed
                socket.to(payload.roomId).emit(evt, payload);
              } catch (err) {
                console.error(`[socket] relay ${evt} error:`, err);
              }
            });
          });
        
        socket.on("gameOver", (payload = {}) => {
          try {
            if (!payload || !payload.roomId) return;
            // use io.to to include the sender in the broadcast
            io.to(payload.roomId).emit("gameOver", payload);
          } catch (err) {
            console.error(`[socket] relay gameOver error:`, err);
          }
        });
        
        socket.on("disconnect", (reason) => {
          console.log("[socket] disconnected", socket.id, reason);
          for (const [code, room] of Object.entries(rooms)) {
            const i = room.players.indexOf(socket.id);
            if (i !== -1) {
              room.players.splice(i, 1);
              io.to(code).emit("opponentLeft", { room: code, playerId: socket.id });

              if (room.host === socket.id) {
                if (room.players.length > 0) {
                  room.host = room.players[0];
                  io.to(code).emit("hostChanged", { room: code, newHost: room.host });
                } else {
                  delete rooms[code];
                  console.log("[socket] cleaned empty room", code);
                }
              }

              if (room.players.length === 0 && rooms[code]) {
                delete rooms[code];
                console.log("[socket] cleaned empty room", code);
              }
            }
          }
        });
      }); // io.on

      res.socket.server.io = io;
      console.log("[socket] init done");
    }
  } catch (err) {
    console.error("[socket] handler error:", err);
  } finally {
    try {
      return res.status(200).end();
    } catch (endErr) {
      console.error("[socket] failed to end response:", endErr);
    }
  }
}

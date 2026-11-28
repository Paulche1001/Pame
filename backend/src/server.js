const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const { timingSafeEqual, randomBytes, randomInt } = require("node:crypto");
const { createGameRoom } = require("./gameRoom");

function matchesSecret(value, secret) {
  if (typeof value !== "string") return false;
  const supplied = Buffer.from(value);
  const expected = Buffer.from(secret);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
function normalizeCode(value) {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

function createGameServer({
  reconnectMs = 5000, adminToken = process.env.ADMIN_TOKEN || "",
  roomIdleMs = 30 * 60 * 1000, maxRooms = 100,
} = {}) {
  if (typeof adminToken !== "string" || (adminToken && adminToken.length < 16)) {
    throw new Error("ADMIN_TOKEN muss mindestens 16 Zeichen lang sein.");
  }
  const app = express();
  app.use(cors());
  app.get("/health", (_, res) => res.json({ ok: true }));
  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: "*" } });
  const rooms = new Map();
  let closing = false;
  const getRoom = code => rooms.get(normalizeCode(code));
  const replyTo = callback => typeof callback === "function" ? callback : () => {};
  function detach(socket, removePlayer = true) {
    const room = getRoom(socket.data.roomCode);
    if (room) {
      if (removePlayer && room.players.get(socket.data.playerId)?.socketId === socket.id) room.removePlayer(socket.data.playerId);
      socket.leave(room.channel);
      socket.leave(room.adminChannel);
      room.touch();
    }
    socket.data.role = null;
    socket.data.playerId = null;
    socket.data.roomCode = null;
  }
  function bind(socket, room, role, playerId = null) {
    if (socket.data.roomCode !== room.code || socket.data.role !== role || socket.data.playerId !== playerId) detach(socket);
    socket.data.roomCode = room.code;
    socket.data.role = role;
    socket.data.playerId = playerId;
    socket.join(room.channel);
    if (role === "admin") socket.join(room.adminChannel);
    else socket.leave(room.adminChannel);
    room.touch();
  }
  function adminHandler(socket, event, handler) {
    socket.on(event, (...args) => {
      const room = getRoom(socket.data.roomCode);
      if (!room || socket.data.role !== "admin") return;
      room.touch();
      try { handler(room, ...args); }
      catch (error) { socket.emit("action_error", error.message || "Aktion konnte nicht ausgeführt werden."); }
    });
  }
  function sweepRooms() {
    for (const [code, room] of rooms) {
      if (!io.sockets.adapter.rooms.get(room.channel)?.size && Date.now() - room.lastActiveAt >= roomIdleMs) {
        room.dispose();
        rooms.delete(code);
      }
    }
  }
  const cleanupInterval = setInterval(sweepRooms, Math.max(25, Math.min(60000, roomIdleMs)));
  cleanupInterval.unref();

  io.on("connection", socket => {
    socket.emit("admin_auth_required", Boolean(adminToken));
    socket.on("room_create", (payload, callback) => {
      const reply = replyTo(callback);
      if (adminToken && !matchesSecret(payload?.token, adminToken)) {
        reply({ success: false, message: "Server-Schlüssel fehlt oder ist falsch." }); return;
      }
      const hostName = typeof payload?.hostName === "string" ? payload.hostName.trim() : "";
      if (!hostName || hostName.length > 40) {
        reply({ success: false, message: "Bitte gib einen Namen für die Spielleitung mit höchstens 40 Zeichen ein." }); return;
      }
      if (rooms.size >= maxRooms) {
        reply({ success: false, message: "Zurzeit sind alle Räume belegt. Bitte später erneut versuchen." }); return;
      }
      const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      let code;
      do { code = Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join(""); } while (rooms.has(code));
      const room = createGameRoom({ code, hostKey: randomBytes(32).toString("hex"), hostName, io, reconnectMs });
      rooms.set(code, room);
      bind(socket, room, "admin");
      room.sync(socket, "admin");
      reply({ success: true, roomCode: code, hostKey: room.hostKey, hostName: room.hostName });
    });
    socket.on("admin_join", (payload, callback) => {
      const reply = replyTo(callback);
      const room = getRoom(payload?.roomCode);
      if (!room) { reply({ success: false, message: "Der Raum wurde nicht gefunden. Erstelle einen neuen Raum." }); return; }
      if (!matchesSecret(payload?.hostKey, room.hostKey)) {
        reply({ success: false, message: "Der Spielleiter-Schlüssel fehlt oder ist falsch." }); return;
      }
      bind(socket, room, "admin");
      room.sync(socket, "admin");
      reply({ success: true, roomCode: room.code, hostName: room.hostName });
    });
    socket.on("player_join", (payload, callback) => {
      const reply = replyTo(callback);
      const room = getRoom(payload?.roomCode);
      if (!room) { reply({ success: false, message: "Raum nicht gefunden. Prüfe den Raumcode." }); return; }
      const { playerId, playerToken } = payload;
      const name = typeof payload.name === "string" ? payload.name.trim().slice(0, 40) : "";
      if (typeof playerId !== "string" || !/^[a-zA-Z0-9-]{1,100}$/.test(playerId) ||
          typeof playerToken !== "string" || playerToken.length < 16 || playerToken.length > 200 || !name) {
        reply({ success: false, message: "Bitte gib einen Namen ein." }); return;
      }
      if (room.bannedPlayers.has(playerId)) {
        reply({ success: false, message: "Du wurdest aus diesem Raum entfernt." }); return;
      }
      const existing = room.players.get(playerId);
      if (existing && existing.playerToken !== playerToken) {
        reply({ success: false, message: "Diese Spieler-ID wird bereits verwendet." }); return;
      }
      if ([...room.players.values()].some(p => p.id !== playerId && p.name.toLocaleLowerCase() === name.toLocaleLowerCase()) ||
          room.hostName.toLocaleLowerCase() === name.toLocaleLowerCase() ||
          room.gameEngine.currentMode?.adminName?.toLocaleLowerCase() === name.toLocaleLowerCase()) {
        reply({ success: false, message: "Dieser Name ist in diesem Raum bereits vergeben." }); return;
      }
      if (existing && existing.socketId !== socket.id) {
        const oldSocket = io.sockets.sockets.get(existing.socketId);
        if (oldSocket) { detach(oldSocket, false); oldSocket.emit("session_replaced"); }
      }
      bind(socket, room, "player", playerId);
      clearTimeout(room.disconnectTimers.get(playerId));
      room.disconnectTimers.delete(playerId);
      const joinedName = existing && room.gameEngine.currentMode ? existing.name : name;
      room.players.set(playerId, { ...existing, id: playerId, name: joinedName, points: existing?.points || 0, playerToken, socketId: socket.id });
      room.updatePlayers();
      room.sync(socket, "player");
      reply({ success: true, roomCode: room.code, name: joinedName });
    });
    socket.on("player_leave", (payload, callback) => {
      const reply = replyTo(callback);
      const room = getRoom(socket.data.roomCode);
      const player = room?.players.get(socket.data.playerId);
      if (!player || player.socketId !== socket.id || payload?.playerId !== player.id) {
        reply({ success: false, message: "Spieler wurde nicht gefunden." }); return;
      }
      detach(socket);
      reply({ success: true });
    });
    socket.on("room_leave", (_, callback) => { detach(socket); replyTo(callback)({ success: true }); });
    socket.on("disconnect", () => {
      if (!closing) getRoom(socket.data.roomCode)?.disconnected(socket);
    });
    socket.on("player_action", payload => {
      const room = getRoom(socket.data.roomCode);
      if (!room || socket.data.role !== "player" || !room.players.has(socket.data.playerId)) return;
      room.touch();
      try { room.gameEngine.handlePlayerAction(socket, payload); }
      catch { socket.emit("action_error", "Ungültige Spielaktion."); return; }
      if (room.gameEngine.currentMode?.buzzedPlayer) room.clearTimer(true);
    });
    adminHandler(socket, "admin_delete_player", (room, playerId) => {
      const player = room.players.get(playerId);
      if (!player) return;
      room.bannedPlayers.add(playerId);
      const target = io.sockets.sockets.get(player.socketId);
      if (target) { detach(target, false); target.emit("kicked"); }
      room.removePlayer(playerId);
    });
    adminHandler(socket, "admin_select_mode", (room, payload) => {
      const modeName = typeof payload === "string" ? payload : payload?.modeName;
      const options = typeof payload?.options === "object" && payload.options && !Array.isArray(payload.options) ? payload.options : {};
      const modeOptions = ["imposter", "drinking"].includes(modeName) ? { ...options, adminName: room.hostName } : options;
      if (room.gameEngine.selectMode(modeName, room.transport, modeOptions)) {
        room.clearTimer(true);
        room.showLeaderboard = false;
        room.transport.emit("leaderboard_toggle", false);
      }
    });
    adminHandler(socket, "admin_change_points", (room, payload) => {
      const player = room.players.get(payload?.playerId);
      const amount = payload?.amount;
      if (!player || typeof amount !== "number" || !Number.isSafeInteger(amount)) return;
      player.points = Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, player.points + amount));
      room.updatePlayers();
    });
    adminHandler(socket, "admin_action", (room, payload) => {
      room.gameEngine.handleAdminAction(payload, room.transport);
      const action = typeof payload === "string" ? payload : payload?.action;
      if (action === "lobby") { room.showLeaderboard = false; room.transport.emit("leaderboard_toggle", false); }
      if (["lobby", "next", "next_question", "next_image", "next_hint", "next_round", "slf_next_round", "correct"].includes(action)) room.clearTimer(true);
    });
    adminHandler(socket, "admin_toggle_leaderboard", (room, state) => {
      room.showLeaderboard = Boolean(state);
      room.transport.emit("leaderboard_toggle", room.showLeaderboard);
    });
    adminHandler(socket, "admin_start_timer", (room, seconds) => room.startTimer(seconds));
    adminHandler(socket, "admin_pause_timer", room => room.pauseTimer());
    adminHandler(socket, "admin_resume_timer", room => room.resumeTimer());
    adminHandler(socket, "admin_stop_timer", room => room.clearTimer(true));
  });

  async function close() {
    closing = true;
    clearInterval(cleanupInterval);
    for (const room of rooms.values()) room.dispose();
    await new Promise(resolve => io.close(resolve));
    rooms.clear();
  }
  return { app, server, io, getRoom, close };
}

if (require.main === module) {
  if (process.env.NODE_ENV === "production" && !process.env.ADMIN_TOKEN) {
    throw new Error("Für öffentliches Hosting mit NODE_ENV=production muss ADMIN_TOKEN gesetzt sein.");
  }
  const { server } = createGameServer();
  const port = process.env.PORT || 3001;
  server.listen(port, "0.0.0.0", () => console.log(`Backend läuft auf http://0.0.0.0:${port}`));
}
module.exports = { createGameServer };

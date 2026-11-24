const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const { timingSafeEqual } = require("node:crypto");
const { createGameEngine } = require("./gameEngine");
const { publicPlayers, integer } = require("./utils");

function createGameServer({ reconnectMs = 5000, adminToken = process.env.ADMIN_TOKEN || "" } = {}) {
  if (typeof adminToken !== "string" || (adminToken && adminToken.length < 16)) {
    throw new Error("ADMIN_TOKEN muss mindestens 16 Zeichen lang sein.");
  }
  const app = express();
  app.use(cors());
  app.get("/health", (_, res) => res.json({ ok: true }));
  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: "*" } });
  const gameEngine = createGameEngine();
  const players = new Map();
  const bannedPlayers = new Set();
  const disconnectTimers = new Map();
  let timerInterval = null;
  let timerRemaining = null;
  let timerDeadline = null;
  let showLeaderboard = false;

  function clearGameTimer(reset = false) {
    clearInterval(timerInterval);
    timerInterval = null;
    if (reset) {
      timerRemaining = null;
      timerDeadline = null;
      io.emit("timer_done");
    }
  }
  function updatePlayersEverywhere() {
    gameEngine.setPlayers([...players.values()]);
    io.emit("players_update", publicPlayers([...players.values()]));
    gameEngine.broadcastState();
  }
  function syncControls(socket) {
    socket.emit("leaderboard_toggle", showLeaderboard);
    if (timerRemaining !== null) socket.emit("timer_update", timerRemaining);
    else socket.emit("timer_done");
  }
  function removePlayer(id) {
    clearTimeout(disconnectTimers.get(id));
    disconnectTimers.delete(id);
    players.delete(id);
    updatePlayersEverywhere();
  }
  function runTimer() {
    timerDeadline = Date.now() + timerRemaining * 1000;
    timerInterval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((timerDeadline - Date.now()) / 1000));
      if (remaining !== timerRemaining) {
        timerRemaining = remaining;
        io.emit("timer_update", timerRemaining);
      }
      if (timerRemaining === 0) {
        clearGameTimer(true);
        // Advance once on the server, even if the admin reconnects or has several tabs.
        if (gameEngine.getState().mode === "pixel") gameEngine.handleAdminAction("next_image");
      }
    }, 100);
  }
  function adminHandler(socket, event, handler) {
    socket.on(event, (...args) => {
      if (socket.data.role !== "admin") return;
      try { handler(...args); }
      catch (error) { socket.emit("action_error", error.message || "Aktion konnte nicht ausgeführt werden."); }
    });
  }

  io.on("connection", socket => {
    socket.emit("admin_auth_required", Boolean(adminToken));
    socket.on("player_join", (payload, callback) => {
      const reply = typeof callback === "function" ? callback : () => {};
      if (!payload || typeof payload !== "object") { reply({ success: false, message: "Ungültiger Beitritt." }); return; }
      const { playerId, playerToken } = payload;
      const name = typeof payload.name === "string" ? payload.name.trim().slice(0, 40) : "";
      if (typeof playerId !== "string" || !/^[a-zA-Z0-9-]{1,100}$/.test(playerId) || typeof playerToken !== "string" || playerToken.length < 16 || playerToken.length > 200 || !name) {
        reply({ success: false, message: "Bitte gib einen Namen ein." }); return;
      }
      if (bannedPlayers.has(playerId)) { reply({ success: false, message: "Du wurdest entfernt." }); socket.emit("kicked"); return; }
      const existing = players.get(playerId);
      if (existing && existing.playerToken !== playerToken) { reply({ success: false, message: "Diese Spieler-ID wird bereits verwendet." }); return; }
      if ([...players.values()].some(p => p.id !== playerId && p.name.toLocaleLowerCase() === name.toLocaleLowerCase()) ||
          gameEngine.currentMode?.adminName?.toLocaleLowerCase() === name.toLocaleLowerCase()) {
        reply({ success: false, message: "Dieser Name ist bereits vergeben." }); return;
      }
      if (socket.data.playerId && socket.data.playerId !== playerId) removePlayer(socket.data.playerId);
      if (existing && existing.socketId !== socket.id) {
        const oldSocket = io.sockets.sockets.get(existing.socketId);
        if (oldSocket) { oldSocket.data.playerId = null; oldSocket.emit("session_replaced"); }
      }
      clearTimeout(disconnectTimers.get(playerId));
      disconnectTimers.delete(playerId);
      // Keep names stable during a game because name-based voting uses them.
      const joinedName = existing && gameEngine.currentMode ? existing.name : name;
      players.set(playerId, { ...existing, id: playerId, name: joinedName, points: existing?.points || 0, playerToken, socketId: socket.id });
      socket.data.playerId = playerId;
      socket.data.role = "player";
      socket.leave("admins");
      updatePlayersEverywhere();
      socket.emit("game_state", gameEngine.getState({ role: "player", playerId }));
      syncControls(socket);
      reply({ success: true, name: joinedName });
    });

    // Private local rounds can stay open; public servers can require a secret host key.
    socket.on("admin_join", (payload, callback) => {
      const reply = typeof callback === "function" ? callback : () => {};
      const supplied = typeof payload?.token === "string" ? Buffer.from(payload.token) : Buffer.alloc(0);
      const expected = Buffer.from(adminToken);
      if (adminToken && (supplied.length !== expected.length || !timingSafeEqual(supplied, expected))) {
        socket.emit("admin_auth_required", true);
        reply({ success: false, message: "Admin-Schlüssel fehlt oder ist falsch." });
        return;
      }
      if (socket.data.playerId) { removePlayer(socket.data.playerId); socket.data.playerId = null; }
      socket.data.role = "admin";
      socket.join("admins");
      socket.emit("players_update", publicPlayers([...players.values()]));
      socket.emit("admin_state", gameEngine.getState({ role: "admin" }));
      syncControls(socket);
      reply({ success: true });
    });

    adminHandler(socket, "admin_delete_player", playerId => {
      const player = players.get(playerId);
      if (!player) return;
      bannedPlayers.add(playerId);
      const target = io.sockets.sockets.get(player.socketId);
      if (target) { target.data.playerId = null; target.data.role = null; target.emit("kicked"); }
      removePlayer(playerId);
    });
    socket.on("player_leave", (payload, callback) => {
      const reply = typeof callback === "function" ? callback : () => {};
      const player = players.get(socket.data.playerId);
      if (!player || player.socketId !== socket.id || payload?.playerId !== player.id) {
        reply({ success: false, message: "Spieler wurde nicht gefunden." }); return;
      }
      socket.data.playerId = null;
      socket.data.role = null;
      removePlayer(player.id);
      reply({ success: true });
    });
    socket.on("disconnect", () => {
      const player = players.get(socket.data.playerId);
      if (!player || player.socketId !== socket.id) return;
      clearTimeout(disconnectTimers.get(player.id));
      disconnectTimers.set(player.id, setTimeout(() => {
        const current = players.get(player.id);
        if (current?.socketId === socket.id) removePlayer(player.id);
      }, reconnectMs));
    });

    adminHandler(socket, "admin_select_mode", payload => {
      const modeName = typeof payload === "string" ? payload : payload?.modeName;
      const options = typeof payload?.options === "object" && payload.options && !Array.isArray(payload.options) ? payload.options : {};
      if (gameEngine.selectMode(modeName, io, options)) {
        clearGameTimer(true);
        showLeaderboard = false;
        io.emit("leaderboard_toggle", false);
      }
    });
    socket.on("player_action", payload => {
      if (socket.data.role !== "player" || !players.has(socket.data.playerId)) return;
      try { gameEngine.handlePlayerAction(socket, payload); }
      catch { socket.emit("action_error", "Ungültige Spielaktion."); return; }
      if (gameEngine.currentMode?.buzzedPlayer) clearGameTimer(true);
    });
    adminHandler(socket, "admin_change_points", payload => {
      const player = players.get(payload?.playerId);
      const amount = payload?.amount;
      if (!player || typeof amount !== "number" || !Number.isFinite(amount) || !Number.isSafeInteger(amount)) return;
      player.points = Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, player.points + amount));
      updatePlayersEverywhere();
    });
    adminHandler(socket, "admin_action", payload => {
      gameEngine.handleAdminAction(payload, io);
      const action = typeof payload === "string" ? payload : payload?.action;
      if (action === "lobby") {
        showLeaderboard = false;
        io.emit("leaderboard_toggle", false);
      }
      if (["lobby", "next", "next_question", "next_image", "next_hint", "next_round", "slf_next_round", "correct"].includes(action)) clearGameTimer(true);
    });
    adminHandler(socket, "admin_toggle_leaderboard", state => {
      showLeaderboard = Boolean(state);
      io.emit("leaderboard_toggle", showLeaderboard);
    });
    adminHandler(socket, "admin_start_timer", seconds => {
      if (!Number.isFinite(Number(seconds)) || Number(seconds) < 1) return;
      clearGameTimer();
      timerRemaining = integer(seconds, 5, 1, 3600);
      io.emit("timer_update", timerRemaining);
      runTimer();
    });
    adminHandler(socket, "admin_pause_timer", () => {
      if (!timerInterval) return;
      timerRemaining = Math.max(0, Math.ceil((timerDeadline - Date.now()) / 1000));
      clearGameTimer();
      io.emit("timer_update", timerRemaining);
    });
    adminHandler(socket, "admin_resume_timer", () => {
      if (timerInterval || timerRemaining === null || timerRemaining <= 0) return;
      runTimer();
    });
    adminHandler(socket, "admin_stop_timer", () => clearGameTimer(true));
  });

  async function close() {
    clearGameTimer();
    gameEngine.disposeMode();
    for (const timer of disconnectTimers.values()) clearTimeout(timer);
    await new Promise(resolve => io.close(resolve));
    // Socket.IO disconnect callbacks may have scheduled new reconnect timers.
    for (const timer of disconnectTimers.values()) clearTimeout(timer);
    disconnectTimers.clear();
  }
  return { app, server, io, gameEngine, close };
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

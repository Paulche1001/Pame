const { createGameEngine } = require("./gameEngine");
const { publicPlayers, integer } = require("./utils");

function createGameRoom({ code, hostKey, hostName, io, reconnectMs }) {
  const channel = "game:" + code;
  const adminChannel = channel + ":admins";
  const transport = {
    emit: (event, value) => io.to(channel).emit(event, value),
    to: target => io.to(target === "admins" ? adminChannel : target),
  };
  const room = {
    code, hostKey, hostName, channel, adminChannel, transport,
    gameEngine: createGameEngine({ roomCode: code }),
    players: new Map(), bannedPlayers: new Set(), disconnectTimers: new Map(),
    timerInterval: null, timerRemaining: null, timerDeadline: null,
    showLeaderboard: false, lastActiveAt: Date.now(),
    touch() { this.lastActiveAt = Date.now(); },
    clearTimer(reset = false) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
      if (reset) {
        this.timerRemaining = null;
        this.timerDeadline = null;
        transport.emit("timer_done");
      }
    },
    updatePlayers() {
      this.gameEngine.setPlayers([...this.players.values()]);
      transport.emit("players_update", publicPlayers([...this.players.values()]));
      this.gameEngine.broadcastState();
    },
    sync(socket, role) {
      socket.emit("players_update", publicPlayers([...this.players.values()]));
      socket.emit(role === "admin" ? "admin_state" : "game_state",
        this.gameEngine.getState({ role, playerId: socket.data.playerId }));
      socket.emit("leaderboard_toggle", this.showLeaderboard);
      if (this.timerRemaining !== null) socket.emit("timer_update", this.timerRemaining);
      else socket.emit("timer_done");
    },
    removePlayer(id) {
      clearTimeout(this.disconnectTimers.get(id));
      this.disconnectTimers.delete(id);
      this.players.delete(id);
      this.updatePlayers();
    },
    disconnected(socket) {
      this.touch();
      const player = this.players.get(socket.data.playerId);
      if (!player || player.socketId !== socket.id) return;
      clearTimeout(this.disconnectTimers.get(player.id));
      this.disconnectTimers.set(player.id, setTimeout(() => {
        if (this.players.get(player.id)?.socketId === socket.id) this.removePlayer(player.id);
      }, reconnectMs));
    },
    runTimer() {
      this.timerDeadline = Date.now() + this.timerRemaining * 1000;
      this.timerInterval = setInterval(() => {
        const remaining = Math.max(0, Math.ceil((this.timerDeadline - Date.now()) / 1000));
        if (remaining !== this.timerRemaining) {
          this.timerRemaining = remaining;
          transport.emit("timer_update", remaining);
        }
        if (remaining === 0) {
          this.clearTimer(true);
          if (this.gameEngine.getState().mode === "pixel") this.gameEngine.handleAdminAction("next_image");
        }
      }, 100);
    },
    startTimer(seconds) {
      if (!Number.isFinite(Number(seconds)) || Number(seconds) < 1) return;
      this.clearTimer();
      this.timerRemaining = integer(seconds, 5, 1, 3600);
      transport.emit("timer_update", this.timerRemaining);
      this.runTimer();
    },
    pauseTimer() {
      if (!this.timerInterval) return;
      this.timerRemaining = Math.max(0, Math.ceil((this.timerDeadline - Date.now()) / 1000));
      this.clearTimer();
      transport.emit("timer_update", this.timerRemaining);
    },
    resumeTimer() {
      if (this.timerInterval || this.timerRemaining === null || this.timerRemaining <= 0) return;
      this.runTimer();
    },
    dispose() {
      this.clearTimer();
      this.gameEngine.disposeMode();
      for (const timer of this.disconnectTimers.values()) clearTimeout(timer);
      this.disconnectTimers.clear();
    },
  };
  return room;
}
module.exports = { createGameRoom };

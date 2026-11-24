module.exports = class TestMode {
  constructor(io, players) {
    this.io = io;
    this.players = players;
    this.messages = [];
    this.commandTimers = new Set();
    this.disposed = false;
  }
  start() { this.sendState(); }
  getState() { return { mode: "test", screen: "game", messages: this.messages, players: this.players }; }
  sendState() { this.io.emit("game_state"); }
  addMessage(value, author, name) {
    if (typeof value !== "string" || !value.trim() || this.disposed) return;
    this.messages.push({ message: value.slice(0, 2000), author, name, ts: Date.now() });
    if (this.messages.length > 1000) this.messages.shift();
    this.sendState();
  }
  onPlayerAction(_, { action, playerId, value }) {
    const player = this.players.find(p => p.id === playerId);
    if (action === "send_message" && player) this.addMessage(value, playerId, player.name);
  }
  onAdminAction({ action, value }) {
    if (action !== "send_message" || typeof value !== "string") return;
    const match = value.trim().match(/^\/x(\d+)\s*=\s*(.+)$/i);
    if (!match) { this.addMessage(value, "admin", "Admin"); return; }
    const count = Math.min(Number(match[1]), 500);
    for (let i = 0; i < count; i++) {
      const timer = setTimeout(() => {
        this.commandTimers.delete(timer);
        this.addMessage(match[2], "pc", "Konsole");
      }, i * 50);
      this.commandTimers.add(timer);
    }
  }
  dispose() {
    this.disposed = true;
    for (const timer of this.commandTimers) clearTimeout(timer);
    this.commandTimers.clear();
  }
};

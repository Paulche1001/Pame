const { shuffle, integer } = require("../utils");

module.exports = class BuzzerMode {
  constructor(io, players, questions, name, options = {}) {
    this.io = io;
    this.players = players;
    this.name = name;
    this.questions = shuffle(questions).slice(0, integer(options.questionCount ?? 5, 5, 1, questions.length));
    this.currentIndex = 0;
    this.step = 0;
    this.buzzedPlayer = null;
    this.blockedPlayers = new Set();
  }
  get currentImageStep() { return this.step; }
  get currentHintStep() { return this.step; }
  get finalStep() {
    const q = this.questions[this.currentIndex];
    return this.name === "pixel" ? (q?.images.length ?? 1) - 1 : (q?.hints.length ?? 0);
  }
  start() { this.sendState(); }
  sendState() { this.io.emit("game_state"); }
  updatePlayers(list) {
    this.players = list;
    this.buzzedPlayer = list.find(p => p.id === this.buzzedPlayer?.id) || null;
    this.blockedPlayers = new Set([...this.blockedPlayers].filter(id => list.some(p => p.id === id)));
  }
  getState({ role } = {}) {
    const q = this.questions[this.currentIndex];
    const resolved = this.step >= this.finalStep;
    const state = {
      mode: q ? this.name : null,
      screen: !q ? "end" : this.buzzedPlayer ? "buzz" : "question",
      players: this.players,
      buzzedPlayer: this.buzzedPlayer,
      blockedPlayers: [...this.blockedPlayers],
      title: role === "admin" || resolved ? q?.title ?? null : null,
    };
    if (this.name === "pixel") return { ...state, imageStep: this.step, image: q?.images[this.step] ?? null };
    return { ...state, variant: this.variant, hintStep: this.step, hint: q?.hints[this.step] ?? null,
      hints: role === "admin" ? q?.hints ?? [] : q?.hints.slice(0, this.step + 1) ?? [] };
  }
  onPlayerAction(_, { action, playerId }) {
    if (action !== "buzz" || !this.questions[this.currentIndex] || this.step >= this.finalStep || this.buzzedPlayer || this.blockedPlayers.has(playerId)) return;
    const player = this.players.find(p => p.id === playerId);
    if (!player) return;
    this.buzzedPlayer = player;
    this.sendState();
  }
  onAdminAction({ action }) {
    if (!this.questions[this.currentIndex]) return;
    const nextAction = this.name === "pixel" ? "next_image" : "next_hint";
    if (action === nextAction) {
      this.buzzedPlayer = null;
      if (this.step < this.finalStep) this.step++;
      else {
        this.currentIndex++;
        this.step = 0;
        this.blockedPlayers.clear();
      }
      this.sendState();
    }
    if (action === "correct" && this.buzzedPlayer) {
      this.buzzedPlayer.points = (this.buzzedPlayer.points || 0) + 3;
      this.buzzedPlayer = null;
      this.step = this.finalStep;
      this.io.emit("players_update");
      this.sendState();
    }
    if (action === "wrong" && this.buzzedPlayer) {
      this.blockedPlayers.add(this.buzzedPlayer.id);
      this.buzzedPlayer = null;
      this.sendState();
    }
  }
};

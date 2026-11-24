const { shuffle, integer, finiteAnswer } = require("../utils");
const questions = require("../questions/estimateQuestions.json");

module.exports = class EstimateMode {
  constructor(io, players, options = {}) {
    this.io = io;
    this.players = players;
    const sets = options.sets || { classic: questions };
    const selected = Object.hasOwn(sets, options.setKey) ? sets[options.setKey] : Object.values(sets)[0];
    this.questions = shuffle(selected || questions).slice(0, integer(options.questionCount ?? 10, 10, 1, (selected || questions).length));
    this.currentIndex = 0;
    this.answers = {};
    this.revealed = false;
  }
  start() { this.sendState(); }
  updatePlayers(list) {
    this.players = list;
    const ids = new Set(list.map(p => p.id));
    this.answers = Object.fromEntries(Object.entries(this.answers).filter(([id]) => ids.has(id)));
  }
  getState({ role, playerId } = {}) {
    const q = this.questions[this.currentIndex];
    return {
      screen: !q ? "end" : this.revealed ? "results" : "question",
      mode: q ? "estimate" : null,
      question: q?.question ?? null,
      correctAnswer: role === "admin" || this.revealed ? q?.answer ?? null : null,
      answers: role === "admin" || this.revealed ? this.answers :
        Object.fromEntries(Object.entries(this.answers).filter(([id]) => id === playerId)),
      revealed: this.revealed,
      players: this.players,
    };
  }
  sendState() { this.io.emit("game_state"); }
  onPlayerAction(_, { action, playerId, value }) {
    if (action !== "answer" || this.revealed || !this.questions[this.currentIndex] || !finiteAnswer(value)) return;
    const player = this.players.find(p => p.id === playerId);
    if (!player) return;
    this.answers[playerId] = { name: player.name, answer: Number(value) };
    this.sendState();
  }
  onAdminAction({ action }) {
    const q = this.questions[this.currentIndex];
    if (!q) return;
    if (action === "reveal" && !this.revealed) {
      this.revealed = true;
      const sorted = Object.entries(this.answers).map(([id, obj]) => ({ id, dist: Math.abs(obj.answer - q.answer) })).sort((a, b) => a.dist - b.dist);
      let lastDist;
      let rank = 1;
      sorted.forEach(({ id, dist }, index) => {
        if (dist !== lastDist) rank = index + 1;
        const player = this.players.find(p => p.id === id);
        if (player) player.points = (player.points || 0) + ({ 1: 3, 2: 2, 3: 1 }[rank] || 0);
        lastDist = dist;
      });
      this.io.emit("players_update");
      this.sendState();
    }
    if (action === "next") {
      this.currentIndex++;
      this.answers = {};
      this.revealed = false;
      this.sendState();
    }
  }
};

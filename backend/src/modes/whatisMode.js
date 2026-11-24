const { randomUUID } = require("node:crypto");
const { shuffle } = require("../utils");
const questions = require("../questions/whatIsQuestions.json");

module.exports = class WhatIsMode {
  constructor(io, players) {
    this.io = io;
    this.players = players;
    this.questions = shuffle(questions).slice(0, 5);
    this.currentIndex = 0;
    this.name = "whatis";
    this.loadQuestion(false);
  }
  start() { this.sendState(); }
  loadQuestion(send = true) {
    this.answers = {};
    this.votes = {};
    this.revealedAnswers = {};
    this.revealed = false;
    this.scored = false;
    this.correctId = null;
    if (send) this.sendState();
  }
  getState({ role, playerId } = {}) {
    const q = this.questions[this.currentIndex];
    const admin = role === "admin";
    const answers = Object.fromEntries(Object.entries(this.answers)
      .filter(([, a]) => admin || this.revealed || a.author === playerId)
      .map(([id, a]) => [id, admin || this.revealedAnswers[id] || !this.revealed ? a : { answer: a.answer }]));
    return {
      mode: q ? "whatis" : null, screen: !q ? "end" : this.revealed ? "select" : "fake",
      question: q?.quest ?? null,
      answers,
      votes: this.votes,
      revealedAnswers: this.revealedAnswers,
      correctAnswerId: admin || this.revealedAnswers[this.correctId] ? this.correctId : null,
      players: this.players,
    };
  }
  sendState() { this.io.emit("game_state"); }
  onPlayerAction(_, { action, playerId, value }) {
    if (!this.questions[this.currentIndex]) return;
    const player = this.players.find(p => p.id === playerId);
    if (!player) return;
    if (action === "submit_fake" && !this.revealed && typeof value === "string" && value.trim()) {
      this.answers[playerId] = { answer: value.trim().slice(0, 1000), author: playerId, name: player.name };
      this.sendState();
    }
    if (action === "select_answer" && this.revealed && Object.keys(this.revealedAnswers).length === 0 && Object.hasOwn(this.answers, value)) {
      this.votes[playerId] = value;
      this.sendState();
    }
  }
  onAdminAction({ action, answerId }) {
    const q = this.questions[this.currentIndex];
    if (!q) return;
    if (action === "reveal" && !this.revealed) {
      this.revealed = true;
      // Opaque option IDs keep the correct answer and authors hidden during voting.
      const entries = Object.values(this.answers);
      const correct = { answer: q.answer, author: null, name: "Richtige Antwort" };
      entries.push(correct);
      this.answers = Object.fromEntries(shuffle(entries).map(answer => {
        const id = randomUUID();
        if (answer === correct) this.correctId = id;
        return [id, answer];
      }));
      this.sendState();
    }
    if (action === "reveal_answer" && this.revealed && Object.hasOwn(this.answers, answerId)) {
      this.revealedAnswers[answerId] = true;
      this.sendState();
    }
    if (action === "next") {
      this.calculatePoints();
      this.currentIndex++;
      this.loadQuestion();
    }
  }
  calculatePoints() {
    if (this.scored) return;
    this.scored = true;
    for (const p of this.players) {
      const vote = this.votes[p.id];
      if (vote === this.correctId && vote) p.points = (p.points || 0) + 2;
      else {
        const authorId = this.answers[vote]?.author;
        const author = this.players.find(p => p.id === authorId);
        if (author && authorId !== p.id) author.points = (author.points || 0) + 1;
      }
    }
    this.io.emit("players_update");
  }
  updatePlayers(list) {
    this.players = list;
    const ids = new Set(list.map(p => p.id));
    this.votes = Object.fromEntries(Object.entries(this.votes).filter(([id]) => ids.has(id)));
    if (!this.revealed) this.answers = Object.fromEntries(Object.entries(this.answers).filter(([id]) => ids.has(id)));
  }
};

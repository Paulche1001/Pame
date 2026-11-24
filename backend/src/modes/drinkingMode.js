const { shuffle, integer, finiteAnswer } = require("../utils");
const questionsNames = require("../questions/drinkingNames.json");
const questionsWerWuerde = require("../questions/drinkingWerWuerde.json");
const questionsSchaetzen = require("../questions/estimateQuestionsSelbst.json");

module.exports = class DrinkingMode {
  constructor(io, players, options = {}) {
    this.io = io;
    this.players = players;
    this.questions = shuffle([...questionsNames, ...questionsWerWuerde, ...questionsSchaetzen]).slice(0, 100).map(q => ({ ...q }));
    this.currentIndex = 0;
    this.sips = integer(options.schlueckeCount ?? 2, 2, 1, 5);
    this.adminName = String(options.adminName || "").trim().slice(0, 40);
    if (!this.adminName || players.some(p => p.name.toLocaleLowerCase() === this.adminName.toLocaleLowerCase())) throw new Error("Wähle für die Spielleitung einen eigenen Namen.");
    this.allPlayer = new Set();
    this.selectedPlayers = new Map();
    this.playerEstimates = new Map();
    this.reveal = false;
    this.renderedTask = null;
  }
  start() { this.prepareQuestion(); this.sendState(); }
  createAllPlayerList() {
    this.allPlayer = new Set(this.players.map(p => p.name));
    if (this.adminName) this.allPlayer.add(this.adminName);
  }
  prepareQuestion() {
    this.createAllPlayerList();
    const q = this.questions[this.currentIndex];
    if (!q) return;
    const names = shuffle([...this.allPlayer]);
    const sips = this.sips + (this.sips === 1 ? " Schluck" : " Schlücke");
    this.renderedTask = String(q.task ?? q.question ?? "").replace(/\[name(\d+)\]/g, (_, number) => names[Number(number) - 1] ?? names[0] ?? "Unbekannt").replace(/\[sips\]/g, sips);
  }
  getRanking() {
    const q = this.questions[this.currentIndex];
    return [...this.playerEstimates].map(([name, estimate]) => ({ name, estimate, diff: Math.abs(estimate - Number(q?.answer)) })).sort((a, b) => a.diff - b.diff);
  }
  getState({ role, playerId } = {}) {
    const q = this.questions[this.currentIndex];
    const allEstimated = this.allPlayer.size > 0 && [...this.allPlayer].every(name => this.playerEstimates.has(name));
    const allVoted = this.allPlayer.size > 0 && [...this.allPlayer].every(name => this.selectedPlayers.has(name));
    const voted = !q || (q.id === "werwuerde" ? allVoted || this.reveal : q.id === "schaetz" ? allEstimated || this.reveal : true);
    const name = this.players.find(p => p.id === playerId)?.name;
    const estimates = voted || role === "admin" ? this.playerEstimates : new Map([...this.playerEstimates].map(([n, v]) => [n, n === name ? v : null]));
    return {
      mode: q ? "drinking" : null, screen: q ? "game" : "end", players: this.players, adminName: this.adminName,
      sips: this.sips, taskName: this.renderedTask, questKind: q?.id,
      allPlayer: [...this.allPlayer], selectedPlayers: Object.fromEntries(this.selectedPlayers),
      voted, topPlayers: voted ? this.getTopVotedPlayers() : [],
      playerEstimates: Object.fromEntries(estimates), allEstimated,
      estimateRanking: voted ? this.getRanking() : [],
      correctAnswer: voted ? q?.answer ?? null : null,
    };
  }
  sendState() { this.io.emit("game_state"); }
  updatePlayers(list) {
    this.players = list;
    this.createAllPlayerList();
    for (const [name, target] of this.selectedPlayers) {
      if (!this.allPlayer.has(name) || !this.allPlayer.has(target)) this.selectedPlayers.delete(name);
    }
    for (const name of this.playerEstimates.keys()) if (!this.allPlayer.has(name)) this.playerEstimates.delete(name);
  }
  getTopVotedPlayers() {
    const counts = new Map();
    for (const name of this.selectedPlayers.values()) counts.set(name, (counts.get(name) || 0) + 1);
    const max = Math.max(0, ...counts.values());
    return [...counts].filter(([, count]) => count === max).map(([name]) => name);
  }
  handlePlayerSelection(name, target) {
    if (this.questions[this.currentIndex]?.id !== "werwuerde" || this.getState().voted || !this.allPlayer.has(name) || !this.allPlayer.has(target)) return;
    this.selectedPlayers.set(name, target);
    this.sendState();
  }
  handlePlayerSchaetzung(name, value) {
    if (this.questions[this.currentIndex]?.id !== "schaetz" || this.getState().voted || !this.allPlayer.has(name) || !finiteAnswer(value)) return;
    this.playerEstimates.set(name, Number(value));
    this.sendState();
  }
  onAdminAction({ action, value }) {
    if (!this.questions[this.currentIndex]) return;
    if (action === "next_question") {
      this.currentIndex++;
      this.selectedPlayers.clear();
      this.playerEstimates.clear();
      this.reveal = false;
      this.prepareQuestion();
      this.sendState();
    }
    if (action === "select_player") this.handlePlayerSelection(this.adminName, value);
    if (action === "schaetz_wert") this.handlePlayerSchaetzung(this.adminName, value);
    if (action === "reveal_question") { this.reveal = true; this.sendState(); }
  }
  onPlayerAction(_, { action, voterName, schaetzerName, value }) {
    if (action === "select_player") this.handlePlayerSelection(voterName, value);
    if (action === "schaetz_wert") this.handlePlayerSchaetzung(schaetzerName, value);
  }
};

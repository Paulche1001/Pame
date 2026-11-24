const { shuffle, integer } = require("../utils");

module.exports = class ImposterMode {
  constructor(io, players, questions, options = {}) {
    this.io = io;
    this.players = players;
    this.adminName = String(options.adminName || "").trim().slice(0, 40);
    if (!this.adminName || players.some(p => p.name.toLocaleLowerCase() === this.adminName.toLocaleLowerCase())) throw new Error("Wähle für die Spielleitung einen eigenen Namen.");
    if (players.length < 2) throw new Error("Imposter benötigt mindestens zwei Spieler und die Spielleitung.");
    this.questions = shuffle(questions).slice(0, 100);
    this.currentIndex = 0;
    this.requestedImposters = integer(options.imposterCount ?? 1, 1, 1, 100);
    this.allPlayer = new Set();
    this.imposters = new Set();
    this.kicked = new Set();
    this.selectedPlayers = new Map();
    this.isSelection = false;
    this.result = null;
    this.problemMessage = "";
    this.imposterWin = false;
    this.crewmatesWin = false;
  }
  start() { this.prepareRound(); this.sendState(); }
  createAllPlayerList() {
    this.allPlayer = new Set([...this.players.map(p => p.name), this.adminName]);
  }
  prepareRound() {
    this.createAllPlayerList();
    const pool = shuffle([...this.allPlayer]);
    this.imposterCount = Math.min(this.requestedImposters, Math.max(1, Math.floor((pool.length - 1) / 2)));
    this.imposters = new Set(pool.slice(0, this.imposterCount));
    this.firstPlayer = pool[Math.floor(Math.random() * pool.length)] || "";
    this.kicked.clear();
    this.selectedPlayers.clear();
    this.isSelection = false;
    this.imposterWin = false;
    this.crewmatesWin = false;
    this.result = null;
    this.problemMessage = "";
  }
  getState({ role, playerId } = {}) {
    const q = this.questions[this.currentIndex];
    const name = role === "admin" ? this.adminName : this.players.find(p => p.id === playerId)?.name;
    const isImposter = this.imposters.has(name);
    return {
      mode: q ? "imposter" : null, screen: !q ? "end" : this.isSelection ? "selection_screen" : "imposter_screen",
      players: this.players, adminName: this.adminName, imposterCount: this.imposterCount,
      allPlayer: [...this.allPlayer], kicked: [...this.kicked], firstPlayer: this.firstPlayer,
      isImposter,
      word: !isImposter && name ? q?.word ?? null : null,
      helpWord: isImposter ? q?.help ?? null : null,
      selectedPlayers: Object.fromEntries(this.selectedPlayers), result: this.result,
      problemMessage: this.problemMessage, imposterWin: this.imposterWin, crewmatesWin: this.crewmatesWin,
    };
  }
  sendState() { this.io.emit("game_state"); }
  updatePlayers(list) {
    this.players = list;
    this.createAllPlayerList();
    for (const [name, target] of this.selectedPlayers) {
      if (!this.allPlayer.has(name) || !this.allPlayer.has(target)) this.selectedPlayers.delete(name);
    }
    for (const name of this.imposters) if (!this.allPlayer.has(name)) this.imposters.delete(name);
    if (!this.allPlayer.has(this.firstPlayer)) this.firstPlayer = [...this.allPlayer].find(name => !this.kicked.has(name)) || "";
  }
  handlePlayerSelection(name, target) {
    if (!this.isSelection || this.imposterWin || this.crewmatesWin || !this.allPlayer.has(name) || !this.allPlayer.has(target) || this.kicked.has(name) || this.kicked.has(target)) return;
    this.selectedPlayers.set(name, target);
    this.problemMessage = "";
    this.sendState();
  }
  handleVoting() {
    if (!this.isSelection || this.imposterWin || this.crewmatesWin) return;
    const counts = new Map();
    for (const target of this.selectedPlayers.values()) counts.set(target, (counts.get(target) || 0) + 1);
    const maxVotes = Math.max(0, ...counts.values());
    const winners = [...counts].filter(([, count]) => count === maxVotes).map(([name]) => name);
    this.result = { counts: Object.fromEntries(counts), maxVotes, winners };
    if (winners.length !== 1) {
      this.problemMessage = winners.length ? "Einigt euch auf eine Person" : "Wählt eine Person";
      this.sendState();
      return;
    }
    this.kicked.add(winners[0]);
    this.selectedPlayers.clear();
    this.problemMessage = "";
    const alive = [...this.allPlayer].filter(name => !this.kicked.has(name));
    const aliveImposters = alive.filter(name => this.imposters.has(name)).length;
    this.crewmatesWin = aliveImposters === 0;
    this.imposterWin = !this.crewmatesWin && alive.length - aliveImposters <= aliveImposters;
    this.sendState();
  }
  onAdminAction({ action, value }) {
    if (!this.questions[this.currentIndex]) return;
    if (action === "select_player") { this.handlePlayerSelection(this.adminName, value); return; }
    if (action === "vote_imposter") { this.handleVoting(); return; }
    if (action === "next_round") {
      this.currentIndex++;
      this.prepareRound();
    } else if (action === "start_selection" || action === "keep_playing") {
      if (this.imposterWin || this.crewmatesWin) return;
      this.isSelection = action === "start_selection";
      this.selectedPlayers.clear();
      this.result = null;
      this.problemMessage = "";
    } else return;
    this.sendState();
  }
  onPlayerAction(_, { action, voterName, value }) {
    if (action === "select_player") this.handlePlayerSelection(voterName, value);
  }
};

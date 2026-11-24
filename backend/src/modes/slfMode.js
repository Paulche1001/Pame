const { integer } = require("../utils");

module.exports = class SLFMode {
  constructor(io, players, options = {}) {
    this.io = io;
    this.players = players;

    this.categories = Array.isArray(options.categories)
      ? [...new Set(options.categories.filter(c => typeof c === "string").map(c => c.trim().slice(0, 60)).filter(c => c && !["__proto__", "constructor", "prototype"].includes(c)))].slice(0, 20)
      : [];
    if (!this.categories.length) this.categories = ["Stadt", "Land", "Fluss"];

    this.graceSeconds = Number(options.graceSeconds ?? 5);
    if (!Number.isFinite(this.graceSeconds) || this.graceSeconds < 1) this.graceSeconds = 5;

    this.maxRounds = integer(options.rounds ?? 5, 5, 1, 100);
    this.graceSeconds = integer(this.graceSeconds, 5, 1, 60);

    this.round = 1;

    this.letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
    this.letter = this.randomLetter();

    this.submissions = {}; // { playerId: { name, answers: {cat: text}, finished: bool } }

    this.locked = false;
    this.firstFinishPlayerId = null;
    this.lockAt = null;
    this.lockTimer = null;

    this.graceInterval = null;
    this.graceRemaining = null;

    // Review
    this.reviewIndex = 0; // category index
    this.marks = {};      // { [category]: { [playerId]: "wrong"|"dup"|"correct" } }
  }

  get name() {
    return "slf";
  }

  randomLetter() {
    return this.letters[Math.floor(Math.random() * this.letters.length)];
  }

  updatePlayers(list) {
    this.players = list;
    this.submissions = Object.fromEntries(Object.entries(this.submissions).filter(([id]) => list.some(p => p.id === id)));
  }

  start() {
    this.round = 1;
    this.startRound();
  }

  startRound() {
    this.clearTimers();

    this.letter = this.randomLetter();
    this.locked = false;
    this.firstFinishPlayerId = null;
    this.lockAt = null;

    this.submissions = {};
    this.awardedPoints = {};
    this.graceRemaining = null;
    this.reviewIndex = 0;
    this.marks = {};
    for (const cat of this.categories) this.marks[cat] = {};

    this.sendState();
  }

  clearTimers() {
    if (this.lockTimer) {
        clearTimeout(this.lockTimer);
        this.lockTimer = null;
    }
    if (this.graceInterval) {
        clearInterval(this.graceInterval);
        this.graceInterval = null;
    }
    }


  getState({ role, playerId } = {}) {
    // end
    if (this.round > this.maxRounds) {
      return {
        mode: null,
        screen: "end",
        players: this.players,
      };
    }

    const screen = this.locked ? "review" : "input";

    return {
      mode: "slf",
      screen,
      round: this.round,
      maxRounds: this.maxRounds,
      letter: this.letter,
      categories: this.categories,

      submissions: role === "admin" || this.locked ? this.submissions : Object.fromEntries(
        Object.entries(this.submissions).map(([id, sub]) => [id, id === playerId ? sub : { ...sub, answers: {} }])
      ),
      locked: this.locked,

      firstFinishPlayerId: this.firstFinishPlayerId,
      lockAt: this.lockAt,
      graceSeconds: this.graceSeconds,
      graceRemaining: this.graceRemaining,

      reviewIndex: this.reviewIndex,
      currentCategory: this.categories[this.reviewIndex] || null,
      marks: this.marks,

      players: this.players,
    };
  }

  sendState() {
    this.io.emit("game_state");
  }

  // ---------------- PLAYER ----------------
  onPlayerAction(_, data) {
    const { action, playerId, answers } = data;

    const player = this.players.find(p => p.id === playerId);
    if (!player || this.round > this.maxRounds || this.submissions[playerId]?.finished) return;

    if (action === "slf_submit") {
      if (this.locked) return;

      const existing = this.submissions[playerId] || { name: player.name, answers: {}, finished: false };

      // store answers
      const nextAnswers = {};
      for (const cat of this.categories) {
        const value = answers?.[cat] ?? existing.answers?.[cat] ?? "";
        nextAnswers[cat] = typeof value === "string" ? value.slice(0, 1000) : "";
      }

      this.submissions[playerId] = {
        name: player.name,
        answers: nextAnswers,
        finished: existing.finished
      };

      this.sendState();
      return;
    }

    if (action === "slf_finish") {
      if (this.locked) return;

      // save answers one last time
      const existing = this.submissions[playerId] || { name: player.name, answers: {}, finished: false };
      const nextAnswers = {};
      for (const cat of this.categories) {
        const value = answers?.[cat] ?? existing.answers?.[cat] ?? "";
        nextAnswers[cat] = typeof value === "string" ? value.slice(0, 1000) : "";
      }

      this.submissions[playerId] = {
        name: player.name,
        answers: nextAnswers,
        finished: true
      };

      // first finisher triggers grace timer
     if (!this.firstFinishPlayerId) {
        this.firstFinishPlayerId = playerId;
        this.lockAt = Date.now() + this.graceSeconds * 1000;

        // ✅ server-side countdown start
        this.graceRemaining = this.graceSeconds;

        this.graceInterval = setInterval(() => {
            if (this.locked) return;

            const sec = Math.max(0, Math.ceil((this.lockAt - Date.now()) / 1000));
            this.graceRemaining = sec;

            this.sendState();

            if (sec <= 0) this.lockInputs();
        }, 250);

        // Backup timeout (optional, aber gut)
        this.lockTimer = setTimeout(() => {
            this.lockInputs();
        }, this.graceSeconds * 1000);
        }

      this.sendState();
      return;
    }
  }

  lockInputs() {
    if (this.locked) return;
    this.locked = true;
    this.clearTimers();

    this.graceRemaining = 0;
    this.reviewIndex = 0;

    this.sendState();
  }

  // ---------------- ADMIN ----------------
  onAdminAction(data) {
    const { action } = data;
    if (this.round > this.maxRounds) return;

    if (action === "slf_lock") {
      this.lockInputs();
      return;
    }

    if (action === "slf_mark") {
      // { category, playerId, mark }
      if (!this.locked) return;

      const { category, playerId, mark } = data;
      if (!this.categories.includes(category) || !this.players.some(p => p.id === playerId)) return;
      if (!this.marks[category]) this.marks[category] = {};

      const allowed = new Set(["wrong", "dup", "correct"]);
      if (!allowed.has(mark)) return;

      this.marks[category][playerId] = mark;
      this.sendState();
      return;
    }

    if (action === "slf_next_category") {
      if (!this.locked || this.round > this.maxRounds) return;

      if (this.reviewIndex < this.categories.length - 1) {
        this.reviewIndex++;
        this.sendState();
      }
      return;
    }

    if (action === "slf_prev_category") {
      if (!this.locked) return;

      if (this.reviewIndex > 0) {
        this.reviewIndex--;
        this.sendState();
      }
      return;
    }

    if (action === "slf_finalize_round") {
      if (!this.locked) return;

      this.applyPointsFromMarks();
      this.io.emit("players_update", this.players);
      this.sendState();
      return;
    }

    if (action === "slf_reroll") {
        if (this.locked) return;

        let next = this.randomLetter();
        while (next === this.letter) next = this.randomLetter();

        this.letter = next;
        this.sendState();
        return;
    }


    if (action === "slf_next_round") {
      if (this.round > this.maxRounds) return;
      // finalize if not done
      if (!this.locked) this.lockInputs();

      // optional: auto finalize if not finalized
      // (du kannst auch verlangen, dass finalize gedrückt werden muss)
      this.applyPointsFromMarks();
      this.io.emit("players_update", this.players);

      this.round++;
      if (this.round > this.maxRounds) {
        this.sendState();
        return;
      }
      this.startRound();
      return;
    }
  }

  applyPointsFromMarks() {
    const pointsFor = { wrong: 0, dup: 1, correct: 2 };

    for (const p of this.players) {
      let sum = 0;

      for (const cat of this.categories) {
        const mark = this.marks?.[cat]?.[p.id] || "wrong";
        sum += pointsFor[mark] ?? 0;
      }

      p.points = (p.points || 0) + sum - (this.awardedPoints[p.id] || 0);
      this.awardedPoints[p.id] = sum;
    }
  }
};

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createGameEngine } = require("../backend/src/gameEngine");

function fixture() {
  const events = [];
  const io = {
    emit(event, state) { events.push({ event, state }); },
    to(target) { return { emit(event, state) { events.push({ target, event, state: structuredClone(state) }); } }; },
  };
  const players = ["Alice", "Bob", "Chris"].map((name, i) => ({ id: `p${i}`, socketId: `s${i}`, name, points: 0, playerToken: "private-token" }));
  const engine = createGameEngine();
  engine.setPlayers(players);
  const select = (mode, options = {}) => engine.selectMode(mode, io, { adminName: "Host", ...options });
  const action = (index, payload) => engine.handlePlayerAction({ id: `s${index}` }, payload);
  return { engine, players, events, select, action };
}

test("all nine mode selections start, retain their state and return to the lobby", () => {
  const f = fixture();
  for (const mode of ["estimate", "pixel", "whois_emojis", "guessthebeer", "whatis", "slf", "test", "imposter", "drinking"]) {
    assert.equal(f.select(mode), true, mode);
    assert.ok(f.engine.currentMode);
    assert.notEqual(f.engine.getState().screen, "lobby");
    assert.equal(f.engine.currentMode.players, f.players);
    for (const event of f.events) {
      if (event.state) assert.equal(JSON.stringify(event.state).includes("private-token"), false);
      if (event.event === "admin_state") assert.equal(event.target, "admins");
    }
    f.engine.handleAdminAction({ action: "lobby" });
    assert.equal(f.engine.currentMode, null);
    assert.equal(f.engine.getState().screen, "lobby");
    assert.equal(f.engine.getState().mode, null);
  }
});

test("late joins and removals update every mode; invalid selections leave the current game intact", () => {
  const f = fixture();
  for (const name of ["estimate", "pixel", "whatis", "slf", "test", "imposter", "drinking"]) {
    f.engine.setPlayers(f.players);
    f.select(name);
    const late = { id: "late", socketId: "late-socket", name: "Dana", points: 0 };
    f.engine.setPlayers([...f.players, late]);
    assert.ok(f.engine.getState().players.some(p => p.id === "late"), name);
    assert.ok(f.engine.currentMode.players.some(p => p.id === "late"), name);
    f.engine.setPlayers([late]);
    assert.deepEqual(f.engine.getState().players.map(p => p.id), ["late"]);
    const previous = f.engine.currentMode;
    assert.equal(f.select("__proto__"), false);
    assert.equal(f.engine.currentMode, previous);
  }
});

test("estimate: identity, finite answers, zero, tie scoring, idempotent reveal and complete round", () => {
  const f = fixture();
  f.select("estimate", { questionCount: 1 });
  const mode = f.engine.currentMode;
  mode.questions = [{ question: "Zero?", answer: 0 }];
  for (const value of ["", " ", null, {}, Infinity, "NaN"]) f.action(0, { action: "answer", value });
  assert.deepEqual(mode.answers, {});
  f.action(0, { action: "answer", playerId: "p1", value: 0 });
  f.action(1, { action: "answer", value: 0 });
  f.action(2, { action: "answer", value: 5 });
  assert.equal(mode.answers.p0.answer, 0);
  assert.equal(f.engine.getState({ role: "player", playerId: "p0" }).correctAnswer, null);
  assert.deepEqual(Object.keys(f.engine.getState({ role: "player", playerId: "p0" }).answers), ["p0"]);
  assert.equal(f.engine.getState({ role: "admin" }).correctAnswer, 0);
  f.engine.handleAdminAction({ action: "reveal" });
  assert.deepEqual(f.players.map(p => p.points), [3, 3, 1]);
  f.engine.handleAdminAction({ action: "reveal" });
  f.action(0, { action: "answer", value: 999 });
  assert.equal(mode.answers.p0.answer, 0);
  assert.deepEqual(f.players.map(p => p.points), [3, 3, 1]);
  f.engine.handleAdminAction({ action: "next" });
  assert.equal(f.engine.getState().screen, "end");
  assert.doesNotThrow(() => f.action(0, { action: "answer", value: 42 }));
});

for (const modeName of ["pixel", "whois_emojis", "guessthebeer"]) {
  test(`${modeName}: first buzzer, blocking, exactly three points, reveal, all questions, safe end state`, () => {
    const f = fixture();
    f.select(modeName);
    const mode = f.engine.currentMode;
    const next = modeName === "pixel" ? "next_image" : "next_hint";
    const initial = f.engine.getState({ role: "player", playerId: "p0" });
    assert.equal(initial.title, null);
    if (modeName !== "pixel") assert.equal(initial.hints.length, 1);
    f.action(0, { action: "buzz" });
    f.action(1, { action: "buzz" });
    assert.equal(mode.buzzedPlayer.id, "p0");
    f.engine.handleAdminAction("wrong");
    f.action(0, { action: "buzz" });
    assert.equal(mode.buzzedPlayer, null);
    f.action(1, { action: "buzz" });
    f.engine.handleAdminAction("correct");
    f.engine.handleAdminAction("correct");
    assert.equal(f.players[1].points, 3);
    assert.equal(mode.buzzedPlayer, null);
    assert.ok(f.engine.getState({ role: "player", playerId: "p0" }).title);
    f.engine.handleAdminAction(next);
    assert.equal(mode.blockedPlayers.size, 0);
    let limit = 100;
    while (f.engine.getState().screen !== "end" && limit--) f.engine.handleAdminAction(next);
    assert.ok(limit > 0);
    assert.doesNotThrow(() => f.engine.handleAdminAction(next));
    assert.doesNotThrow(() => f.action(0, { action: "buzz" }));
  });
}

test("WhatIs: opaque options hide authors/solution, voting closes on reveal, original 2/1 scoring", () => {
  const f = fixture();
  f.select("whatis");
  f.action(0, { action: "submit_fake", value: "Fake A" });
  f.action(1, { action: "submit_fake", value: "Fake B" });
  assert.deepEqual(Object.keys(f.engine.getState({ role: "player", playerId: "p0" }).answers), ["p0"]);
  f.engine.handleAdminAction({ action: "reveal" });
  const mode = f.engine.currentMode;
  const playerState = f.engine.getState({ role: "player", playerId: "p0" });
  assert.equal(playerState.correctAnswerId, null);
  assert.ok(!Object.hasOwn(playerState.answers, "correct"));
  assert.ok(Object.values(playerState.answers).every(a => a.author === undefined));
  const fakeA = Object.keys(mode.answers).find(id => mode.answers[id].author === "p0");
  f.action(0, { action: "select_answer", value: mode.correctId });
  f.action(1, { action: "select_answer", value: fakeA });
  f.action(2, { action: "select_answer", value: "invalid" });
  assert.equal(mode.votes.p2, undefined);
  f.engine.handleAdminAction({ action: "reveal_answer", answerId: mode.correctId });
  f.action(0, { action: "select_answer", value: fakeA });
  assert.equal(mode.votes.p0, mode.correctId);
  f.engine.handleAdminAction({ action: "next" });
  assert.deepEqual(f.players.map(p => p.points), [3, 0, 0]);
  for (let i = 0; i < 10; i++) f.engine.handleAdminAction({ action: "next" });
  assert.equal(f.engine.getState().screen, "end");
});

test("SLF: finished answers lock, private drafts, idempotent and adjustable 0/1/2 points, timer cleanup", () => {
  const f = fixture();
  f.select("slf", { categories: ["Stadt"], rounds: 1 });
  const mode = f.engine.currentMode;
  f.action(0, { action: "slf_submit", answers: { Stadt: "Berlin" } });
  assert.deepEqual(f.engine.getState({ role: "player", playerId: "p1" }).submissions.p0.answers, {});
  f.action(0, { action: "slf_finish", answers: { Stadt: "Berlin" } });
  f.action(0, { action: "slf_submit", answers: { Stadt: "Changed" } });
  assert.equal(mode.submissions.p0.answers.Stadt, "Berlin");
  assert.ok(mode.lockTimer);
  f.engine.handleAdminAction({ action: "slf_lock" });
  assert.equal(mode.lockTimer, null);
  assert.equal(mode.graceInterval, null);
  for (const [i, mark] of ["correct", "dup", "wrong"].entries()) {
    f.engine.handleAdminAction({ action: "slf_mark", category: "Stadt", playerId: `p${i}`, mark });
  }
  f.engine.handleAdminAction({ action: "slf_finalize_round" });
  f.engine.handleAdminAction({ action: "slf_finalize_round" });
  assert.deepEqual(f.players.map(p => p.points), [2, 1, 0]);
  f.engine.handleAdminAction({ action: "slf_mark", category: "Stadt", playerId: "p0", mark: "dup" });
  f.engine.handleAdminAction({ action: "slf_next_round" });
  assert.deepEqual(f.players.map(p => p.points), [1, 1, 0]);
  assert.equal(f.engine.getState().screen, "end");
  f.select("slf");
  f.action(0, { action: "slf_finish", answers: {} });
  const old = f.engine.currentMode;
  f.select("estimate");
  assert.equal(old.lockTimer, null);
  assert.equal(old.graceInterval, null);
});

test("Imposter: only own role/word, valid live voting, tie, eviction and win, complete word set", () => {
  const f = fixture();
  f.select("imposter");
  const mode = f.engine.currentMode;
  mode.imposters = new Set(["Alice"]);
  const imposter = f.engine.getState({ role: "player", playerId: "p0" });
  const crew = f.engine.getState({ role: "player", playerId: "p1" });
  assert.equal(imposter.isImposter, true);
  assert.equal(imposter.word, null);
  assert.ok(crew.word);
  assert.equal(crew.imposters, undefined);
  assert.equal(f.engine.getState({ role: "admin" }).isImposter, false);
  f.action(0, { action: "select_player", value: "Bob" });
  assert.equal(mode.selectedPlayers.size, 0);
  f.engine.handleAdminAction({ action: "start_selection" });
  f.action(0, { action: "select_player", value: "Bob" });
  f.action(1, { action: "select_player", value: "Alice" });
  f.engine.handleAdminAction({ action: "vote_imposter" });
  assert.equal(mode.kicked.size, 0);
  f.action(2, { action: "select_player", voterName: "Alice", value: "Alice" });
  f.engine.handleAdminAction({ action: "vote_imposter" });
  assert.ok(mode.kicked.has("Alice"));
  assert.equal(mode.crewmatesWin, true);
  f.action(0, { action: "select_player", value: "Bob" });
  assert.equal(mode.selectedPlayers.size, 0);
  mode.currentIndex = mode.questions.length - 1;
  f.engine.handleAdminAction({ action: "next_round" });
  assert.equal(f.engine.getState().screen, "end");
});

test("DrinkGame: stable names, partial reveal rankings, zero answer, departed voter, complete questions", () => {
  const f = fixture();
  f.select("drinking");
  const mode = f.engine.currentMode;
  mode.questions = [
    { id: "names", task: "[name1] und [name2]: [sips]" },
    { id: "schaetz", question: "Zero?", answer: 0 },
    { id: "werwuerde", task: "Wer würde?" },
  ];
  mode.start();
  const task = mode.getState().taskName;
  for (let i = 0; i < 5; i++) mode.sendState();
  assert.equal(mode.getState().taskName, task);
  assert.ok(!task.includes("["));
  f.engine.handleAdminAction({ action: "next_question" });
  f.action(0, { action: "schaetz_wert", schaetzerName: "Bob", value: 0 });
  f.action(1, { action: "schaetz_wert", value: 10 });
  assert.equal(mode.playerEstimates.get("Alice"), 0);
  assert.equal(mode.getState().correctAnswer, null);
  assert.equal(mode.getState({ role: "player", playerId: "p2" }).playerEstimates.Alice, null);
  f.engine.handleAdminAction({ action: "reveal_question" });
  assert.equal(mode.getState().correctAnswer, 0);
  assert.deepEqual(mode.getState().estimateRanking.map(p => p.name), ["Alice", "Bob"]);
  f.engine.handleAdminAction({ action: "next_question" });
  for (let i = 0; i < 3; i++) f.action(i, { action: "select_player", value: "Alice" });
  assert.equal(mode.getState().voted, false);
  f.engine.handleAdminAction({ action: "select_player", value: "Alice" });
  assert.equal(mode.getState().voted, true);
  assert.deepEqual(mode.getState().topPlayers, ["Alice"]);
  f.engine.setPlayers([f.players[0]]);
  assert.deepEqual(mode.getState().allPlayer, ["Alice", "Host"]);
  f.engine.handleAdminAction({ action: "next_question" });
  assert.equal(f.engine.getState().screen, "end");
});

test("test chat: ordinary host messages work; repeated commands stop on mode change", async () => {
  const f = fixture();
  f.select("test");
  const mode = f.engine.currentMode;
  f.engine.handleAdminAction({ action: "send_message", value: "Hello" });
  assert.equal(mode.messages[0].message, "Hello");
  f.engine.handleAdminAction({ action: "send_message", value: "/x5 = repeated" });
  f.select("estimate");
  await new Promise(resolve => setTimeout(resolve, 60));
  assert.equal(mode.messages.length, 1);
  assert.equal(mode.commandTimers.size, 0);
});

test("question JSON and all pixel assets are valid", () => {
  const base = path.resolve(__dirname, "../backend/src/questions");
  for (const filename of fs.readdirSync(base).filter(f => f.endsWith(".json"))) {
    const data = JSON.parse(fs.readFileSync(path.join(base, filename), "utf8"));
    assert.ok(Array.isArray(data) && data.length, filename);
    if (filename.startsWith("estimate")) for (const q of data) assert.ok(typeof q.question === "string" && Number.isFinite(q.answer), filename);
    if (filename === "pixelPictures.json") for (const q of data) for (const image of q.images) assert.ok(fs.existsSync(path.resolve(__dirname, "../frontend/public" + image)), image);
    if (["whoIsQuestionsEmojis.json", "guessTheBeer.json"].includes(filename)) for (const q of data) assert.equal(q.hints.length, 4);
  }
});

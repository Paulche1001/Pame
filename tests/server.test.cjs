const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createRequire } = require("node:module");
const path = require("node:path");
const frontendRequire = createRequire(path.resolve(__dirname, "../frontend/package.json"));
const { io } = frontendRequire("socket.io-client");
const { createGameServer } = require("../backend/src/server");

function waitFor(socket, event, predicate = () => true, timeout = 3000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket.off(event, handler); reject(new Error(`Timed out: ${event}`)); }, timeout);
    function handler(value) {
      if (!predicate(value)) return;
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(value);
    }
    socket.on(event, handler);
  });
}
async function fixture(t, options) {
  const game = createGameServer({ adminToken: "", ...options });
  await new Promise(resolve => game.server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${game.server.address().port}`;
  const sockets = [];
  t.after(async () => { for (const socket of sockets) socket.disconnect(); await game.close(); });
  async function connect() {
    const socket = io(url, { autoConnect: false, reconnection: false, transports: ["websocket"] });
    sockets.push(socket);
    const ready = waitFor(socket, "connect");
    socket.connect();
    await ready;
    return socket;
  }
  const admin = await connect();
  const ready = waitFor(admin, "admin_state");
  admin.emit("admin_join", { token: options?.adminToken || "" });
  await ready;
  function join(socket, id, name, token = `${id}-private-player-token`) {
    return socket.timeout(2000).emitWithAck("player_join", { playerId: id, playerToken: token, name });
  }
  async function select(modeName, options = {}) {
    const state = waitFor(admin, "admin_state", s => s.mode === (modeName.startsWith("whois") || modeName === "guessthebeer" ? "whois" : modeName));
    admin.emit("admin_select_mode", { modeName, options: { adminName: "Host", ...options } });
    return state;
  }
  return { ...game, url, connect, join, select, admin };
}

test("real sockets: player admission, unique names, role isolation and safe malformed messages", async t => {
  const f = await fixture(t);
  const alice = await f.connect();
  const bob = await f.connect();
  assert.equal((await f.join(alice, "alice", "  Alice  ")).success, true);
  assert.equal((await f.join(bob, "bob", "alice")).success, false);
  assert.equal((await f.join(bob, "bob", " ")).success, false);
  assert.equal((await f.join(bob, "bob", "Bob")).success, true);
  const leakedAdmin = [];
  alice.on("admin_state", s => leakedAdmin.push(s));
  await f.select("estimate", { questionCount: 1 });
  const correct = f.gameEngine.currentMode.questions[0].answer;
  const state = waitFor(alice, "game_state", s => s.answers.alice);
  alice.emit("admin_change_points", { playerId: "bob", amount: 100 });
  alice.emit("admin_action", { action: "lobby" });
  alice.emit("player_action", { action: "answer", playerId: "bob", value: correct });
  const playerState = await state;
  assert.equal(playerState.correctAnswer, null);
  assert.equal(playerState.answers.alice.answer, correct);
  assert.equal(playerState.answers.bob, undefined);
  assert.equal(f.gameEngine.getState().mode, "estimate");
  assert.equal(f.gameEngine.getState().players.find(p => p.id === "bob").points, 0);
  assert.equal(JSON.stringify(playerState).includes("playerToken"), false);
  assert.equal(JSON.stringify(playerState).includes("socketId"), false);
  assert.equal(leakedAdmin.length, 0);
  for (const payload of [null, true, [], {}, { action: "answer", value: { toString: null } }]) alice.emit("player_action", payload);
  const result = waitFor(alice, "game_state", s => s.screen === "results");
  f.admin.emit("admin_action", { action: "reveal" });
  assert.equal((await result).players.find(p => p.id === "alice").points, 3);
  assert.deepEqual(await (await fetch(f.url + "/health")).json(), { ok: true });
});

test("public host key: anonymous and incorrect admin requests cannot read or control a game", async t => {
  const adminToken = "test-only-admin-key-with-at-least-16-characters";
  const f = await fixture(t, { adminToken });
  const guest = await f.connect();
  const receivedAdminStates = [];
  guest.on("admin_state", state => receivedAdminStates.push(state));
  const missing = await guest.timeout(2000).emitWithAck("admin_join", {});
  assert.equal(missing.success, false);
  const invalid = await guest.timeout(2000).emitWithAck("admin_join", { token: "wrong" });
  assert.equal(invalid.success, false);
  guest.emit("admin_select_mode", "pixel");
  const state = await f.select("whois_emojis");
  assert.equal(state.variant, "whois_emojis");
  assert.equal(receivedAdminStates.length, 0);
  assert.equal(JSON.stringify(state).includes(adminToken), false);
  const accepted = await guest.timeout(2000).emitWithAck("admin_join", { token: adminToken });
  assert.equal(accepted.success, true);
  const changed = waitFor(guest, "admin_state", s => s.mode === "pixel");
  guest.emit("admin_select_mode", "pixel");
  assert.equal((await changed).mode, "pixel");
});

test("real sockets: reconnect keeps score, late join can answer, stolen ID and stale tab cannot act", async t => {
  const f = await fixture(t, { reconnectMs: 1000 });
  const alice = await f.connect();
  await f.join(alice, "alice", "Alice");
  await f.select("estimate");
  let state = waitFor(f.admin, "admin_state", s => s.players[0]?.points === 5);
  f.admin.emit("admin_change_points", { playerId: "alice", amount: 5 });
  await state;
  const bob = await f.connect();
  await f.join(bob, "bob", "Bob");
  state = waitFor(f.admin, "admin_state", s => s.answers.bob);
  bob.emit("player_action", { action: "answer", value: 123 });
  await state;
  const intruder = await f.connect();
  assert.equal((await f.join(intruder, "alice", "Alice", "incorrect-private-token")).success, false);
  const replacement = await f.connect();
  const replaced = waitFor(alice, "session_replaced");
  assert.equal((await f.join(replacement, "alice", "Alice")).success, true);
  await replaced;
  alice.emit("player_action", { action: "answer", value: 999 });
  state = waitFor(f.admin, "admin_state", s => s.answers.alice?.answer === 42);
  replacement.emit("player_action", { action: "answer", value: 42 });
  await state;
  replacement.disconnect();
  const reconnected = await f.connect();
  assert.equal((await f.join(reconnected, "alice", "Alice")).success, true);
  assert.equal(f.gameEngine.getState().players.find(p => p.id === "alice").points, 5);
  const answerState = f.gameEngine.getState({ role: "player", playerId: "alice" });
  assert.equal(answerState.answers.alice.answer, 42);
  alice.disconnect();
});

test("real sockets: leave, kick, expiry and late admin sync", async t => {
  const f = await fixture(t, { reconnectMs: 100 });
  const alice = await f.connect();
  const bob = await f.connect();
  await f.join(alice, "alice", "Alice");
  await f.join(bob, "bob", "Bob");
  assert.equal((await alice.timeout(2000).emitWithAck("player_leave", { playerId: "bob" })).success, false);
  assert.equal((await bob.timeout(2000).emitWithAck("player_leave", { playerId: "bob" })).success, true);
  await f.join(bob, "bob", "Bob");
  const kicked = waitFor(bob, "kicked");
  f.admin.emit("admin_delete_player", "bob");
  await kicked;
  assert.equal((await f.join(bob, "bob", "Bob")).success, false);
  await f.select("whois_emojis");
  const toggled = waitFor(alice, "leaderboard_toggle", Boolean);
  f.admin.emit("admin_toggle_leaderboard", true);
  await toggled;
  const secondAdmin = await f.connect();
  const lateState = waitFor(secondAdmin, "admin_state");
  const lateLeaderboard = waitFor(secondAdmin, "leaderboard_toggle");
  secondAdmin.emit("admin_join");
  const snapshot = await lateState;
  assert.equal(snapshot.hints.length, 4);
  assert.ok(snapshot.title);
  assert.equal(await lateLeaderboard, true);
  const removed = waitFor(f.admin, "players_update", players => players.length === 0);
  alice.disconnect();
  await removed;
  assert.equal(f.gameEngine.currentMode.players.length, 0);
});

test("real sockets: pixel timer advances exactly once, stops on buzz and cancels on mode switch", async t => {
  const f = await fixture(t);
  const alice = await f.connect();
  await f.join(alice, "alice", "Alice");
  await f.select("pixel");
  let state = waitFor(f.admin, "admin_state", s => s.imageStep === 1);
  f.admin.emit("admin_start_timer", 1);
  await state;
  assert.equal(f.gameEngine.currentMode.step, 1);
  const stopped = waitFor(alice, "timer_done");
  f.admin.emit("admin_start_timer", 1);
  state = waitFor(f.admin, "admin_state", s => s.buzzedPlayer?.id === "alice");
  alice.emit("player_action", { action: "buzz" });
  await state;
  await stopped;
  await new Promise(resolve => setTimeout(resolve, 1100));
  assert.equal(f.gameEngine.currentMode.step, 1);
  f.admin.emit("admin_start_timer", 1);
  await f.select("estimate");
  await new Promise(resolve => setTimeout(resolve, 1100));
  assert.equal(f.gameEngine.getState().mode, "estimate");
  assert.equal(f.gameEngine.currentMode.currentIndex, 0);
});

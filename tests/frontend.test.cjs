const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const { createRequire } = require("node:module");
const { pathToFileURL } = require("node:url");
const path = require("node:path");
const { createGameEngine } = require("../backend/src/gameEngine");
const frontendRequire = createRequire(path.resolve(__dirname, "../frontend/package.json"));
const React = frontendRequire("react");
const { renderToStaticMarkup } = frontendRequire("react-dom/server");
let vite;
async function loader() {
  if (!vite) {
    const { createServer } = await import(pathToFileURL(frontendRequire.resolve("vite")).href);
    const { default: react } = await import(pathToFileURL(frontendRequire.resolve("@vitejs/plugin-react")).href);
    vite = await createServer({ root: path.resolve(__dirname, "../frontend"), configFile: false, plugins: [react()], optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false, ws: false }, appType: "custom" });
  }
  return vite;
}
after(async () => { await vite?.close(); });

test("room links and saved names/host keys stay separate without resetting a browser's identity", async () => {
  const original = { window: global.window, localStorage: global.localStorage, sessionStorage: global.sessionStorage };
  const storage = () => {
    const values = new Map();
    return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) };
  };
  global.localStorage = storage();
  global.sessionStorage = storage();
  global.window = { location: new URL("http://localhost/player?room=ABC234"), history: { replaceState(_, __, url) { global.window.location = new URL(url, global.window.location); } } };
  try {
    const server = await loader();
    const rooms = await server.ssrLoadModule("/src/lib/rooms.js");
    const { playerIdentity } = await server.ssrLoadModule("/src/lib/connection.js");
    const identity = playerIdentity();
    rooms.rememberPlayerRoom("ABC234", "Alice");
    rooms.rememberPlayerRoom("DEF567", "Bob");
    rooms.clearPlayerRoom("ABC234");
    assert.equal(rooms.savedPlayerName("ABC234"), null);
    assert.equal(rooms.savedPlayerName("DEF567"), "Bob");
    assert.deepEqual(playerIdentity(), identity);
    rooms.rememberHostRoom({ roomCode: "ABC234", hostKey: "host-secret-a" });
    rooms.rememberHostRoom({ roomCode: "DEF567", hostKey: "host-secret-b" });
    assert.equal(rooms.savedHostKey("ABC234"), "host-secret-a");
    assert.equal(rooms.readHostRoom().roomCode, "DEF567");
    assert.ok(!window.location.href.includes("host-secret"));
    rooms.setRoomInUrl("ZZZ999");
    assert.equal(rooms.readHostRoom(), null);
    sessionStorage.setItem("pameHostRooms", "broken JSON");
    assert.equal(rooms.savedHostKey("ABC234"), "");
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete global[key]; else global[key] = value;
    }
  }
});

test("rankings handle ties and zero without mutating game state", async () => {
  const server = await loader();
  const { leaderboard, rankBy } = await server.ssrLoadModule("/src/lib/ranking.js");
  const players = Object.freeze([Object.freeze({ id: "a", points: 0 }), Object.freeze({ id: "b", points: 3 }), Object.freeze({ id: "c", points: 3 })]);
  const ranked = leaderboard(players);
  assert.deepEqual(ranked.map(p => p.rank), [1, 1, 3]);
  assert.deepEqual(players.map(p => p.id), ["a", "b", "c"]);
  assert.deepEqual(rankBy([{ x: 2 }, { x: 0 }, { x: 0 }], item => item.x, 1).map(p => p.rank), [1, 1, 3]);
});

test("every admin/player game view renders real server states through complete phases", async () => {
  const server = await loader();
  const engine = createGameEngine();
  const players = ["Alice", "Bob"].map((name, i) => ({ name, id: `p${i}`, socketId: `s${i}`, points: 0 }));
  engine.setPlayers(players);
  const io = { emit() {}, to() { return this; } };
  const modes = { estimate: "Estimate", pixel: "Pixel", whois_emojis: "WhoIs", guessthebeer: "WhoIs", whatis: "WhatIs", slf: "SLF", test: "Test", imposter: "Imposter", drinking: "Drinking" };
  async function render(prefix, suffix, state) {
    const { default: Component } = await server.ssrLoadModule(`/src/pages/${prefix}${suffix}.jsx`);
    const html = renderToStaticMarkup(React.createElement(Component, { gameState: state, playerId: "p0", socket: { emit() {} }, timer: null, toggleLeaderboard() {} }));
    assert.ok(html.length > 10, prefix + suffix);
    assert.ok(!html.includes("NaN"), prefix + suffix);
    return html;
  }
  for (const [mode, prefix] of Object.entries(modes)) {
    engine.selectMode(mode, io, { adminName: "Host", rounds: 1 });
    const check = async () => {
      await render(prefix, "Admin", engine.getState({ role: "admin" }));
      await render(prefix, "Player", engine.getState({ role: "player", playerId: "p0" }));
    };
    await check();
    if (mode === "estimate") {
      engine.handlePlayerAction({ id: "s0" }, { action: "answer", value: 0 });
      engine.handleAdminAction({ action: "reveal" });
      await check();
    }
    if (["pixel", "whois_emojis", "guessthebeer"].includes(mode)) {
      engine.handlePlayerAction({ id: "s0" }, { action: "buzz" });
      await check();
      engine.handleAdminAction("correct");
      await check();
    }
    if (mode === "whatis") {
      engine.handlePlayerAction({ id: "s0" }, { action: "submit_fake", value: "A fake answer" });
      engine.handleAdminAction({ action: "reveal" });
      await check();
      engine.handleAdminAction({ action: "reveal_answer", answerId: engine.currentMode.correctId });
      await check();
    }
    if (mode === "slf") { engine.handleAdminAction({ action: "slf_lock" }); await check(); }
    if (mode === "imposter") {
      engine.currentMode.imposters = new Set(["Alice"]);
      const html = await render(prefix, "Player", engine.getState({ role: "player", playerId: "p0" }));
      assert.ok(html.includes("Du bist Imposter"));
      engine.handleAdminAction({ action: "start_selection" });
      await check();
    }
    if (mode === "drinking") {
      engine.currentMode.questions = [{ id: "schaetz", question: "Zero?", answer: 0 }, { id: "werwuerde", task: "Wer?" }];
      engine.currentMode.start();
      await check();
      engine.handleAdminAction({ action: "reveal_question" });
      await check();
      engine.handleAdminAction({ action: "next_question" });
      await check();
      engine.handleAdminAction({ action: "reveal_question" });
      await check();
    }
  }
  engine.disposeMode();
  await render("End", "Admin", { screen: "end", players });
  await render("End", "Player", { screen: "end", players });
});

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createGameEngine } = require("../backend/src/gameEngine");

test("personal WhoIs set is absent and both public variants remain available", () => {
  const engine = createGameEngine();
  const io = { emit() {}, to() { return this; } };
  assert.equal(fs.existsSync(path.resolve(__dirname, "../backend/src/questions/whoIsQuestions.json")), false);
  assert.equal(engine.selectMode("whois", io), false);
  for (const variant of ["whois_emojis", "guessthebeer"]) {
    assert.equal(engine.selectMode(variant, io), true);
    const state = engine.getState({ role: "admin" });
    assert.equal(state.mode, "whois");
    assert.equal(state.variant, variant);
    assert.equal(state.hints.length, 4);
  }
});

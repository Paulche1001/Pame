// Optional real-browser regression run, using Chromium's built-in DevTools API.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const net = require("node:net");
const { createRequire } = require("node:module");
const { pathToFileURL } = require("node:url");
const { createGameServer } = require("../backend/src/server");
const frontendRequire = createRequire(path.resolve(__dirname, "../frontend/package.json"));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  const browserPath = [process.env.BROWSER_BIN,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "/usr/bin/chromium", "/usr/bin/google-chrome",
  ].find(p => p && fs.existsSync(p));
  if (!browserPath) throw Error("Chrome/Edge nicht gefunden. BROWSER_BIN setzen.");
  const artifacts = path.resolve(__dirname, "../.test-artifacts");
  const profile = path.join(artifacts, `browser-profile-${Date.now()}`);
  fs.mkdirSync(profile, { recursive: true });
  const game = createGameServer({ adminToken: process.env.SMOKE_ADMIN_TOKEN || "" });
  let vite, browser, ws;
  const errors = [];
  try {
    await new Promise(resolve => game.server.listen(0, "127.0.0.1", resolve));
    process.env.VITE_SERVER_URL = `http://127.0.0.1:${game.server.address().port}`;
    const { createServer } = await import(pathToFileURL(frontendRequire.resolve("vite")).href);
    const { default: react } = await import(pathToFileURL(frontendRequire.resolve("@vitejs/plugin-react")).href);
    // Vite interprets port 0 as its default port, which may already run the user's app.
    const probe = net.createServer();
    await new Promise((resolve, reject) => { probe.once("error", reject); probe.listen(0, "127.0.0.1", resolve); });
    const frontendPort = probe.address().port;
    await new Promise(resolve => probe.close(resolve));
    vite = await createServer({ root: path.resolve(__dirname, "../frontend"), configFile: false, plugins: [react()], server: { host: "127.0.0.1", port: frontendPort, strictPort: true, hmr: false, ws: false } });
    await vite.listen();
    const url = `http://127.0.0.1:${vite.httpServer.address().port}`;
    console.log("Browser smoke: starting isolated local browser.");
    browser = spawn(browserPath, ["--headless=new", "--no-sandbox", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], { windowsHide: true, stdio: "ignore" });
    const activePort = path.join(profile, "DevToolsActivePort");
    for (let i = 0; !fs.existsSync(activePort) && i < 150; i++) await pause(100);
    if (!fs.existsSync(activePort)) throw Error("Browser konnte nicht gestartet werden.");
    const [port, endpoint] = fs.readFileSync(activePort, "utf8").trim().split(/\r?\n/);
    ws = new WebSocket(`ws://127.0.0.1:${port}${endpoint}`);
    await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
    let nextId = 0;
    const pending = new Map();
    function send(method, params = {}, sessionId) {
      return new Promise((resolve, reject) => {
        const id = ++nextId;
        const timer = setTimeout(() => { pending.delete(id); reject(Error(`CDP timeout: ${method}`)); }, 10000);
        pending.set(id, { resolve, reject, timer });
        ws.send(JSON.stringify({ id, method, params, sessionId }));
      });
    }
    ws.onmessage = event => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const request = pending.get(message.id);
        if (!request) return;
        clearTimeout(request.timer);
        pending.delete(message.id);
        if (message.error) request.reject(Error(message.error.message));
        else request.resolve(message.result);
      }
      if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
      if (message.method === "Page.javascriptDialogOpening") send("Page.handleJavaScriptDialog", { accept: true }, message.sessionId).catch(error => errors.push(error.message));
    };
    async function page(route) {
      const { browserContextId } = await send("Target.createBrowserContext");
      const { targetId } = await send("Target.createTarget", { url: "about:blank", browserContextId });
      const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
      await send("Runtime.enable", {}, sessionId);
      await send("Page.enable", {}, sessionId);
      const mobile = route === "/player";
      await send("Emulation.setDeviceMetricsOverride", { width: mobile ? 390 : 900, height: mobile ? 844 : 1000, deviceScaleFactor: 1, mobile }, sessionId);
      await send("Page.navigate", { url: url + route }, sessionId);
      const evaluate = async expression => {
        const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }, sessionId);
        if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
        return result.result.value;
      };
      async function until(expression) {
        for (let i = 0; i < 100; i++) {
          try { if (await evaluate(expression)) return; }
          catch (error) {
            if (!/Inspected target navigated or closed|Execution context was destroyed|Cannot find context with specified id/.test(error.message)) throw error;
          }
          await pause(75);
        }
        throw Error(`Browser assertion timed out: ${expression}\n${await evaluate("document.body.innerText")}`);
      }
      async function button(text) {
        const expression = `Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()===${JSON.stringify(text)})`;
        await until(`!!(${expression}) && !(${expression}).disabled`);
        await evaluate(`(${expression}).click()`);
      }
      async function input(selector, value) {
        await until(`!!document.querySelector(${JSON.stringify(selector)})`);
        await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(String(value))});e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
      }
      const text = async value => {
        await until(`document.body.innerText.includes(${JSON.stringify(value)})`);
        if (mobile) assert.equal(await evaluate("document.documentElement.scrollWidth <= window.innerWidth"), true, `Mobile overflow: ${value}`);
      };
      await until("document.querySelector('button') !== null");
      return { sessionId, evaluate, until, button, input, text };
    }
    const admin = await page("/admin");
    if (process.env.SMOKE_ADMIN_TOKEN) {
      await admin.input('input[type="password"]', process.env.SMOKE_ADMIN_TOKEN);
      await admin.button("Anmelden");
    }
    const alice = await page("/player");
    const bob = await page("/player");
    for (const [p, name] of [[alice, "Alice"], [bob, "Bob"]]) {
      await p.input('input[placeholder="Dein Name"]', name);
      await p.button("Join");
      await p.text(`Hey ${name}`);
    }
    await admin.text("2 Spieler online");
    console.log("Browser smoke: two players joined.");
    async function lobby() { await admin.button("Verlassen"); await admin.text("Spielrunde vorbereiten"); }
    async function mode(label) {
      const expression = `Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes(${JSON.stringify(label)}))`;
      await admin.until(`!!(${expression}) && !(${expression}).disabled`);
      await admin.evaluate(`(${expression}).click()`);
    }

    await mode("Schätzfragen");
    await admin.input('input[type="number"]', 1);
    await admin.button("Runde starten");
    await alice.input('input[type="number"]', 0);
    await alice.button("Einloggen");
    await alice.until("document.querySelector('button') && Array.from(document.querySelectorAll('button')).some(b=>b.textContent.trim()==='Einloggen' && b.disabled)");
    await send("Page.reload", {}, alice.sessionId);
    await alice.until("document.querySelector('input[type=number]')?.value === '0'");
    await admin.button("Antworten aufdecken");
    await alice.text("Richtige Antwort:");
    await admin.button("Leaderboard");
    await alice.text("Leaderboard");
    await admin.button("Schließen");
    await alice.text("Richtige Antwort:");
    await admin.button("Nächste Frage");
    await admin.text("Punktestand");
    await admin.button("Lobby");

    console.log("Browser smoke: estimate and reload passed.");

    await mode("Pixelraten");
    await alice.button("BUZZ!");
    await admin.text("Alice hat gebuzzert!");
    await admin.button("✔ Richtig");
    await admin.button("Nächstes Bild");
    await lobby();

    console.log("Browser smoke: pixel passed.");

    await mode("Who Is?");
    await admin.input('input[type="number"]', 1);
    await admin.button("Runde starten");
    await send("Page.reload", {}, admin.sessionId);
    await admin.text("Alle Hinweise:");
    await bob.button("BUZZ!");
    await admin.button("✘ Falsch");
    await bob.text("gesperrt");
    await alice.button("BUZZ!");
    await admin.button("✔ Richtig");
    await admin.button("Nächste Person");
    await admin.text("Punktestand");
    await admin.button("Lobby");

    console.log("Browser smoke: WhoIs passed.");

    await mode("What Is?");
    for (const [p, value] of [[alice, "Fake Alice"], [bob, "Fake Bob"]]) {
      await p.input("input", value);
      await p.button("Abschicken");
    }
    await admin.button("Voting starten");
    const correct = game.gameEngine.currentMode.questions[0].answer;
    await alice.button(correct.toUpperCase());
    await admin.evaluate(`Array.from(document.querySelectorAll('div.cursor-pointer')).find(d=>d.textContent.includes(${JSON.stringify(correct)})).click()`);
    await alice.text("✔ Richtige Antwort");
    await admin.button("Nächste Frage");
    await alice.until("document.querySelector('input')?.value === ''");
    await lobby();

    console.log("Browser smoke: WhatIs passed.");

    await mode("Stadt–Land–Fluss");
    await admin.input('input[type="number"]', 1);
    await admin.button("Runde starten");
    await alice.input('input[placeholder^="Stadt"]', "Berlin");
    await alice.button("Fertig");
    await admin.button("Eingabe stoppen");
    await admin.text("Berlin");
    await admin.button("2");
    await admin.button("Nächste Kategorie →");
    await admin.button("Nächste Kategorie →");
    await admin.button("Nächste Runde");
    await admin.text("Punktestand");
    await admin.button("Lobby");

    console.log("Browser smoke: SLF passed.");

    await mode("Imposter");
    await admin.input('input[type="text"]', "Host");
    await admin.button("Runde starten");
    await alice.until("!!document.querySelector('summary')");
    await alice.evaluate("document.querySelector('summary').click()");
    await alice.text(game.gameEngine.currentMode.imposters.has("Alice") ? "Du bist Imposter" : "Du bist Crewmate");
    await admin.button("Abstimmung");
    const target = [...game.gameEngine.currentMode.imposters][0];
    for (const p of [alice, bob]) {
      await p.until("document.querySelector('input[type=radio]') !== null");
      await p.evaluate(`Array.from(document.querySelectorAll('li')).find(li=>li.textContent.includes(${JSON.stringify(target === (p === alice ? "Alice" : "Bob") ? "Du" : target)})).querySelector('input').click()`);
    }
    await admin.button("Vote");
    await alice.text("Crewmate");
    await admin.button("Nächste Runde");
    await alice.until("!!document.querySelector('details') && !document.querySelector('details').open");
    await admin.button("X");
    await admin.text("Spielrunde vorbereiten");

    await mode("DrinkGame");
    await admin.input('input[type="text"]', "Host");
    await admin.button("Runde starten");
    for (let i = 0; game.gameEngine.currentMode.questions[game.gameEngine.currentMode.currentIndex].id !== "schaetz" && i < 25; i++) {
      if (!game.gameEngine.currentMode.getState().voted) await admin.button("Auflösen");
      await admin.button("Next");
      await pause(50);
    }
    for (const [p, value] of [[alice, 0], [bob, 2], [admin, 1]]) {
      await p.input('input[type="number"]', value);
      await p.button("Absenden");
    }
    await alice.text("Richtige Antwort:");
    const screenshot = await send("Page.captureScreenshot", { format: "png" }, admin.sessionId);
    fs.writeFileSync(path.join(artifacts, "admin-smoke.png"), Buffer.from(screenshot.data, "base64"));
    await admin.button("Next");
    await admin.button("X");
    await admin.text("Spielrunde vorbereiten");
    assert.deepEqual(errors, [], "Uncaught browser errors");
    console.log("Browser smoke passed: all seven games, two players, score/reveal/voting, reconnect, role reset, no uncaught errors.");
  } finally {
    if (ws?.readyState === WebSocket.OPEN) ws.close();
    browser?.kill();
    await vite?.close();
    await game.close();
    await pause(500);
    // The resolved target is confined to this test's own artifact directory.
    if (profile.startsWith(artifacts + path.sep)) fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

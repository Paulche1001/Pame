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
  const guests = [];
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
    async function page(route, { mobile = route.startsWith("/player") } = {}) {
      const { browserContextId } = await send("Target.createBrowserContext");
      const { targetId } = await send("Target.createTarget", { url: "about:blank", browserContextId });
      const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
      await send("Runtime.enable", {}, sessionId);
      await send("Page.enable", {}, sessionId);
      await send("Emulation.setDeviceMetricsOverride", { width: mobile ? 390 : 900, height: mobile ? 844 : 1000, deviceScaleFactor: 1, mobile }, sessionId);
      await send("Page.navigate", { url: url + route }, sessionId);
      const evaluate = async expression => {
        const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true, userGesture: true }, sessionId);
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
        await send("Page.bringToFront", {}, sessionId);
        const expression = `Array.from(document.querySelectorAll('button')).find(b=>b.getClientRects().length && (b.textContent.trim()===${JSON.stringify(text)} || b.getAttribute('aria-label')===${JSON.stringify(text)}))`;
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
      await until("document.querySelector('button, a') !== null");
      return { sessionId, evaluate, until, button, input, text };
    }
    async function viewport(p, width, height) {
      await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width <= 600 }, p.sessionId);
      await pause(80);
      assert.equal(await p.evaluate("document.documentElement.scrollWidth <= window.innerWidth"), true, "Overflow at " + width + "px");
      const smallTargets = await p.evaluate(`Array.from(document.querySelectorAll('button,input,select,summary,a.btn')).filter(e=>e.getClientRects().length && getComputedStyle(e).visibility!=='hidden').filter(e=>{const r=e.getBoundingClientRect();return r.width<43.9||r.height<43.9}).map(e=>e.outerHTML.slice(0,180))`);
      assert.deepEqual(smallTargets, [], "Touch targets at " + width + "px");
    }
    async function roundLayout(p) {
      await p.until("!!document.querySelector('.game-surface')");
      for(const width of [360,390]) await viewport(p,width,800);
    }
    async function snapshot(p, name) {
      const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false }, p.sessionId);
      fs.writeFileSync(path.join(artifacts, name + ".png"), Buffer.from(shot.data, "base64"));
    }
    const admin = await page("/");
    await admin.text("Game Night mit Pame");
    assert.equal(await admin.evaluate("document.querySelector('.settings-button').textContent.trim()"), "");
    assert.equal(await admin.evaluate("document.querySelector('.settings-button').getAttribute('aria-label')"), "Einstellungen");
    assert.equal(await admin.evaluate("document.body.innerText.includes('Gute Freunde.') || document.body.innerText.includes('Zeit für einen Spieleabend')"),false);
    await admin.button("Einstellungen");
    await admin.text("Kein Raum aktiv.");
    await send("Input.dispatchKeyEvent",{type:"keyDown",key:"Escape",code:"Escape",windowsVirtualKeyCode:27},admin.sessionId);
    await admin.until("!document.querySelector('#pame-settings').open");
    for (const [width,height] of [[360,800],[390,844],[768,1024],[1024,768],[1440,1000],[390,500]]) await viewport(admin,width,height);
    await viewport(admin,390,844);
    await snapshot(admin,"home-390");
    await viewport(admin,1440,1000);
    await admin.input('input[aria-label="Raumcode"]',"ABC123");
    await send("Input.dispatchKeyEvent",{type:"keyDown",key:"Tab",code:"Tab",windowsVirtualKeyCode:9},admin.sessionId);
    const focus = await admin.evaluate("(()=>{const e=document.activeElement;const s=getComputedStyle(e);return {tag:e.tagName,outline:s.outlineStyle,width:parseFloat(s.outlineWidth)};})()");
    assert.notEqual(focus.tag,"BODY"); assert.notEqual(focus.outline,"none"); assert.ok(focus.width>=2);

    await admin.text("Raum erstellen");
    assert.equal(await admin.evaluate("document.querySelector('a[aria-label=\"Raum erstellen\"]').getAttribute('href')"), "/admin");
    await admin.evaluate("document.querySelector('a[aria-label=\"Raum erstellen\"]').click()");
    await admin.text("Eigene Spielrunde starten");
    assert.equal(await admin.evaluate("document.querySelector('form button').disabled"), true);
    await admin.until("!!document.querySelector('.back-link')");
    await admin.evaluate("document.querySelector('.back-link').click()");
    await admin.text("Game Night mit Pame");
    assert.equal(await admin.evaluate("location.pathname"), "/");
    assert.equal(await admin.evaluate("sessionStorage.getItem('pameActiveHostRoom')"), null);
    await admin.evaluate("document.querySelector('a[aria-label=\"Raum erstellen\"]').click()");
    if (process.env.SMOKE_ADMIN_TOKEN) {
      await admin.input('input[aria-label="Server-Schlüssel"]', process.env.SMOKE_ADMIN_TOKEN);
    }
    const hostName = "SpielleitungMitEinemSehrLangenNamen1234567".slice(0, 40);
    await admin.input('input[aria-label="Name der Spielleitung"]', hostName);
    await admin.button("Raum erstellen");
    await admin.until("!!document.querySelector('[data-room-code]')");
    const roomCode = await admin.evaluate("document.querySelector('[data-room-code]').textContent");
    const gameEngine = game.getRoom(roomCode).gameEngine;
    await admin.text("Was spielt ihr heute?");
    await admin.evaluate("document.querySelector('.brand').click()");
    assert.equal(await admin.evaluate("location.pathname"),"/admin");
    await admin.text("Was spielt ihr heute?");
    assert.equal(await admin.evaluate("document.body.innerText.includes('Euer Spieleabend') || document.body.innerText.includes('Wähle ein Spiel.')"),false);
    const alice = await page("/player?room=" + roomCode);
    const bob = await page("/", { mobile: true });
    await bob.input('input[placeholder="Dein Name"]', "Bob");
    let missing = "ABC123";
    if(game.getRoom(missing)) missing="XYZ789";
    await bob.input('input[aria-label="Raumcode"]', missing);
    await bob.button("Beitreten");
    await bob.until("!!document.querySelector('[role=alert]')");
    assert.equal(await bob.evaluate('document.querySelector(\'input[placeholder="Dein Name"]\').value'),"Bob");
    assert.equal(await bob.evaluate('document.querySelector(\'input[aria-label="Raumcode"]\').value'),missing);
    await bob.input('input[aria-label="Raumcode"]', roomCode);
    for (const [p, name] of [[alice, "Alice"], [bob, "Bob"]]) {
      await p.input('input[placeholder="Dein Name"]', name);
      await p.button("Beitreten");
      await p.text(`Du bist dabei, ${name}!`);
    }
    await admin.text("2 Spieler online");
    console.log("Browser smoke: two players joined.");
    assert.equal(await alice.evaluate("document.querySelector('.app-content .room-banner')"),null);
    await alice.button("Einstellungen");
    await alice.until("document.querySelector('#pame-settings').open");
    assert.equal(await alice.evaluate("document.querySelector('.room-settings [data-room-code]').textContent"),roomCode);
    assert.equal(await alice.evaluate("document.querySelector('.settings-key')"),null);
    assert.equal(await alice.evaluate("document.querySelector('.settings-empty').getClientRects().length"),0);
    await viewport(alice,360,500);
    await snapshot(alice,"settings-player-360");
    await alice.evaluate("document.querySelector('[aria-label=\"Einstellungen schließen\"]').click()");
    await alice.until("!document.querySelector('#pame-settings').open");
    await admin.button("Einstellungen");
    await viewport(admin,390,500);
    await snapshot(admin,"settings-host-390");
    await admin.evaluate("document.querySelector('[aria-label=\"Einstellungen schließen\"]').click()");
    await viewport(admin,1440,1000);
    await admin.button("Einladen");
    await admin.text("Link kopiert");
    const inviteHref = await admin.evaluate("document.querySelector('.settings-invite-link').getAttribute('href')");
    assert.equal(inviteHref, "/player?room=" + roomCode);
    for (let i = 0; i < 18; i++) {
      const guest = frontendRequire("socket.io-client").io(process.env.VITE_SERVER_URL, { forceNew: true });
      guests.push(guest);
      await new Promise((resolve, reject) => { guest.once("connect", resolve); guest.once("connect_error", reject); });
      await new Promise((resolve, reject) => guest.emit("player_join", { roomCode, playerId: "layout-" + i, playerToken: "layout-token-for-responsive-test-" + i, name: i === 0 ? "SehrLangerSpielernameOhneLeerzeichen1234567".slice(0,40) : "Gast " + i }, response => response.success ? resolve() : reject(Error(response.message))));
    }
    await admin.text("20 Spieler online");
    for (const [width, height] of [[360,800],[390,844],[768,1024],[1024,768],[1440,1000]]) {
      await viewport(admin,width,height);
      const layout = await admin.evaluate("(()=>{const a=document.querySelector('.player-panel').getBoundingClientRect(),b=document.querySelector('.game-grid').getBoundingClientRect(),c=document.querySelector('.player-chips').getBoundingClientRect();return {side:b.right<=a.left,height:c.height,columns:getComputedStyle(document.querySelector('.game-grid')).gridTemplateColumns.split(' ').length};})()");
      assert.equal(layout.side, width > 800, "Lobby columns at " + width);
      if(width <= 600) { assert.equal(layout.columns, 2); assert.ok(layout.height <= 127); }
      if(width===390||width===1440) await snapshot(admin,"lobby-"+width);
    }
    await admin.evaluate("document.querySelector('.player-management').open=true");
    await viewport(admin,390,844);
    await admin.evaluate("document.querySelector('.player-management').open=false");
    await viewport(admin,320,640);
    assert.equal(await admin.evaluate("getComputedStyle(document.querySelector('.game-grid')).gridTemplateColumns.split(' ').length"),1);
    await viewport(admin,390,500);
    for(const guest of guests) {
      await new Promise(resolve=>guest.emit("player_leave",{playerId:"layout-"+guests.indexOf(guest)},resolve));
      guest.disconnect();
    }
    await admin.text("2 Spieler online");
    const {games}=await vite.ssrLoadModule("/src/lib/games.js");
    const luminance = hex => {
      const rgb=hex.match(/[a-f0-9]{2}/gi).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
      return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
    };
    const contrast = (a,b) => { const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05); };
    for(const color of ["#FF3B9D",...games.map(game=>game.color)]) assert.ok(contrast(color,"#191022")>=4.5,"Button text contrast: "+color);
    assert.ok(contrast("#B9AEC9","#21192F")>=4.5,"Card text contrast");
    await viewport(admin,1440,1000);
    await viewport(alice,360,800);
    await snapshot(alice,"player-lobby-360");


    const adminB = await page("/admin");
    if (process.env.SMOKE_ADMIN_TOKEN) await adminB.input('input[aria-label="Server-Schlüssel"]', process.env.SMOKE_ADMIN_TOKEN);
    await adminB.input('input[aria-label="Name der Spielleitung"]', "Host B");
    await adminB.button("Raum erstellen");
    await adminB.until("!!document.querySelector('[data-room-code]')");
    const roomCodeB = await adminB.evaluate("document.querySelector('[data-room-code]').textContent");
    assert.notEqual(roomCodeB, roomCode);
    const playerB = await page("/player?room=" + roomCodeB);
    await playerB.input('input[placeholder="Dein Name"]', "Alice");
    await playerB.button("Beitreten");
    await playerB.text("Du bist dabei, Alice!");
    await adminB.text("1 Spieler online");
    await adminB.evaluate("Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('Testmodus')).click()");
    await adminB.button("Spiel starten");
    await playerB.input("input", "Nur Raum B");
    await playerB.evaluate("document.querySelector('input').parentElement.querySelector('button').click()");
    await playerB.text("Nur Raum B");
    assert.equal(await alice.evaluate("document.body.innerText.includes('Nur Raum B')"), false);
    await admin.text("2 Spieler online");
    console.log("Browser smoke: second group is isolated.");
    async function lobby() { await admin.button("Verlassen"); await admin.text("Was spielt ihr heute?"); }
    async function mode(label) {
      const expression = `Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes(${JSON.stringify(label)}))`;
      await admin.until(`!!(${expression}) && !(${expression}).disabled`);
      const before = gameEngine.currentMode;
      await admin.evaluate(`(${expression}).click()`);
      await admin.until("!!document.querySelector('dialog[open]')");
      assert.equal(gameEngine.currentMode,before,"Selecting a card must not start the game");
      for(const [width,height] of [[360,800],[390,500],[768,1024],[1024,768]]) {
        await viewport(admin,width,height);
        assert.equal(await admin.evaluate("document.querySelector('.setup-dialog').contains(document.activeElement)"),true,"Modal keeps keyboard focus");
        const bounds=await admin.evaluate("(()=>{const a=document.querySelector('.setup-dialog__actions').getBoundingClientRect();return a.top>=0&&a.bottom<=window.innerHeight;})()");
        assert.equal(bounds,true,"Dialog actions fit the available height");
      }
      await snapshot(admin,"selection-"+label.replace(/[^a-zA-Z]/g,""));
      await viewport(admin,1440,1000);
    }

    await mode("Schätzfragen");
    await admin.input('input[type="number"]', 1);
    await admin.button("Spiel starten");
    await alice.until("!!document.querySelector('input[type=number]')");
    assert.equal(await admin.evaluate("document.querySelector('.app-content .room-banner')"),null);
    const runningMode=gameEngine.currentMode;
    await admin.evaluate("document.querySelector('.brand').click()");
    assert.equal(await admin.evaluate("location.pathname"),"/admin");
    assert.equal(gameEngine.currentMode,runningMode);
    await admin.button("Einstellungen");
    await admin.text("Raum verlassen");
    assert.equal(await admin.evaluate("document.querySelector('.room-settings [data-room-code]').textContent"),roomCode);
    await admin.evaluate("Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })");
    await admin.button("Einladen");
    await admin.text("Link kopiert");
    await admin.evaluate("document.querySelector('[aria-label=\"Einstellungen schließen\"]').click()");
    await admin.evaluate("delete navigator.clipboard");
    assert.equal(gameEngine.currentMode,runningMode);
    const savedQuestion=gameEngine.currentMode.questions[0];
    gameEngine.currentMode.questions[0]={...savedQuestion,question:"Wie viele gemeinsame Spielmomente passen in einen Abend mit euren Freunden? ".repeat(5)};
    gameEngine.currentMode.sendState();
    await alice.text("Wie viele gemeinsame Spielmomente");
    for (const [width,height] of [[360,800],[390,500],[768,1024],[1024,768],[1440,1000]]) {
      await viewport(alice,width,height);
      await viewport(admin,width,height);
    }
    await viewport(alice,390,844);
    await snapshot(alice,"estimate-player-390");
    await viewport(admin,1440,1000);
    await snapshot(admin,"estimate-host-1440");
    gameEngine.currentMode.questions[0]=savedQuestion;
    gameEngine.currentMode.sendState();
    await alice.input('input[type="number"]', 0);
    await alice.button("Antwort abgeben");
    await alice.until("document.querySelector('button') && Array.from(document.querySelectorAll('button')).some(b=>b.textContent.trim()==='Antwort gesendet' && b.disabled)");
    await send("Page.reload", {}, alice.sessionId);
    await alice.until("document.querySelector('input[type=number]')?.value === '0'");
    await admin.button("Antworten aufdecken");
    await alice.text("Richtige Antwort:");
    await admin.button("Rangliste");
    await alice.text("Rangliste");
    await admin.button("Schließen");
    await alice.text("Richtige Antwort:");
    await admin.button("Nächste Frage");
    await admin.text("Punktestand");
    await admin.button("Lobby");

    console.log("Browser smoke: estimate and reload passed.");

    await mode("Pixelraten");
    await admin.button("Spiel starten");
    await roundLayout(alice);
    await roundLayout(admin);
    await alice.button("BUZZ!");
    await admin.text("Alice hat gebuzzert!");
    await admin.button("✔ Richtig");
    await admin.button("Nächstes Bild");
    await lobby();

    console.log("Browser smoke: pixel passed.");

    await mode("Who Is?");
    await admin.input('input[type="number"]', 1);
    await admin.button("Spiel starten");
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
    await admin.button("Spiel starten");
    for (const [p, value] of [[alice, "Fake Alice"], [bob, "Fake Bob"]]) {
      await p.input("input", value);
      await p.button("Abschicken");
    }
    await roundLayout(admin);
    await roundLayout(alice);
    await admin.button("Abstimmung starten");
    const correct = gameEngine.currentMode.questions[0].answer;
    await alice.button(correct.toUpperCase());
    await admin.evaluate(`Array.from(document.querySelectorAll('button[data-answer-option]')).find(d=>d.textContent.includes(${JSON.stringify(correct)})).click()`);
    await alice.text("✔ Richtige Antwort");
    await admin.button("Nächste Frage");
    await alice.until("document.querySelector('input')?.value === ''");
    await lobby();

    console.log("Browser smoke: WhatIs passed.");

    await mode("Stadt–Land–Fluss");
    await admin.input('input[type="number"]', 1);
    await admin.button("Spiel starten");
    await roundLayout(admin);
    await roundLayout(alice);
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
    await admin.text(hostName);
    assert.equal(await admin.evaluate("document.querySelector('.setup-dialog input[type=text]')"), null);
    await admin.button("Spiel starten");
    await alice.until("!!document.querySelector('.round-content summary')");
    await alice.evaluate("document.querySelector('.round-content summary').click()");
    await alice.text(gameEngine.currentMode.imposters.has("Alice") ? "Du bist Imposter" : "Du bist Crewmate");
    await admin.button("Abstimmung");
    await alice.until("!!document.querySelector('input[type=radio]')");
    await roundLayout(admin);
    await roundLayout(alice);
    const target = [...gameEngine.currentMode.imposters][0];
    for (const p of [alice, bob]) {
      await p.until("document.querySelector('input[type=radio]') !== null");
      await p.evaluate(`Array.from(document.querySelectorAll('li')).find(li=>li.textContent.includes(${JSON.stringify(target === (p === alice ? "Alice" : "Bob") ? "Du" : target)})).querySelector('input').click()`);
    }
    await admin.button("Abstimmung auswerten");
    await alice.text("Crewmate");
    await admin.button("Nächste Runde");
    await alice.until("!!document.querySelector('.round-content details') && !document.querySelector('.round-content details').open");
    await admin.button("Verlassen");
    await admin.text("Was spielt ihr heute?");

    await send("Page.reload", {}, admin.sessionId);
    await admin.text("Was spielt ihr heute?");
    await mode("DrinkGame");
    await admin.text(hostName);
    assert.equal(await admin.evaluate("document.querySelector('.setup-dialog input[type=text]')"), null);
    await admin.button("Spiel starten");
    await admin.until("!!document.querySelector('.drink-round')");
    assert.equal(gameEngine.currentMode.adminName, hostName);
    const drinkMode = gameEngine.currentMode;
    const voteQuestion = drinkMode.questions.find(question => question.id === "werwuerde");
    const estimateQuestion = drinkMode.questions.find(question => question.id === "schaetz");
    assert.ok(voteQuestion && estimateQuestion);
    drinkMode.questions = [voteQuestion, estimateQuestion, ...drinkMode.questions.filter(question => question !== voteQuestion && question !== estimateQuestion)];
    drinkMode.currentIndex = 0;
    drinkMode.selectedPlayers.clear();
    drinkMode.playerEstimates.clear();
    drinkMode.reveal = false;
    drinkMode.prepareQuestion();
    drinkMode.sendState();
    for (const p of [admin, alice]) {
      await p.until("!!document.querySelector('.drink-choice')");
      await roundLayout(p);
      assert.equal(await p.evaluate("document.querySelector('.drink-choice__dot').getBoundingClientRect().width"), 20);
      const rows = await p.evaluate("Array.from(document.querySelectorAll('.drink-choice')).map(e=>{const r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:r.height};})");
      assert.ok(rows.every((row, index) => row.height >= 44 && (index === 0 || row.top >= rows[index - 1].bottom)), "Voting rows stay separate with long names");
    }
    await snapshot(admin, "drinking-vote-host-390");
    await snapshot(alice, "drinking-vote-player-390");
    for (const p of [alice, bob, admin]) {
      await p.until("!!document.querySelector('.drink-choice')");
      await p.evaluate("Array.from(document.querySelectorAll('.drink-choice')).find(e=>e.querySelector('.drink-choice__name').textContent==='Bob').click()");
    }
    await admin.text("Bob muss");
    await alice.text("Bob muss");
    await roundLayout(admin);
    await roundLayout(alice);
    await snapshot(admin, "drinking-result-host-390");
    await snapshot(alice, "drinking-result-player-390");
    await admin.button("Nächste Aufgabe");
    for (let i = 0; gameEngine.currentMode.questions[gameEngine.currentMode.currentIndex].id !== "schaetz" && i < 25; i++) {
      if (!gameEngine.currentMode.getState().voted) await admin.button("Auflösen");
      await admin.button("Nächste Aufgabe");
      await pause(50);
    }
    for (const [p, value] of [[alice, 0], [bob, 2], [admin, 1]]) {
      await p.input('input[type="number"]', value);
      await p.button("Absenden");
    }
    await alice.until("document.querySelector('.drink-result')?.textContent.includes('Richtige Antwort:')");
    await roundLayout(admin);
    await roundLayout(alice);
    const screenshot = await send("Page.captureScreenshot", { format: "png" }, admin.sessionId);
    fs.writeFileSync(path.join(artifacts, "admin-smoke.png"), Buffer.from(screenshot.data, "base64"));
    await admin.button("Nächste Aufgabe");
    await admin.button("Verlassen");
    await admin.text("Was spielt ihr heute?");

    const playerIdentity = await alice.evaluate("localStorage.getItem('playerId')");
    await alice.button("Einstellungen");
    await alice.button("Raum verlassen");
    await alice.input('input[aria-label="Raumcode"]', roomCodeB);
    await alice.input('input[placeholder="Dein Name"]', "Dana");
    await alice.button("Beitreten");
    await alice.text("Nur Raum B");
    assert.equal(await alice.evaluate("localStorage.getItem('playerId')"), playerIdentity);
    assert.equal(game.getRoom(roomCodeB).players.size, 2);
    assert.equal(game.getRoom(roomCode).players.size, 1);
    await admin.button("Einstellungen");
    await admin.button("Raum verlassen");
    await admin.text("Eigene Spielrunde starten");
    await admin.evaluate("Array.from(document.querySelectorAll('summary')).find(s=>s.textContent.includes('Bestehenden Raum')).click()");
    await admin.input('input[aria-label="Raumcode"]', roomCode);
    await admin.button("Raum öffnen");
    await admin.text("Was spielt ihr heute?");
    assert.equal(await admin.evaluate("document.querySelector('[data-room-code]').textContent"), roomCode);
    assert.deepEqual(errors, [], "Uncaught browser errors");
    console.log("Browser smoke passed: all seven games, two isolated groups, manual room code, room switch, host resume, reconnect, no uncaught errors.");
  } finally {
    guests.forEach(guest=>guest.disconnect());
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

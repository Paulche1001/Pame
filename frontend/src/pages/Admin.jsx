import { useState, useEffect, useCallback } from "react";
import { io } from "socket.io-client";
import { serverUrl } from "../lib/connection";
import { leaderboard } from "../lib/ranking";

// Gamescreens
import EstimateAdmin from "./EstimateAdmin";
import PixelAdmin from "./PixelAdmin";
import WhoIsAdmin from "./WhoIsAdmin";
import WhatIsAdmin from "./WhatIsAdmin";
import EndAdmin from "./EndAdmin";
import SLFAdmin from "./SLFAdmin";
import TestAdmin from "./TestAdmin";
import ImposterAdmin from "./ImposterAdmin";
import DrinkingAdmin from "./DrinkingAdmin";

export default function Admin() {
  const [socket] = useState(() => io(serverUrl(), { autoConnect: false }));
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [adminToken, setAdminToken] = useState("");
  const [players, setPlayers] = useState([]);
  const [gameState, setGameState] = useState(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [timer, setTimer] = useState(null);

  const [modeSetup, setModeSetup] = useState(null);

  const [questionCount, setQuestionCount] = useState(5);
  const [whoisVariant, setWhoisVariant] = useState("whois_emojis");

  const [estimateSet, setEstimateSet] = useState("classic");
  const [estimateCount, setEstimateCount] = useState(10);

  const [slfCats, setSlfCats] = useState(["Stadt","Land","Fluss"]);
  const [slfCatInput, setSlfCatInput] = useState("");
  const [slfRounds, setSlfRounds] = useState(5);

  const [imposterCount, setImposterCount] = useState(1);
  const [schlueckeCount, setSchlueckeCount] = useState(2);
  const [adminName, setAdminName] = useState(null);

  const authenticate = useCallback((token) => {
    socket.timeout(5000).emit("admin_join", { token }, (err, response) => {
      if (err || !response?.success) {
        setAuthorized(false);
        setAuthRequired(true);
        if (token || err) setError(response?.message || "Anmeldung fehlgeschlagen. Bitte erneut versuchen.");
        sessionStorage.removeItem("pameAdminToken");
        return;
      }
      if (token) sessionStorage.setItem("pameAdminToken", token);
      setAuthorized(true);
      setAdminToken("");
      setError("");
    });
  }, [socket]);

  const toggleLeaderboard = (state) => {
    setShowLeaderboard(state);
    socket.emit("admin_toggle_leaderboard", state);
  };

  useEffect(() => {
    socket.on("connect", () => {
      setConnected(true);
      setError("");
      authenticate(sessionStorage.getItem("pameAdminToken") || "");
    });
    socket.on("disconnect", () => { setConnected(false); setAuthorized(false); });
    socket.on("admin_auth_required", setAuthRequired);
    socket.on("connect_error", () => setError("Keine Verbindung zum Spielserver. Verbindung wird erneut versucht …"));
    socket.on("action_error", setError);
    socket.on("leaderboard_toggle", setShowLeaderboard);

    socket.on("players_update", (list) => {
      setPlayers(list);
      setGameState((gs) =>
        gs ? { ...gs, players: list } : gs
      );
    });

    socket.on("admin_state", (state) => {
      setGameState(state);
    });
    socket.on("timer_update", setTimer);
    socket.on("timer_done", () => setTimer(null));
    socket.connect();
    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [socket, authenticate]);

  if (connected && authRequired && !authorized) {
    return (
      <form className="flex flex-col gap-4 p-6" onSubmit={event => { event.preventDefault(); setError(""); authenticate(adminToken); }}>
        <h2 className="text-2xl font-bold">Spielleitung anmelden</h2>
        <p>Gib den Admin-Schlüssel dieses Spielservers ein.</p>
        {error && <p role="alert" className="text-red-300">{error}</p>}
        <label className="flex flex-col gap-2">
          Admin-Schlüssel
          <input type="password" autoComplete="current-password" value={adminToken} onChange={event => setAdminToken(event.target.value)} className="rounded-lg bg-gray-800 p-3" />
        </label>
        <button disabled={!adminToken} className="rounded-lg bg-pink-600 p-3 font-bold">Anmelden</button>
      </form>
    );
  }

  if (!connected && gameState) return <p role="status" className="p-6">Verbindung unterbrochen – verbinde erneut …</p>;

  // LOBBY: Vor Spielstart
  if (!gameState || gameState.screen === "lobby") {
    return (
      <div className="min-h-screen w-full bg-linear-to-br from-slate-950 via-slate-900 to-indigo-950 px-4 py-8 text-white sm:px-6 lg:px-8">
        {error && <p role="alert" className="mb-4 text-red-300">{error}</p>}
        {!connected && <p role="status" className="mb-4 text-amber-300">Verbindung zum Spielserver wird hergestellt …</p>}
        <div className="mx-auto w-full max-w-6xl">
          <header className="mb-8 text-left">
            <span className="inline-flex items-center rounded-full border border-indigo-400/20 bg-indigo-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-indigo-200">
              Admin Lobby
            </span>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
                  Spielrunde vorbereiten
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">
                  Behalte alle verbundenen Spieler im Blick und starte anschließend den passenden Spielmodus.
                </p>
              </div>

              <div className="inline-flex w-fit items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 shadow-lg shadow-black/10 backdrop-blur">
                <span className="relative flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-400" />
                </span>
                <span className="text-sm font-semibold text-slate-200">
                  {players.length} {players.length === 1 ? "Spieler" : "Spieler"} online
                </span>
              </div>
            </div>
          </header>

          <fieldset disabled={!connected || !authorized} className="flex flex-col gap-6">
            <section className="rounded-3xl border border-white/10 bg-white/6 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-6">
              <div className="mb-5 flex items-center justify-between">
                <div className="text-left">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                    Lobby
                  </p>
                  <h2 className="mt-1 text-xl font-bold">Verbundene Spieler</h2>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-400/10 text-xl">
                  👥
                </div>
              </div>

              {players.length === 0 ? (
                <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-black/10 px-6 text-center">
                  <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-white/5 text-2xl">
                    ⏳
                  </div>
                  <h3 className="font-semibold text-slate-200">Noch niemand da</h3>
                  <p className="mt-2 max-w-xs text-sm leading-6 text-slate-500">
                    Sobald sich Spieler verbinden, erscheinen sie automatisch in dieser Liste.
                  </p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {players.map((p, index) => (
                    <li
                      key={p.id}
                      className="group flex items-center justify-between rounded-2xl border border-white/5 bg-black/10 p-3 transition hover:border-white/10 hover:bg-white/6"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-indigo-500 to-fuchsia-500 text-sm font-black shadow-lg shadow-indigo-950/40">
                          {String(p.name || index + 1).charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 text-left">
                          <p className="truncate font-semibold text-slate-100">{p.name}</p>
                          <p className="text-xs text-emerald-400">Verbunden</p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => socket.emit("admin_delete_player", p.id)}
                        className="ml-3 rounded-xl border border-transparent px-3 py-2 text-sm font-semibold text-slate-500 transition hover:border-red-400/20 hover:bg-red-400/10 hover:text-red-300 focus:outline-none focus:ring-2 focus:ring-red-400/40"
                        aria-label={`${p.name} entfernen`}
                        title="Spieler entfernen"
                      >
                        Entfernen
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/6 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-6">
              <div className="mb-5 flex items-center justify-between text-left">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                    Spielauswahl
                  </p>
                  <h2 className="mt-1 text-xl font-bold">Was möchtet ihr spielen?</h2>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-400/10 text-xl">
                  🎮
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <button
                  type="button"
                  onClick={() => {
                    setModeSetup({ base: "estimate" });
                    setEstimateSet("classic");
                    setEstimateCount(10);
                  }}
                  className="group rounded-2xl border border-white/10 bg-linear-to-br from-blue-500/15 to-cyan-400/5 p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:border-blue-400/30 hover:bg-blue-500/20 focus:outline-none focus:ring-2 focus:ring-blue-400/50"
                >
                  <span className="text-2xl">📊</span>
                  <span className="mt-4 block font-bold">Schätzfragen</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-400">Wer liegt mit seiner Einschätzung am nächsten?</span>
                </button>

                <button
                  type="button"
                  onClick={() => socket.emit("admin_select_mode", "pixel")}
                  className="group rounded-2xl border border-white/10 bg-linear-to-br from-violet-500/15 to-purple-400/5 p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:border-violet-400/30 hover:bg-violet-500/20 focus:outline-none focus:ring-2 focus:ring-violet-400/50"
                >
                  <span className="text-2xl">🟪</span>
                  <span className="mt-4 block font-bold">Pixelraten</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-400">Erratet Motive anhand verpixelter Bilder.</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setModeSetup({ base: "whois" });
                    setWhoisVariant("whois_emojis");
                    setQuestionCount(5);
                  }}
                  className="group rounded-2xl border border-white/10 bg-linear-to-br from-fuchsia-500/15 to-pink-400/5 p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:border-fuchsia-400/30 hover:bg-fuchsia-500/20 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/50"
                >
                  <span className="text-2xl">🕵️</span>
                  <span className="mt-4 block font-bold">Who Is?</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-400">Findet heraus, welche Person gemeint ist.</span>
                </button>

                <button
                  type="button"
                  onClick={() => socket.emit("admin_select_mode", "whatis")}
                  className="group rounded-2xl border border-white/10 bg-linear-to-br from-amber-500/15 to-orange-400/5 p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:border-amber-400/30 hover:bg-amber-500/20 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                >
                  <span className="text-2xl">💡</span>
                  <span className="mt-4 block font-bold">What Is?</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-400">Begriffe erkennen, kombinieren und richtig raten.</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setModeSetup({ base: "slf" });
                    setSlfCats(["Stadt", "Land", "Fluss"]);
                    setSlfCatInput("");
                    setSlfRounds(5);
                  }}
                  className="group rounded-2xl border border-white/10 bg-linear-to-br from-emerald-500/15 to-teal-400/5 p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:border-emerald-400/30 hover:bg-emerald-500/20 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                >
                  <span className="text-2xl">🌍</span>
                  <span className="mt-4 block font-bold">Stadt–Land–Fluss</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-400">Der Klassiker mit euren eigenen Kategorien.</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setModeSetup({ base: "imposter" });
                    setImposterCount(1);
                    setAdminName("");
                  }}
                  className="group rounded-2xl border border-white/10 bg-linear-to-br from-red-500/15 to-rose-400/5 p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:border-red-400/30 hover:bg-red-500/20 focus:outline-none focus:ring-2 focus:ring-red-400/50"
                >
                  <span className="text-2xl">🎭</span>
                  <span className="mt-4 block font-bold">Imposter</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-400">Entlarvt die Person ohne das geheime Wort.</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setModeSetup({ base: "drinking" });
                    setAdminName("");
                  }}
                  className="group rounded-2xl border border-white/10 bg-linear-to-br from-pink-500/15 to-orange-400/5 p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:border-pink-400/30 hover:bg-pink-500/20 focus:outline-none focus:ring-2 focus:ring-pink-400/50"
                >
                  <span className="text-2xl">🍹</span>
                  <span className="mt-4 block font-bold">DrinkGame</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-400">Lockere Aufgaben für eure gemeinsame Runde.</span>
                </button>

                <button
                  type="button"
                  onClick={() => socket.emit("admin_select_mode", "test")}
                  className="group rounded-2xl border border-dashed border-white/10 bg-white/3 p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.07] focus:outline-none focus:ring-2 focus:ring-white/30"
                >
                  <span className="text-2xl">🧪</span>
                  <span className="mt-4 block font-bold">Testmodus</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-400">Interner Modus zum schnellen Ausprobieren.</span>
                </button>
              </div>
            </section>
          </fieldset>
        </div>

        {/* Who Is Setup */}
        {modeSetup?.base === "whois" && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
            onClick={() => setModeSetup(null)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="whois-title"
              className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900 p-6 text-left shadow-2xl shadow-black/50 sm:p-7"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-6">
                <span className="text-3xl">🕵️</span>
                <h3 id="whois-title" className="mt-3 text-2xl font-black">Who Is? einrichten</h3>
                <p className="mt-1 text-sm text-slate-400">Wähle Variante und Umfang der Runde.</p>
              </div>

              <div className="space-y-4">
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-300">Spielvariante</span>
                  <select
                    value={whoisVariant}
                    onChange={(e) => setWhoisVariant(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none transition focus:border-fuchsia-400/50 focus:ring-2 focus:ring-fuchsia-400/20"
                  >
                    <option value="whois_emojis">Who Is? – Emojis</option>
                    <option value="guessthebeer">Guess The Beer 🍺</option>
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-300">Anzahl der Fragen</span>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={questionCount}
                    onChange={(e) => setQuestionCount(Number(e.target.value))}
                    className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none transition focus:border-fuchsia-400/50 focus:ring-2 focus:ring-fuchsia-400/20"
                  />
                </label>
              </div>

              <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setModeSetup(null)} className="rounded-xl px-5 py-3 font-semibold text-slate-400 transition hover:bg-white/5 hover:text-white">Abbrechen</button>
                <button
                  type="button"
                  onClick={() => {
                    socket.emit("admin_select_mode", { modeName: whoisVariant, options: { questionCount } });
                    setModeSetup(null);
                  }}
                  className="rounded-xl bg-linear-to-r from-fuchsia-500 to-pink-500 px-5 py-3 font-bold text-white shadow-lg shadow-fuchsia-950/40 transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/60"
                >
                  Runde starten
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Stadt-Land-Fluss Setup */}
        {modeSetup?.base === "slf" && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm" onClick={() => setModeSetup(null)}>
            <div role="dialog" aria-modal="true" aria-labelledby="slf-title" className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-white/10 bg-slate-900 p-6 text-left shadow-2xl shadow-black/50 sm:p-7" onClick={(e) => e.stopPropagation()}>
              <div className="mb-6">
                <span className="text-3xl">🌍</span>
                <h3 id="slf-title" className="mt-3 text-2xl font-black">Stadt–Land–Fluss</h3>
                <p className="mt-1 text-sm text-slate-400">Stelle eure Kategorien und die Rundenzahl zusammen.</p>
              </div>

              <div className="flex gap-2">
                <input
                  value={slfCatInput}
                  onChange={(e) => setSlfCatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    const c = slfCatInput.trim();
                    if (!c || slfCats.some((x) => x.toLowerCase() === c.toLowerCase())) return;
                    setSlfCats([...slfCats, c]);
                    setSlfCatInput("");
                  }}
                  className="min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-emerald-400/50 focus:ring-2 focus:ring-emerald-400/20"
                  placeholder="Neue Kategorie"
                />
                <button
                  type="button"
                  className="rounded-xl bg-emerald-500 px-4 py-3 font-black text-slate-950 transition hover:bg-emerald-400"
                  onClick={() => {
                    const c = slfCatInput.trim();
                    if (!c || slfCats.some((x) => x.toLowerCase() === c.toLowerCase())) return;
                    setSlfCats([...slfCats, c]);
                    setSlfCatInput("");
                  }}
                  aria-label="Kategorie hinzufügen"
                >
                  +
                </button>
              </div>

              <div className="mt-4 rounded-2xl border border-white/5 bg-slate-950/50 p-3">
                {slfCats.length === 0 ? (
                  <p className="py-4 text-center text-sm text-slate-500">Füge mindestens eine Kategorie hinzu.</p>
                ) : (
                  <ul className="flex flex-wrap gap-2">
                    {slfCats.map((c) => (
                      <li key={c} className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 py-1.5 pl-3 pr-1.5 text-sm text-emerald-100">
                        <span>{c}</span>
                        <button type="button" className="flex h-6 w-6 items-center justify-center rounded-full text-emerald-300 transition hover:bg-red-400/20 hover:text-red-300" onClick={() => setSlfCats(slfCats.filter((x) => x !== c))} aria-label={`${c} entfernen`}>×</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <label className="mt-4 block">
                <span className="mb-2 block text-sm font-semibold text-slate-300">Anzahl der Runden</span>
                <input type="number" min={1} max={20} value={slfRounds} onChange={(e) => setSlfRounds(Number(e.target.value))} className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none transition focus:border-emerald-400/50 focus:ring-2 focus:ring-emerald-400/20" />
              </label>

              <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setModeSetup(null)} className="rounded-xl px-5 py-3 font-semibold text-slate-400 transition hover:bg-white/5 hover:text-white">Abbrechen</button>
                <button
                  type="button"
                  disabled={slfCats.length === 0}
                  onClick={() => {
                    socket.emit("admin_select_mode", { modeName: "slf", options: { categories: slfCats, rounds: slfRounds, graceSeconds: 5 } });
                    setModeSetup(null);
                  }}
                  className="rounded-xl bg-linear-to-r from-emerald-500 to-teal-400 px-5 py-3 font-bold text-slate-950 shadow-lg shadow-emerald-950/30 transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-emerald-400/60 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Runde starten
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Imposter Setup */}
        {modeSetup?.base === "imposter" && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm" onClick={() => setModeSetup(null)}>
            <div role="dialog" aria-modal="true" aria-labelledby="imposter-title" className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900 p-6 text-left shadow-2xl shadow-black/50 sm:p-7" onClick={(e) => e.stopPropagation()}>
              <div className="mb-6">
                <span className="text-3xl">🎭</span>
                <h3 id="imposter-title" className="mt-3 text-2xl font-black">Imposter einrichten</h3>
                <p className="mt-1 text-sm text-slate-400">Lege Spielleitung und Anzahl der Imposter fest.</p>
              </div>

              <div className="space-y-4">
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-300">Name der Spielleitung</span>
                  <input type="text" value={adminName || ""} onChange={(e) => setAdminName(e.target.value)} className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-red-400/50 focus:ring-2 focus:ring-red-400/20" placeholder="Zum Beispiel Alex" />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-300">Anzahl der Imposter</span>
                  <input
                    type="number"
                    min={1}
                    max={Math.max(1, Math.floor(players.length / 2))}
                    value={imposterCount}
                    onChange={(e) => setImposterCount(Math.min(Math.max(1, Math.floor(players.length / 2)), Math.max(1, Number(e.target.value))))}
                    className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none transition focus:border-red-400/50 focus:ring-2 focus:ring-red-400/20"
                  />
                  <span className="mt-2 block text-xs text-slate-500">Maximal die Hälfte der verbundenen Spieler.</span>
                </label>
              </div>

              <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setModeSetup(null)} className="rounded-xl px-5 py-3 font-semibold text-slate-400 transition hover:bg-white/5 hover:text-white">Abbrechen</button>
                <button
                  type="button"
                  disabled={players.length < 2 || !String(adminName || "").trim()}
                  onClick={() => {
                    socket.emit("admin_select_mode", { modeName: "imposter", options: { imposterCount, adminName: String(adminName).trim() } });
                    setModeSetup(null);
                  }}
                  className="rounded-xl bg-linear-to-r from-red-500 to-rose-500 px-5 py-3 font-bold text-white shadow-lg shadow-red-950/30 transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-red-400/60 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Runde starten
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Schätzfragen Setup */}
        {modeSetup?.base === "estimate" && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm" onClick={() => setModeSetup(null)}>
            <div role="dialog" aria-modal="true" aria-labelledby="estimate-title" className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900 p-6 text-left shadow-2xl shadow-black/50 sm:p-7" onClick={(e) => e.stopPropagation()}>
              <div className="mb-6">
                <span className="text-3xl">📊</span>
                <h3 id="estimate-title" className="mt-3 text-2xl font-black">Schätzfragen einrichten</h3>
                <p className="mt-1 text-sm text-slate-400">Wähle ein Fragenset und die gewünschte Länge.</p>
              </div>

              <div className="space-y-4">
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-300">Fragenset</span>
                  <select value={estimateSet} onChange={(e) => setEstimateSet(e.target.value)} className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none transition focus:border-blue-400/50 focus:ring-2 focus:ring-blue-400/20">
                    <option value="classic">Classic</option>
                    <option value="traben_trabach">Traben-Trarbach</option>
                    <option value="eigene">Selbst erstellt</option>
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-300">Anzahl der Fragen</span>
                  <input type="number" min={1} max={50} value={estimateCount} onChange={(e) => setEstimateCount(Number(e.target.value))} className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none transition focus:border-blue-400/50 focus:ring-2 focus:ring-blue-400/20" />
                </label>
              </div>

              <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setModeSetup(null)} className="rounded-xl px-5 py-3 font-semibold text-slate-400 transition hover:bg-white/5 hover:text-white">Abbrechen</button>
                <button type="button" onClick={() => { socket.emit("admin_select_mode", { modeName: "estimate", options: { questionCount: estimateCount, setKey: estimateSet } }); setModeSetup(null); }} className="rounded-xl bg-linear-to-r from-blue-500 to-cyan-400 px-5 py-3 font-bold text-white shadow-lg shadow-blue-950/30 transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-blue-400/60">Runde starten</button>
              </div>
            </div>
          </div>
        )}

        {/* DrinkGame Setup */}
        {modeSetup?.base === "drinking" && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm" onClick={() => setModeSetup(null)}>
            <div role="dialog" aria-modal="true" aria-labelledby="drinking-title" className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900 p-6 text-left shadow-2xl shadow-black/50 sm:p-7" onClick={(e) => e.stopPropagation()}>
              <div className="mb-6">
                <span className="text-3xl">🍹</span>
                <h3 id="drinking-title" className="mt-3 text-2xl font-black">DrinkGame einrichten</h3>
                <p className="mt-1 text-sm text-slate-400">Lege Spielleitung und maximale Anzahl der Schlücke fest.</p>
              </div>

              <div className="space-y-4">
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-300">Name der Spielleitung</span>
                  <input type="text" value={adminName || ""} onChange={(e) => setAdminName(e.target.value)} className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-pink-400/50 focus:ring-2 focus:ring-pink-400/20" placeholder="Zum Beispiel Alex" />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-300">Maximale Schlücke</span>
                  <input type="number" min={1} max={5} value={schlueckeCount} onChange={(e) => setSchlueckeCount(Math.min(5, Math.max(1, Number(e.target.value))))} className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none transition focus:border-pink-400/50 focus:ring-2 focus:ring-pink-400/20" />
                </label>
              </div>

              <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setModeSetup(null)} className="rounded-xl px-5 py-3 font-semibold text-slate-400 transition hover:bg-white/5 hover:text-white">Abbrechen</button>
                <button
                  type="button"
                  disabled={!String(adminName || "").trim()}
                  onClick={() => {
                    socket.emit("admin_select_mode", { modeName: "drinking", options: { adminName: String(adminName).trim(), schlueckeCount } });
                    setModeSetup(null);
                  }}
                  className="rounded-xl bg-linear-to-r from-pink-500 to-orange-400 px-5 py-3 font-bold text-white shadow-lg shadow-pink-950/30 transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-pink-400/60 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Runde starten
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  {/* Leaderboard */}
  if (showLeaderboard) {
    const leaderboardPlayers = gameState.players || [];

    return (
      <div className="fixed inset-0 bg-gray-800 flex flex-col items-center justify-center p-6 z-50">
        <div className="w-full max-w-2xl bg-gray-600 flex flex-col items-center justify-center text-pink-500 rounded-2xl shadow-lg p-6">
          <h2 className="text-3xl text-pink-600 font-bold mb-4">Leaderboard</h2>
          <ul className="text-xl space-y-2">
            {leaderboard(leaderboardPlayers).map((p) => {
                  return (
                    <li key={p.id} className="flex justify-between items-center p-2 bg-gray-700 rounded-lg">
                      <span>
                        {p.rank}. {p.name}: {p.points || 0} Punkte
                      </span>

                      <div className="flex ml-4 gap-2">
                        <button
                          className="bg-green-500 text-white px-3 py-1 rounded"
                          onClick={() =>
                            socket.emit("admin_change_points", { playerId: p.id, amount: +1 })
                          }
                        >
                          +1
                        </button>

                        <button
                          className="bg-red-500 text-white px-3 py-1 rounded"
                          onClick={() =>
                            socket.emit("admin_change_points", { playerId: p.id, amount: -1 })
                          }
                        >
                          -1
                        </button>
                      </div>
                    </li>
                  );
                })}
          </ul>

          <button
            onClick={() => toggleLeaderboard(false)}
            className="mt-6 text-white bg-blue-500 hover:bg-blue-600 px-6 py-3 rounded-lg font-bold"
          >
            Schließen
          </button>
        </div>
      </div>
    );
  }

  if (gameState.screen === "end") {
    return <EndAdmin gameState={gameState} socket={socket} />;
  }

  {/* Schätzfragen screen */}
  if (gameState.mode === "estimate") {
    return (
      <div className="relative">
        <EstimateAdmin key={gameState.roundKey}
          gameState={gameState}
          socket={socket}
          toggleLeaderboard={toggleLeaderboard} />
      </div>
    );
  }

  {/* Pixelraten screen */}
  if (gameState.mode === "pixel") {
    return (
      <div className="relative">
        <PixelAdmin key={gameState.roundKey}
          gameState={gameState}
          socket={socket}
          toggleLeaderboard={toggleLeaderboard}
          timer={timer} />
      </div>
    );
  }

  {/* WhoIs? screen */}
  if (gameState.mode === "whois") {
    return (
      <div className="relative">
        <WhoIsAdmin key={gameState.roundKey}
          gameState={gameState}
          socket={socket}
          toggleLeaderboard={toggleLeaderboard} />
      </div>
    );
  }

  {/* WhatIs? screen */}
  if (gameState.mode === "whatis") {
    return (
      <div className="relative">
        <WhatIsAdmin key={gameState.roundKey}
          gameState={gameState}
          socket={socket}
          toggleLeaderboard={toggleLeaderboard}
          timer={timer} />
      </div>
    );
  }

  if (gameState.mode === "slf") {
    return (
      <div className="relative">
        <SLFAdmin key={gameState.roundKey}
          gameState={gameState}
          socket={socket}
          toggleLeaderboard={toggleLeaderboard}
        />
      </div>
    );
  }

  if (gameState.mode === "test") {
    return (
      <div className="relativ">
        <TestAdmin key={gameState.roundKey}
          gameState={gameState}
          socket={socket}
        />
      </div>
    )
  }

  if (gameState.mode === "imposter") {
    return (
      <div className="relativ">
        <ImposterAdmin key={gameState.roundKey}
          gameState={gameState}
          socket={socket}
        />
      </div>
    )
  }

  if (gameState.mode === "drinking") {
    return (
      <div className="relativ">
        <DrinkingAdmin key={gameState.roundKey}
          gameState={gameState}
          socket={socket}
        />
      </div>
    )
  }

  {/* Fallback */}
  return (
  <div className="flex flex-col items-center gap-4 w-full my-6">
    <p>Fehler...</p>
    <button
      onClick={() => {
        socket.emit("admin_action", { action: "lobby" });
      }}
      className="bg-blue-500 hover:bg-blue-600 px-6 py-3 rounded-lg font-bold"
    >Lobby</button>
  </div>
  );
}

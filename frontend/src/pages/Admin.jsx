import { useState, useEffect, useCallback } from "react";
import { io } from "socket.io-client";
import { serverUrl } from "../lib/connection";
import { games } from "../lib/games";
import GameSymbol from "../components/GameSymbol";
import GameSetupDialog from "../components/GameSetupDialog";
import RoundFrame from "../components/RoundFrame";
import Scoreboard from "../components/Scoreboard";
import RoomSetup from "../components/RoomSetup";
import RoomBanner from "../components/RoomBanner";
import { readHostRoom, rememberHostRoom, setRoomInUrl } from "../lib/rooms";

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
  const [room, setRoom] = useState(readHostRoom);
  const [notice, setNotice] = useState("");
  const openRoom = useCallback((session) => {
    rememberHostRoom(session);
    setNotice("");
    setRoom(session);
  }, []);
  const exitRoom = useCallback((message = "") => {
    sessionStorage.removeItem("pameActiveHostRoom");
    setRoomInUrl(null);
    setNotice(typeof message === "string" ? message : "");
    setRoom(null);
  }, []);
  if (!room) return <RoomSetup onReady={openRoom} initialError={notice} />;
  return <RoomAdmin key={room.roomCode} roomCode={room.roomCode} hostKey={room.hostKey} onInvalid={exitRoom} />;
}

function RoomAdmin({ roomCode, hostKey, onInvalid }) {
  const [socket] = useState(() => io(serverUrl(), { autoConnect: false }));
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(false);
  const [authorized, setAuthorized] = useState(false);
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
  const [adminName, setAdminName] = useState("");

  const authenticate = useCallback(() => {
    socket.timeout(5000).emit("admin_join", { roomCode, hostKey }, (err, response) => {
      if (!socket.connected) return;
      if (err || !response?.success) {
        setAuthorized(false);
        onInvalid(response?.message || "Der Raum ist nicht erreichbar. Bitte erneut öffnen.");
        return;
      }
      setAdminName(response.hostName);
      setAuthorized(true);
      setError("");
    });
  }, [socket, roomCode, hostKey, onInvalid]);

  const toggleLeaderboard = (state) => {
    setShowLeaderboard(state);
    socket.emit("admin_toggle_leaderboard", state);
  };

  useEffect(() => {
    socket.on("connect", () => {
      setConnected(true);
      setError("");
      authenticate();
    });
    socket.on("disconnect", () => { setConnected(false); setAuthorized(false); });
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

  const selectGame = game => {
    setModeSetup(game);
    if (game.id === "estimate") { setEstimateSet("classic"); setEstimateCount(10); }
    if (game.id === "whois") { setWhoisVariant("whois_emojis"); setQuestionCount(5); }
    if (game.id === "slf") { setSlfCats(["Stadt", "Land", "Fluss"]); setSlfCatInput(""); setSlfRounds(5); }
    if (game.id === "imposter") setImposterCount(1);
  };
  const addCategory = () => {
    const category = slfCatInput.trim();
    if (!category || slfCats.some(value => value.toLowerCase() === category.toLowerCase())) return;
    setSlfCats([...slfCats, category]);
    setSlfCatInput("");
  };
  const startGame = () => {
    const id = modeSetup.id;
    const settings = {
      estimate: { modeName: "estimate", options: { questionCount: estimateCount, setKey: estimateSet } },
      whois: { modeName: whoisVariant, options: { questionCount } },
      slf: { modeName: "slf", options: { categories: slfCats, rounds: slfRounds, graceSeconds: 5 } },
      imposter: { modeName: "imposter", options: { imposterCount, adminName: String(adminName).trim() } },
      drinking: { modeName: "drinking", options: { adminName: String(adminName).trim(), schlueckeCount } },
    };
    socket.emit("admin_select_mode", settings[id] || id);
    setModeSetup(null);
  };
  const startDisabled = !connected || !authorized
    || (modeSetup?.id === "slf" && slfCats.length === 0)
    || (modeSetup?.id === "imposter" && (players.length < 2 || !String(adminName || "").trim()))
    || (modeSetup?.id === "drinking" && !String(adminName || "").trim());

  const renderRoom = content => <>
    <RoomBanner roomCode={roomCode} hostKey={hostKey} hostName={adminName} onExit={() => onInvalid()} showBanner={!gameState || gameState.screen === "lobby"} />
    {content}
  </>;

  if (!connected && gameState) return renderRoom(<p role="status" className="status">Verbindung unterbrochen – verbinde erneut …</p>);

  if (!gameState || gameState.screen === "lobby") {
    return renderRoom(
      <>
        {error && <p role="alert" className="notice">{error}</p>}
        {!connected && <p role="status" className="status">Verbindung zum Spielserver wird hergestellt …</p>}
        <header className="lobby-heading">
          <h1>Was spielt ihr heute?</h1>
        </header>
        <div className="host-lobby">
          <section className="player-panel" aria-label="Verbundene Spieler">
            <div className="player-panel__heading"><h2>Eure Runde</h2><span className="count">{players.length} Spieler online</span></div>
            {players.length === 0 ? <p className="muted">Noch niemand beigetreten.</p> : (
              <ul className="player-chips">{players.map(player => <li className="player-chip" key={player.id}>{player.name}</li>)}</ul>
            )}
            {players.length > 0 && <details className="player-management">
              <summary>Spieler verwalten</summary>
              <ul>{players.map(player => <li key={player.id}><span>{player.name}</span><button type="button" className="btn btn-danger" disabled={!connected || !authorized} aria-label={`${player.name} entfernen`} onClick={() => socket.emit("admin_delete_player", player.id)}>Entfernen</button></li>)}</ul>
            </details>}
          </section>
          <fieldset disabled={!connected || !authorized} className="game-library">
            <legend className="sr-only">Spiel auswählen</legend>
            <div className="game-grid">
              {games.map(game => (
                <button type="button" key={game.id} className="game-card" style={{ "--game-accent": game.color }} onClick={() => selectGame(game)} aria-haspopup="dialog">
                  <GameSymbol type={game.symbol} />
                  <span className="game-card__arrow" aria-hidden="true">↗</span>
                  <span className="game-card__title">{game.title}</span>
                  <span className="game-card__description">{game.description}</span>
                </button>
              ))}
            </div>
          </fieldset>
        </div>
        {modeSetup && (
          <GameSetupDialog game={modeSetup} onClose={() => setModeSetup(null)} onStart={startGame} disabled={startDisabled}>
            {modeSetup.id === "estimate" && <>
              <label className="field">Fragenset<select value={estimateSet} onChange={event => setEstimateSet(event.target.value)}><option value="classic">Klassisch</option><option value="traben_trabach">Traben-Trarbach</option><option value="eigene">Selbst erstellt</option></select></label>
              <label className="field">Anzahl der Fragen<input type="number" min={1} max={50} value={estimateCount} onChange={event => setEstimateCount(Number(event.target.value))} /></label>
            </>}
            {modeSetup.id === "whois" && <>
              <label className="field">Spielvariante<select value={whoisVariant} onChange={event => setWhoisVariant(event.target.value)}><option value="whois_emojis">Who Is? – Emojis</option><option value="guessthebeer">Guess the Beer</option></select></label>
              <label className="field">Anzahl der Fragen<input type="number" min={1} max={50} value={questionCount} onChange={event => setQuestionCount(Number(event.target.value))} /></label>
            </>}
            {modeSetup.id === "slf" && <>
              <div className="field-row"><label className="field">Neue Kategorie<input value={slfCatInput} placeholder="Zum Beispiel Beruf" onChange={event => setSlfCatInput(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); addCategory(); } }} /></label><button type="button" className="btn btn-secondary icon-button" onClick={addCategory} aria-label="Kategorie hinzufügen">+</button></div>
              <ul className="category-list">{slfCats.map(category => <li key={category}><span>{category}</span><button type="button" className="btn btn-quiet icon-button" aria-label={category + " entfernen"} onClick={() => setSlfCats(slfCats.filter(value => value !== category))}>×</button></li>)}</ul>
              {slfCats.length === 0 && <p className="muted">Füge mindestens eine Kategorie hinzu.</p>}
              <label className="field">Anzahl der Runden<input type="number" min={1} max={20} value={slfRounds} onChange={event => setSlfRounds(Number(event.target.value))} /></label>
            </>}
            {(modeSetup.id === "imposter" || modeSetup.id === "drinking") && <p className="muted">Du spielst als <strong>{adminName}</strong> mit.</p>}
            {modeSetup.id === "imposter" && <>
              <label className="field">Anzahl der Imposter<input type="number" min={1} max={Math.max(1, Math.floor(players.length / 2))} value={imposterCount} onChange={event => setImposterCount(Math.max(1, Math.min(Math.floor(players.length / 2), Number(event.target.value))))} /></label>
              {players.length < 2 && <p className="muted">Für Imposter müssen mindestens zwei Spieler beitreten.</p>}
            </>}
            {modeSetup.id === "drinking" && <label className="field">Maximale Schlücke<input type="number" min={1} max={5} value={schlueckeCount} onChange={event => setSchlueckeCount(Math.min(5, Math.max(1, Number(event.target.value))))} /></label>}
            {["pixel", "whatis", "test"].includes(modeSetup.id) && <p className="muted">Alles bereit. Starte, sobald eure Gruppe dabei ist.</p>}
          </GameSetupDialog>
        )}
      </>
    );
  }

  if (showLeaderboard) return renderRoom(<Scoreboard overlay players={gameState.players || []} onClose={() => toggleLeaderboard(false)} onChangePoints={(playerId, amount) => socket.emit("admin_change_points", { playerId, amount })} />);
  if (gameState.screen === "end") return renderRoom(<EndAdmin gameState={gameState} socket={socket} />);
  const screens = { estimate: EstimateAdmin, pixel: PixelAdmin, whois: WhoIsAdmin, whatis: WhatIsAdmin, slf: SLFAdmin, test: TestAdmin, imposter: ImposterAdmin, drinking: DrinkingAdmin };
  const Screen = screens[gameState.mode];
  return renderRoom(<>
    {error && <p role="alert" className="notice">{error}</p>}
    {Screen ? <RoundFrame gameState={gameState} role="host"><Screen key={gameState.roundKey} gameState={gameState} socket={socket} toggleLeaderboard={toggleLeaderboard} timer={timer} /></RoundFrame> : <div className="stack"><p>Die Spielansicht konnte nicht geladen werden.</p><button className="btn btn-secondary" onClick={() => socket.emit("admin_action", { action: "lobby" })}>Lobby</button></div>}
  </>);
}

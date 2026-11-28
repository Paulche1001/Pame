import { useState, useEffect } from "react";
import { io } from "socket.io-client";
import { serverUrl, playerIdentity } from "../lib/connection";
import { Link } from "react-router-dom";
import RoundFrame from "../components/RoundFrame";
import Scoreboard from "../components/Scoreboard";
import RoomBanner from "../components/RoomBanner";
import { normalizeRoomCode, initialPlayerRoom, savedPlayerName, rememberPlayerRoom, clearPlayerRoom, setRoomInUrl } from "../lib/rooms";
import EndPlayer from "./EndPlayer";
import EstimatePlayer from "./EstimatePlayer";
import PixelPlayer from "./PixelPlayer";
import WhoIsPlayer from "./WhoIsPlayer";
import WhatIsPlayer from "./WhatIsPlayer";
import SLFPlayer from "./SLFPlayer.jsx";
import TestPlayer from "./TestPlayer.jsx";
import ImposterPlayer from "./ImposterPlayer";
import DrinkingPlayer from "./DrinkingPlayer";


export default function Player() {
  const [socket] = useState(() => io(serverUrl(), { autoConnect: false }));
  const [identity] = useState(playerIdentity);
  const [roomCode, setRoomCode] = useState(initialPlayerRoom);
  const [activeRoom, setActiveRoom] = useState("");
  const PLAYER_ID = identity.id;
  const [name, setName] = useState("");
  const [joined, setJoined] = useState(false);
  const [gameState, setGameState] = useState(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [timer, setTimer] = useState(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(false);
  useEffect(() => {
    let active = true;
    const join = (savedName, code) => {
      socket.timeout(5000).emit("player_join", { playerId: identity.id, playerToken: identity.token, name: savedName, roomCode: code }, (err, response) => {
        if (!active) return;
        setJoining(false);
        if (err || !response?.success) {
          setJoined(false);
          setError(response?.message || "Beitritt fehlgeschlagen. Bitte versuche es erneut.");
          return;
        }
        rememberPlayerRoom(response.roomCode, response.name);
        setActiveRoom(response.roomCode);
        setRoomCode(response.roomCode);
        setName(response.name);
        setJoined(true);
        setError("");
      });
    };
    socket.on("connect", () => {
      setConnected(true);
      setError("");
      const code = activeRoom || initialPlayerRoom();
      const savedName = code ? savedPlayerName(code) : null;
      if (savedName) join(savedName, code);
    });
    socket.on("disconnect", () => setConnected(false));
    socket.on("connect_error", () => setError("Keine Verbindung zum Spielserver. Verbindung wird erneut versucht …"));
    socket.on("kicked", () => {
      clearPlayerRoom(activeRoom);
      setActiveRoom("");
      setJoined(false);
      setName("");
      setGameState(null);
      setError("Du wurdest aus der Runde entfernt.");
    });
    socket.on("session_replaced", () => {
      setJoined(false);
      setError("Du spielst bereits in einem anderen Tab.");
    });
    socket.on("action_error", setError);
    socket.on("game_state", setGameState);
    socket.on("leaderboard_toggle", setShowLeaderboard);
    socket.on("players_update", players => setGameState(previous => previous ? { ...previous, players } : previous));
    socket.on("timer_update", setTimer);
    socket.on("timer_done", () => setTimer(null));
    socket.connect();
    return () => {
      active = false;
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [socket, identity, activeRoom]);

  const joinGame = () => {
    const cleanName = name.trim();
    const code = normalizeRoomCode(roomCode);
    if (!cleanName || code.length !== 6 || !connected || joining) return;
    setJoining(true);
    setError("");
    socket.timeout(5000).emit("player_join", { playerId: identity.id, playerToken: identity.token, name: cleanName, roomCode: code }, (err, response) => {
      setJoining(false);
      if (err || !response?.success) {
        setError(response?.message || "Beitritt fehlgeschlagen. Bitte versuche es erneut.");
        return;
      }
      rememberPlayerRoom(response.roomCode, response.name);
      setActiveRoom(response.roomCode);
      setRoomCode(response.roomCode);
      setName(response.name);
      setJoined(true);
    });
  };
  const leaveGame = () => {
    const reset = () => {
      clearPlayerRoom(activeRoom);
      setRoomInUrl(null);
      setActiveRoom("");
      setJoined(false);
      setName("");
      setGameState(null);
      setShowLeaderboard(false);
      setTimer(null);
      setError("");
    };
    if (!socket.connected) { reset(); return; }
    socket.timeout(5000).emit("player_leave", { playerId: identity.id }, (err, response) => {
      if (err || !response?.success) {
        setError(response?.message || "Verlassen fehlgeschlagen. Bitte versuche es erneut.");
        return;
      }
      reset();
    });
  };
  const renderGame = content => (
    <>
      {joined && activeRoom && <RoomBanner roomCode={activeRoom} onExit={leaveGame} />}
      {joined && error && <p role="alert" className="px-4 pt-3 text-red-300">{error}</p>}
      <RoundFrame gameState={gameState} role="player">{content}</RoundFrame>
    </>
  );

  // Beitreten direkt auf der Startseite; Einladungen nutzen denselben Ablauf.
  if (!joined) {
    return (
      <section className="entry">
        <div className="entry__intro">
          <h1>Game Night mit Pame</h1>
        </div>
        <div className="entry-card">
          <form onSubmit={event => { event.preventDefault(); joinGame(); }}>
            <label className="field">Raumcode<input aria-label="Raumcode" className="code-input" value={roomCode} maxLength={6} onChange={event => setRoomCode(normalizeRoomCode(event.target.value))} placeholder="ABC123" autoComplete="off" spellCheck={false} /></label>
            <label className="field">Dein Name<input type="text" aria-label="Dein Name" value={name} maxLength={40} onChange={event => setName(event.target.value)} placeholder="Dein Name" autoComplete="nickname" /></label>
            {error && <p role="alert" className="notice">{error}</p>}
            {!connected && <p role="status" className="status">Verbindung wird hergestellt …</p>}
            <button type="submit" className="btn btn-primary" disabled={!connected || !name.trim() || roomCode.length !== 6 || joining}>{joining ? "Beitreten …" : "Beitreten"}</button>
          </form>
        </div>
        <div className="entry-secondary"><p>Du bringst die Runde zusammen?</p><Link className="btn btn-secondary" to="/admin" aria-label="Raum erstellen">Raum erstellen<span aria-hidden="true">↗</span></Link></div>
      </section>
    );
  }

  if (!connected) return renderGame(<p role="status" className="status">Verbindung unterbrochen – verbinde erneut …</p>);
  if (!gameState) return renderGame(<p role="status">Warte auf Spielstart …</p>);

  if (showLeaderboard) return renderGame(<Scoreboard overlay players={gameState?.players || []} />);

  // Endscreen anzeigen
  if (gameState.screen === "end") {
    return renderGame(<EndPlayer gameState={gameState} socket={socket} />);
  }

  // Schätzfragen starten
  if (gameState.mode === "estimate") {
    return renderGame(
      <EstimatePlayer key={gameState.roundKey}
        gameState={gameState}
        playerId={PLAYER_ID}
        socket={socket}
      />
    );
  }

  // Pixel Mode starten
  if (gameState.mode === "pixel") {
    return renderGame(
      <PixelPlayer key={gameState.roundKey}
        gameState={gameState}
        socket={socket}
        playerId={PLAYER_ID}
        timer={timer}
      />
    );
  }

  if (gameState.mode === "whois") {
    return renderGame(
      <WhoIsPlayer key={gameState.roundKey}
        gameState={gameState}
        socket={socket}
        playerId={PLAYER_ID}
      />
    );
  }

  if (gameState.mode === "whatis") {
    return renderGame(
      <WhatIsPlayer key={gameState.roundKey}
        gameState={gameState}
        socket={socket}
        playerId={PLAYER_ID}
        timer={timer}
      />
    );
  }

  if (gameState.mode === "slf") {
    return renderGame(<SLFPlayer key={gameState.roundKey} gameState={gameState} socket={socket} playerId={PLAYER_ID} />);
  }

  if (gameState.mode === "test") {
    return renderGame(<TestPlayer key={gameState.roundKey} gameState={gameState} socket={socket} playerId={PLAYER_ID} />);
  }

  if (gameState.mode === "imposter") {
    return renderGame(<ImposterPlayer key={gameState.roundKey} gameState={gameState} socket={socket} playerId={PLAYER_ID} />);
  }

  if (gameState.mode === "drinking") {
    return renderGame(<DrinkingPlayer key={gameState.roundKey} gameState={gameState} socket={socket} playerId={PLAYER_ID} />);
  }


  // Die Lobby zeigt ausschließlich den aktuellen Raumzustand.
  return renderGame(
    <section className="waiting-card">
      <div className="waiting-card__symbol" aria-hidden="true">✳</div>
      <p className="eyebrow">Willkommen in eurer Runde</p>
      <h1>Du bist dabei, {name}!</h1>
      <p>Der Spielleiter wählt ein Spiel. Gleich geht’s los.</p>
      <div className="waiting-card__players">
        <h2>Eure Runde · {gameState.players?.length || 0}</h2>
        <ul className="player-chips">{(gameState.players || []).map(player => <li className="player-chip" key={player.id}>{player.name}</li>)}</ul>
      </div>
    </section>
  );
}

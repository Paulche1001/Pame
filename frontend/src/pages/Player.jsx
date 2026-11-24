import { useState, useEffect } from "react";
import { io } from "socket.io-client";
import { serverUrl, playerIdentity, clearPlayerIdentity } from "../lib/connection";
import { leaderboard } from "../lib/ranking";
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
  const [identity, setIdentity] = useState(playerIdentity);
  const PLAYER_ID = identity.id;
  const [name, setName] = useState("");
  const [joined, setJoined] = useState(false);
  const [gameState, setGameState] = useState(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [timer, setTimer] = useState(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(false);
  const emojis = ["\u{1F440}", "\u{1F928}", "\u{1F575}\uFE0F", "\u{1F636}", "\u{1F60F}"];
  const [index, setIndex] = useState(0);
  const handleAnimationIteration = () => setIndex(previous => (previous + 1) % emojis.length);

  useEffect(() => {
    let active = true;
    const join = (savedName) => {
      socket.timeout(5000).emit("player_join", { playerId: identity.id, playerToken: identity.token, name: savedName }, (err, response) => {
        if (!active) return;
        setJoining(false);
        if (err || !response?.success) {
          setJoined(false);
          setError(response?.message || "Beitritt fehlgeschlagen. Bitte versuche es erneut.");
          return;
        }
        localStorage.setItem("playerName", response.name);
        setName(response.name);
        setJoined(true);
        setError("");
      });
    };
    socket.on("connect", () => {
      setConnected(true);
      setError("");
      const savedName = localStorage.getItem("playerName");
      if (savedName) join(savedName);
    });
    socket.on("disconnect", () => setConnected(false));
    socket.on("connect_error", () => setError("Keine Verbindung zum Spielserver. Verbindung wird erneut versucht …"));
    socket.on("kicked", () => {
      clearPlayerIdentity();
      setJoined(false);
      setName("");
      setGameState(null);
      setError("Du wurdest aus der Runde entfernt.");
      setIdentity(playerIdentity());
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
  }, [socket, identity]);

  const joinGame = () => {
    const cleanName = name.trim();
    if (!cleanName || !connected || joining) return;
    setJoining(true);
    setError("");
    socket.timeout(5000).emit("player_join", { playerId: identity.id, playerToken: identity.token, name: cleanName }, (err, response) => {
      setJoining(false);
      if (err || !response?.success) {
        setError(response?.message || "Beitritt fehlgeschlagen. Bitte versuche es erneut.");
        return;
      }
      localStorage.setItem("playerName", response.name);
      setName(response.name);
      setJoined(true);
    });
  };
  const leaveGame = () => {
    socket.timeout(5000).emit("player_leave", { playerId: identity.id }, (err, response) => {
      if (err || !response?.success) {
        setError(response?.message || "Verlassen fehlgeschlagen. Bitte versuche es erneut.");
        return;
      }
      clearPlayerIdentity();
      setJoined(false);
      setName("");
      setGameState(null);
      setShowLeaderboard(false);
      setIdentity(playerIdentity());
    });
  };

  // Neuer Spieler
  if (!joined) {
    return (
      <div className="flex flex-col items-center gap-4 w-full p-6 my-6">
        {error && <p role="alert" className="text-red-300">{error}</p>}
        {!connected && <p role="status">Verbindung wird hergestellt …</p>}
        <input
          type="text"
          value={name}
          maxLength={40}
          aria-label="Dein Name"
          onKeyDown={e => { if (e.key === "Enter") joinGame(); }}
          onChange={(e) => setName(e.target.value)}
          className="w-full p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-pink-400"
          placeholder="Dein Name"
        />
        <button
          className="w-[50%] bg-pink-600 text-white py-3 rounded-lg font-bold hover:bg-pink-700 transition"
          onClick={joinGame}
          disabled={!connected || !name.trim() || joining}
        >
          Join
        </button>
      </div>
    );
  }

  if (!connected) return <p role="status" className="p-6">Verbindung unterbrochen – verbinde erneut …</p>;
  if (!gameState) return <p>Warte auf Spielstart...</p>;

  // Leaderboard pop-up
  if (showLeaderboard) {
    const leaderboardPlayers = gameState?.players || [];
    return (
      <div className="fixed inset-0 bg-gray-800 flex flex-col items-center justify-center p-6 z-50">
        <div className="w-full max-w-2xl bg-gray-600 flex flex-col items-center justify-center  min-h-[50vh] text-pink-500 rounded-2xl shadow-lg p-6">
          <h2 className="text-3xl text-pink-600 font-bold mb-4">Leaderboard</h2>
          <ul className="text-xl space-y-2">
            {leaderboard(leaderboardPlayers).map((p) => {
                return (
                  <li key={p.id}>
                    {p.rank}. {p.name}: {p.points || 0} Punkte
                  </li>
                );
              })}
          </ul>
        </div>
      </div>
    );
  }

  // Endscreen anzeigen
  if (gameState.screen === "end") {
    return <EndPlayer gameState={gameState} socket={socket} />;
  }

  // Schätzfragen starten
  if (gameState.mode === "estimate") {
    return (
      <EstimatePlayer key={gameState.roundKey}
        gameState={gameState}
        playerId={PLAYER_ID}
        socket={socket}
      />
    );
  }

  // Pixel Mode starten
  if (gameState.mode === "pixel") {
    return (
      <PixelPlayer key={gameState.roundKey}
        gameState={gameState}
        socket={socket}
        playerId={PLAYER_ID}
        timer={timer}
      />
    );
  }

  if (gameState.mode === "whois") {
    return (
      <WhoIsPlayer key={gameState.roundKey}
        gameState={gameState}
        socket={socket}
        playerId={PLAYER_ID}
      />
    );
  }

  if (gameState.mode === "whatis") {
    return (
      <WhatIsPlayer key={gameState.roundKey}
        gameState={gameState}
        socket={socket}
        playerId={PLAYER_ID}
        timer={timer}
      />
    );
  }

  if (gameState.mode === "slf") {
    return <SLFPlayer key={gameState.roundKey} gameState={gameState} socket={socket} playerId={PLAYER_ID} />;
  }

  if (gameState.mode === "test") {
    return <TestPlayer key={gameState.roundKey} gameState={gameState} socket={socket} playerId={PLAYER_ID} />;
  }

  if (gameState.mode === "imposter") {
    return <ImposterPlayer key={gameState.roundKey} gameState={gameState} socket={socket} playerId={PLAYER_ID} />;
  }

  if (gameState.mode === "drinking") {
    return <DrinkingPlayer key={gameState.roundKey} gameState={gameState} socket={socket} playerId={PLAYER_ID} />;
  }


  // Lobby
  return (
    <div className="w-full px-3 rounded-xl h-[50vh] border border-slate-700 shadow-2xl text-center relative overflow-hidden flex items-center justify-center">

        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <div className="absolute -top-10 -left-10 w-40 h-40 bg-gray-800 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-pink-600 rounded-full blur-3xl animate-pulse"></div>
        </div>

        <div className="relative z-10">
          {error && <p role="alert" className="text-red-300">{error}</p>}
          <div className="mb-4 flex justify-center">
            <div
              className="w-16 h-16 rounded-full bg-slate-700 flex items-center justify-center text-3xl animate-bounce"
              onAnimationIteration={handleAnimationIteration}
            >
              {emojis[index]}
            </div>
          </div>

          <h3 className="text-2xl font-bold text-white mb-2">
            Hey <span className="text-pink-600">{name}</span>
          </h3>

          <p className="text-slate-300 text-lg mb-6">
            Warte, bis der Admin das Spiel startet
          </p>

          <div className="flex items-center justify-center gap-2 text-gray-300 font-medium">
            <span>System check läuft</span>

            <span className="flex gap-1">
              <span className="loading-dot" style={{ animationDelay: "0s" }}></span>
              <span className="loading-dot" style={{ animationDelay: "0.2s" }}></span>
              <span className="loading-dot" style={{ animationDelay: "0.4s" }}></span>
            </span>
          </div>

          <button
            className="bg-red-500 hover:bg-red-600 text-white mt-10 px-5 py-2 rounded"
            onClick={leaveGame}
          >
            Verlassen
          </button>

        </div>
    </div>
  )
}

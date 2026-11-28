import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { io } from "socket.io-client";
import { serverUrl } from "../lib/connection";
import { normalizeRoomCode, roomCodeFromUrl, savedHostKey } from "../lib/rooms";

export default function RoomSetup({ onReady, initialError = "" }) {
  const [socket] = useState(() => io(serverUrl(), { autoConnect: false }));
  const [connected, setConnected] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [token, setToken] = useState(() => sessionStorage.getItem("pameAdminToken") || "");
  const [code, setCode] = useState(roomCodeFromUrl);
  const [hostKey, setHostKey] = useState("");
  const [hostName, setHostName] = useState("");
  const [error, setError] = useState(initialError);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => { setConnected(false); setBusy(false); });
    socket.on("admin_auth_required", setAuthRequired);
    socket.on("connect_error", () => setError("Der Spielserver ist nicht erreichbar. Verbindung wird erneut versucht …"));
    socket.connect();
    return () => { socket.removeAllListeners(); socket.disconnect(); };
  }, [socket]);

  const request = (event, payload) => {
    if (!connected || busy) return;
    setBusy(true);
    setError("");
    socket.timeout(5000).emit(event, payload, (err, response) => {
      if (!socket.connected) return;
      setBusy(false);
      if (err || !response?.success) {
        setError(response?.message || "Die Anfrage ist fehlgeschlagen. Bitte erneut versuchen.");
        return;
      }
      if (event === "room_create" && token) sessionStorage.setItem("pameAdminToken", token);
      onReady({ roomCode: response.roomCode, hostKey: response.hostKey || payload.hostKey });
    });
  };

  return (
    <div className="entry entry-card">
      <Link className="back-link" to="/" aria-label="Zurück zur Startseite" title="Zurück zur Startseite"><span aria-hidden="true">←</span></Link>
      <div className="entry__intro">
        <h1>Eigene Spielrunde starten</h1>
        <p className="mt-2 text-slate-300">Erstelle einen Raum und teile seinen Code mit deiner Gruppe.</p>
      </div>
      {error && <p role="alert" className="notice">{error}</p>}
      {!connected && <p role="status">Verbindung zum Spielserver wird hergestellt …</p>}
      <form className="stack" onSubmit={event => { event.preventDefault(); request("room_create", { token, hostName: hostName.trim() }); }}>
        <label className="field">Dein Name als Spielleiter<input type="text" aria-label="Name der Spielleitung" autoComplete="nickname" placeholder="Dein Name" value={hostName} maxLength={40} required onChange={event => setHostName(event.target.value)} /></label>
        {authRequired && <label className="field">Server-Schlüssel<input aria-label="Server-Schlüssel" type="password" autoComplete="current-password" value={token} onChange={event => setToken(event.target.value)} className="rounded-lg bg-gray-800 p-3" /></label>}
        <button disabled={!connected || busy || !hostName.trim() || (authRequired && !token)} className="btn btn-primary">Raum erstellen</button>
      </form>
      <details className="compact-details">
        <summary className="cursor-pointer font-semibold">Bestehenden Raum verwalten</summary>
        <form className="stack" onSubmit={event => { event.preventDefault(); request("admin_join", { roomCode: code, hostKey: hostKey || savedHostKey(code) }); }}>
          <label className="field">Raumcode<input aria-label="Raumcode" value={code} maxLength={6} onChange={event => setCode(normalizeRoomCode(event.target.value))} className="rounded-lg bg-gray-800 p-3 font-mono uppercase" autoComplete="off" /></label>
          <label className="field">Spielleiter-Schlüssel<input type="password" autoComplete="off" value={hostKey} onChange={event => setHostKey(event.target.value.trim())} placeholder="Schlüssel dieses Raums" className="rounded-lg bg-gray-800 p-3" /></label>
          <button disabled={!connected || busy || code.length !== 6 || !(hostKey || savedHostKey(code))} className="btn btn-secondary">Raum öffnen</button>
        </form>
      </details>
    </div>
  );
}

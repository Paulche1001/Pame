import { Routes, Route, Link, useLocation } from "react-router-dom";
import { useCallback, useMemo, useRef, useState } from "react";
import { SettingsContext } from "./lib/settings";
import Admin from "./pages/Admin";
import Player from "./pages/Player";
import Home from "./pages/Home";

function App() {
  const { pathname } = useLocation();
  const settingsDialog = useRef(null);
  const [settingsTarget, setSettingsTarget] = useState(null);
  const closeSettings = useCallback(() => settingsDialog.current?.close(), []);
  const settings = useMemo(() => ({ target: settingsTarget, close: closeSettings }), [settingsTarget, closeSettings]);
  return (
    <SettingsContext.Provider value={settings}>
    <div className="pame-app">
      <header className="app-header">
        <Link to={pathname === "/admin" ? "/admin" : "/"} onClick={event => { if (pathname === "/admin") event.preventDefault(); }} aria-label={pathname === "/admin" ? "Adminübersicht" : "Zur Startseite"} className="brand">Pame<span aria-hidden="true">✳</span></Link>
        <button type="button" className="settings-button" aria-label="Einstellungen" title="Einstellungen" aria-haspopup="dialog" aria-controls="pame-settings" onClick={() => settingsDialog.current.showModal()}>
          <svg aria-hidden="true" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="m9.5 3-.5 2.3-1.6.9L5.2 5.5 2.7 9.8l1.7 1.6v1.2l-1.7 1.6 2.5 4.3 2.2-.7 1.6.9.5 2.3h5l.5-2.3 1.6-.9 2.2.7 2.5-4.3-1.7-1.6v-1.2l1.7-1.6-2.5-4.3-2.2.7-1.6-.9-.5-2.3Z" /><circle cx="12" cy="12" r="3" /></svg>
        </button>
      </header>
      <dialog id="pame-settings" ref={settingsDialog} className="settings-dialog" aria-labelledby="settings-title" onClick={event => { if (event.target === event.currentTarget) closeSettings(); }}>
        <header className="settings-heading"><h2 id="settings-title">Einstellungen</h2><button type="button" className="btn btn-quiet icon-button" aria-label="Einstellungen schließen" onClick={closeSettings}>×</button></header>
        <div className="settings-content" ref={setSettingsTarget}><p className="settings-empty muted">Kein Raum aktiv.</p></div>
      </dialog>
      <div className={`app-content ${pathname === "/admin" ? "app-content--host" : "app-content--player"}`}>
        <Routes>
          <Route path="/admin" element={<Admin />} />
          <Route path="/player" element={<Player />} />
          <Route path="/" element={<Home />} />
        </Routes>
      </div>
    </div>
    </SettingsContext.Provider>
  );
}

export default App;

import { useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { SettingsContext } from "../lib/settings";

export default function RoomBanner({ roomCode, hostKey, hostName, onExit, showBanner = false }) {
  const settings = useContext(SettingsContext);
  const [copyStatus, setCopyStatus] = useState("");
  const timeout = useRef(null);
  useEffect(() => () => clearTimeout(timeout.current), []);
  const invite = async () => {
    const link = new URL("/player?room=" + roomCode, window.location.origin).href;
    try {
      let copied = false;
      if (navigator.clipboard?.writeText) {
        try { await navigator.clipboard.writeText(link); copied = true; } catch { /* Browser-Fallback, auch ohne HTTPS im lokalen Netz. */ }
      }
      if (!copied) {
        const focused = document.activeElement;
        const input = document.createElement("textarea");
        input.value = link;
        input.style.position = "fixed";
        input.style.opacity = "0";
        // In einem modalen Dialog sind Elemente außerhalb nicht fokussierbar.
        (document.querySelector("dialog[open]") || document.body).append(input);
        input.focus();
        input.select();
        copied = document.execCommand("copy");
        input.remove();
        focused?.focus();
        if (!copied) throw new Error("copy");
      }
      setCopyStatus("Link kopiert");
    } catch { setCopyStatus("Bitte den Beitrittslink in den Einstellungen kopieren."); }
    clearTimeout(timeout.current);
    timeout.current = setTimeout(() => setCopyStatus(""), 4000);
  };
  return (
    <>
    {showBanner && <section className="room-banner" aria-label="Dein Spielraum">
      <div className="room-banner__code"><p className="eyebrow">Raumcode</p><p data-room-code>{roomCode}</p></div>
      <div className="room-banner__actions">
        {hostKey && <button type="button" className="btn btn-primary" onClick={invite}>{copyStatus === "Link kopiert" ? "Link kopiert" : "Einladen"}</button>}
        <span role="status" className="sr-only">{copyStatus}</span>
      </div>
      {copyStatus && copyStatus !== "Link kopiert" && <p className="room-banner__copy-error" role="alert">{copyStatus}</p>}
    </section>}
    {settings?.target && createPortal(
      <section className="room-settings" aria-label="Dein Spielraum">
        {hostName && <div><p className="eyebrow">Spielleiter</p><p>{hostName}</p></div>}
        <div className="room-banner__code"><p className="eyebrow">Raumcode</p><p data-room-code>{roomCode}</p></div>
        {hostKey && <>
          <button type="button" className="btn btn-primary" onClick={invite}>{copyStatus === "Link kopiert" ? "Link kopiert" : "Einladen"}</button>
          <a className="settings-invite-link" href={"/player?room=" + roomCode} target="_blank" rel="noreferrer">Beitrittslink für Spieler ↗</a>
          <details className="settings-key"><summary>Spielleiter-Schlüssel sichern</summary><p>Damit kannst du den Raum auf einem anderen Gerät verwalten. Teile mit Spielern den Raumcode.</p><code>{hostKey}</code></details>
        </>}
        <p role="status" className={copyStatus && copyStatus !== "Link kopiert" ? "notice" : "sr-only"}>{copyStatus}</p>
        {onExit && <button type="button" className="btn btn-danger" onClick={() => { settings.close(); onExit(); }}>Raum verlassen</button>}
      </section>, settings.target
    )}
    </>
  );
}

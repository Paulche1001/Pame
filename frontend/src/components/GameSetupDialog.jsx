import { useEffect, useRef } from "react";
import GameSymbol from "./GameSymbol";

export default function GameSetupDialog({ game, onClose, onStart, disabled, children }) {
  const dialog = useRef(null);
  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => element.close();
  }, []);
  return (
    <dialog ref={dialog} className="setup-dialog" aria-labelledby="setup-title" onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose(); }} style={{ "--game-accent": game.color }}>
      <div className="setup-dialog__inner">
        <header className="setup-dialog__heading">
          <GameSymbol type={game.symbol} />
          <button className="btn btn-quiet icon-button" type="button" aria-label="Auswahl schließen" onClick={onClose}>×</button>
          <p className="eyebrow">Deine Auswahl</p>
          <h2 id="setup-title">{game.title}</h2>
          <p className="muted">{game.description}</p>
        </header>
        <div className="setup-dialog__body">{children}</div>
        <footer className="setup-dialog__actions">
          <button type="button" className="btn btn-quiet" onClick={onClose}>Abbrechen</button>
          <button type="button" className="btn btn-game" onClick={onStart} disabled={disabled}>Spiel starten</button>
        </footer>
      </div>
    </dialog>
  );
}

import { useState } from "react";
import { rankBy } from "../lib/ranking";

export default function EstimatePlayer({ gameState, socket, playerId }) {
  const [answer, setAnswer] = useState(() => gameState.answers?.[playerId]?.answer ?? "");
  const [submitted, setSubmitted] = useState(() => !!gameState.answers?.[playerId]);
  if (gameState.screen === "question") return <div className="round-content">
    <h1 className="question-text">{gameState.question}</h1>
    <label className="field">Deine Schätzung<input type="number" value={answer} onChange={event => { setAnswer(event.target.value); setSubmitted(false); }} /></label>
    <button className="btn btn-game" disabled={submitted || String(answer).trim() === "" || !Number.isFinite(Number(answer))} onClick={() => { socket.emit("player_action", { action: "answer", playerId, value: Number(answer) }); setSubmitted(true); }}>{submitted ? "Antwort gesendet" : "Antwort abgeben"}</button>
    {submitted && <p role="status" className="muted">Deine Schätzung ist dabei. Die Spielleitung löst auf.</p>}
  </div>;
  if (gameState.screen === "results") return <div className="round-content">
    <p className="question-text">{gameState.question}</p>
    <div className="answer-panel"><h3>Richtige Antwort:</h3><p className="text-3xl font-bold mt-3" style={{ color: "var(--game-accent)" }}>{Number(gameState.correctAnswer).toLocaleString("de-DE")}</p></div>
    <h3>Ergebnisse</h3>
    <ul className="answer-list">{rankBy(Object.entries(gameState.answers || {}).map(([id, obj]) => ({ ...obj, id })), entry => Math.abs(entry.answer - gameState.correctAnswer), 1).map(obj => <li key={obj.id}><span>{obj.rank}. {obj.name}</span><strong>{obj.answer != null ? Number(obj.answer).toLocaleString("de-DE") : "–"}</strong></li>)}</ul>
  </div>;
  return null;
}

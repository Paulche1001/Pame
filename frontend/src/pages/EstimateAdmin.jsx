export default function EstimateAdmin({ gameState, socket, toggleLeaderboard }) {
  const revealed = gameState.screen === "results";
  return <div className="round-content">
    <p className="question-text">{gameState.question}</p>
    <p className="answer-preview">Richtige Antwort: <strong>{gameState.correctAnswer != null ? Number(gameState.correctAnswer).toLocaleString("de-DE") : "–"}</strong></p>
    <div className="answer-panel">
      <h3>Antworten · {Object.keys(gameState.answers || {}).length}/{gameState.players?.length || 0}</h3>
      {Object.keys(gameState.answers || {}).length === 0 ? <p className="muted mt-3">Noch keine Antworten.</p> : <ul className="answer-list mt-4">{Object.entries(gameState.answers || {}).map(([id, value]) => <li key={id}><span>{value.name}</span><strong>{value.answer != null ? Number(value.answer).toLocaleString("de-DE") : "–"}</strong></li>)}</ul>}
    </div>
    <div className="round-actions">
      {!revealed ? <button className="btn btn-game" onClick={() => socket.emit("admin_action", { action: "reveal" })}>Antworten aufdecken</button> : <><button className="btn btn-game" onClick={() => socket.emit("admin_action", { action: "next" })}>Nächste Frage</button><button className="btn btn-secondary" onClick={() => toggleLeaderboard(true)}>Rangliste</button></>}
      <button className="btn btn-quiet" onClick={() => { if (window.confirm("Willst du das Spiel wirklich verlassen?")) socket.emit("admin_action", { action: "lobby" }); }}>Verlassen</button>
    </div>
  </div>;
}

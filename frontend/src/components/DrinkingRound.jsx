export default function DrinkingRound({ gameState, participantName, answer, submitted, onAnswerChange, onSubmit, onSelect, onLeave, onReveal, onNext }) {
  const { taskName, questKind, allPlayer = [], selectedPlayers = {}, voted, topPlayers = [], allEstimated, playerEstimates = {}, estimateRanking = [], correctAnswer, sips } = gameState;
  const sipLabel = sips === 1 ? "Schluck" : "Schlücke";
  const selectedName = selectedPlayers[participantName];

  return (
    <div className="round-content drink-round">
      <header className="drink-heading">
        <h1 className="question-text">{taskName}</h1>
        {onLeave && <button type="button" className="btn btn-quiet drink-leave" onClick={onLeave}>Verlassen</button>}
      </header>

      {questKind === "werwuerde" && (!voted ? (
        <fieldset className="drink-voting">
          <legend className="sr-only">Wen wählst du?</legend>
          <p className="drink-progress" role="status">{Object.keys(selectedPlayers).length} von {allPlayer.length} Stimmen</p>
          <ul className="drink-choices">
            {allPlayer.map(name => (
              <li key={name}>
                <label className="drink-choice" data-selected={selectedName === name}>
                  <span className="drink-choice__name">{name}</span>
                  <span className="drink-choice__control">
                    <input type="radio" name="player" aria-label={name} checked={selectedName === name} onChange={() => onSelect(name)} />
                    <span className="drink-choice__dot" aria-hidden="true" />
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      ) : (
        <div className="drink-result" role="status">
          <p className="eyebrow">Ergebnis</p>
          <p className="drink-result__text">{topPlayers.length === 1
            ? `${topPlayers[0]} muss ${sips} ${sipLabel} trinken!`
            : topPlayers.length > 1
              ? `${topPlayers.slice(0, -1).join(", ")} und ${topPlayers.slice(-1)} müssen ${sips} ${sipLabel} trinken!`
              : "Niemand wurde gewählt."}</p>
        </div>
      ))}

      {questKind === "schaetz" && (!(allEstimated || voted) ? (
        <div className="drink-estimate">
          <p className="drink-progress">{Object.keys(playerEstimates).length} von {allPlayer.length} Schätzungen</p>
          <label className="field">Deine Schätzung<input type="number" aria-label="Deine Schätzung" value={answer} onChange={event => onAnswerChange(event.target.value)} /></label>
          <button type="button" className="btn btn-game" disabled={submitted || answer === ""} onClick={onSubmit}>Absenden</button>
          {submitted && <p className="muted" role="status">Deine Schätzung ist dabei.</p>}
        </div>
      ) : (
        <div className="drink-estimate">
          <div className="drink-result" role="status"><p className="eyebrow">Richtige Antwort:</p><p className="drink-result__answer">{correctAnswer ?? "–"}</p></div>
          {estimateRanking.length > 0 ? <>
            <div className="drink-summary"><p><strong>{estimateRanking[0].name}</strong> darf {sips} {sipLabel} verteilen!</p><p><strong>{estimateRanking[estimateRanking.length - 1].name}</strong> muss {sips} {sipLabel} trinken!</p></div>
            <ol className="drink-ranking">{estimateRanking.map((entry, index) => <li key={entry.name} data-self={entry.name === participantName}><span>{index + 1}. {entry.name}</span><strong>{entry.estimate}</strong></li>)}</ol>
          </> : <p className="muted">Keine Schätzungen vorhanden.</p>}
        </div>
      ))}

      {onReveal && <footer className="drink-actions"><button type="button" className="btn btn-game" onClick={voted ? onNext : onReveal}>{voted ? "Nächste Aufgabe" : "Auflösen"}</button></footer>}
    </div>
  );
}

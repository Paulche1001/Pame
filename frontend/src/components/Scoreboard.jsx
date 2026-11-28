import { leaderboard } from "../lib/ranking";

export default function Scoreboard({ players, title = "Rangliste", overlay = false, onClose, onChangePoints, children }) {
  return (
    <section className={overlay ? "scoreboard-overlay" : "scoreboard"} aria-label={title}>
      <div className="scoreboard__content">
        <p className="eyebrow">Eure Runde in Zahlen</p>
        <h2>{title}</h2>
        <ol className="scoreboard__list">
          {leaderboard(players).map(player => (
            <li key={player.id}>
              <span className="scoreboard__rank" data-rank={player.rank}>{player.rank}</span>
              <span className="scoreboard__name">{player.name}</span>
              <strong>{player.points || 0}<small> Punkte</small></strong>
              {onChangePoints && <div className="scoreboard__adjust"><button type="button" className="btn btn-quiet" aria-label={`${player.name}: einen Punkt hinzufügen`} onClick={() => onChangePoints(player.id, 1)}>+1</button><button type="button" className="btn btn-quiet" aria-label={`${player.name}: einen Punkt abziehen`} onClick={() => onChangePoints(player.id, -1)}>−1</button></div>}
            </li>
          ))}
        </ol>
        {onClose && <button type="button" className="btn btn-primary" onClick={onClose}>Schließen</button>}
        {children}
      </div>
    </section>
  );
}

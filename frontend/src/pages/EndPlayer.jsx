import { leaderboard } from "../lib/ranking";
export default function EndPlayer({ gameState }) {
  const players = leaderboard(gameState.players);

  return (
    <div className="text-white my-6 flex flex-col items-center">
      <h1 className="text-3xl font-bold mb-6">Endstand</h1>

      <ul className="text-xl space-y-2">
        {players.map((p) => (
          <li key={p.id}>
            {p.rank}. {p.name}: <b>{p.points} Punkte</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

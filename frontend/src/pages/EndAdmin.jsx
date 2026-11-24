import { leaderboard } from "../lib/ranking";
export default function EndAdmin({ gameState, socket }) {
  if (!gameState) {
    return <p>Lade Spielstand...</p>;
  }

  const players = leaderboard(gameState.players);

  return (
    <div className="flex flex-col items-center gap-4 w-full my-6">
      <h1 className="text-xl font-semibold mb-4">Punktestand</h1>

      <ul className="text-xl space-y-2">
        {players.map((p) => (
            <li key={p.id}>
              {p.rank}. {p.name}: <b>{p.points || 0} Punkte</b>
            </li>
          ))}
      </ul>

      <button
        onClick={() => {
          socket.emit("admin_action", { action: "lobby" });
        }}
        className="bg-blue-500 hover:bg-blue-600 px-6 py-3 rounded-lg font-bold"
      >
        Lobby
      </button>
    </div>
  );
}

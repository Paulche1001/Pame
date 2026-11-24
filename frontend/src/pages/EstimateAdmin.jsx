export default function EstimateAdmin({ gameState, socket, toggleLeaderboard }) {
  const revealed = gameState.revealed;


  {/*if (!gameState.mode) {
    return <p className="flex flex-col items-center text-white m-6 text-xl">Warte auf Benutzereingaben...</p>;
  }*/}

  return (
    <div className="flex flex-col  items-center text-white px-6 my-6 gap-6">

      <h2 className="text-3xl font-bold">Schätzfragen</h2>

      <div className="flex gap-4">
        {revealed && (
        <button
            onClick={() => toggleLeaderboard(true)}
            className="bg-yellow-500 hover:bg-yellow-600 px-4 py-2 rounded-lg font-bold"
        >
          Leaderboard
        </button>)}
        <button
          onClick={() => {
            const confirmLeave = window.confirm(
              "Willst du das Spiel wirklich verlassen?"
            );
            if (confirmLeave) {
              socket.emit("admin_action", { action: "lobby" });
            }
          }}
          className="bg-red-500 hover:bg-red-600 px-6 py-3 rounded-lg font-bold"
        >
          Verlassen
        </button>
      </div>


      {/* Frage anzeigen */}
      <div className="bg-gray-700 w-full max-w-xl p-6 rounded-xl shadow">
        <h3 className="text-xl font-semibold">Frage:</h3>
        <p className="text-pink-400 text-2xl mt-2">{gameState.question}</p>
      </div>

      {/* Korrekte Antwort */}
      <div className="bg-green-700 w-full max-w-xl p-6 rounded-xl shadow text-center">
        <h3 className="text-xl font-semibold mb-2">Richtige Antwort:</h3>
        <p className="text-3xl font-bold text-white">
          {gameState.correctAnswer != null
            ? Number(gameState.correctAnswer).toLocaleString('de-DE')
            : "-"}
        </p>

      </div>


      {/* Antworten anzeigen */}
      {gameState.answers && (
        <div className="bg-gray-700 w-full max-w-xl p-6 rounded-xl shadow">
          <h3 className="text-xl font-semibold mb-2">Antworten:</h3>

          {Object.keys(gameState.answers).length === 0 ? (
            <p className="text-gray-300">Noch keine Antworten</p>
          ) : (
            <ul className="space-y-2">
              {Object.entries(gameState.answers).map(([playerId, value]) => (
                <li
                  key={playerId}
                  className="flex justify-between bg-gray-600 px-4 py-2 rounded-lg"
                >
                  <span>{value.name}</span>
                  <span className="text-pink-300 font-bold">
                    {value.answer != null ? Number(value.answer).toLocaleString('de-DE') : '-'}
                  </span>

                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Buttons */}
      <div className="flex gap-4">
        {!revealed && (
          <button
            onClick={() => {
              socket.emit("admin_action", { action: "reveal" });
            }}
            className="bg-orange-500 hover:bg-orange-600 px-6 py-3 rounded-lg font-bold"
          >
            Antworten aufdecken
          </button>
        )}

        {revealed && (
          <button
            onClick={() => {
              socket.emit("admin_action", { action: "next" });
            }}
            className="bg-blue-500 hover:bg-blue-600 px-6 py-3 rounded-lg font-bold"
          >
            Nächste Frage
          </button>
        )}

      </div>
    </div>

  );
}

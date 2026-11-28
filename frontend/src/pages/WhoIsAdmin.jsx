export default function WhoIsAdmin({ gameState, socket, toggleLeaderboard}) {
  if (!gameState) return <p>Warte auf Spielstart...</p>;

  const { hintStep, buzzedPlayer, blockedPlayers } = gameState;



  return (
    <div className="round-content">


        <div className="flex gap-4">
            { hintStep == 4 && (
            <button
                onClick={() => toggleLeaderboard(true)}
                className="btn btn-secondary"
            >
                Rangliste
            </button>
            )}
            <button
            onClick={() => {
                const confirmLeave = window.confirm(
                "Willst du das Spiel wirklich verlassen?"
                );
                if (confirmLeave) {
                socket.emit("admin_action", { action: "lobby" });
                }
            }}
            className="btn btn-danger"
            >
            Verlassen
            </button>
        </div>

        <h1
            className={`text-xl font-bold ${
                gameState.hintStep === 4 ? "text-green-500" : "text-white"
            }`}
            >
            {gameState.title}
        </h1>

        {gameState.hints && (
        <div >
            <h2 className="text-xl font-bold mb-2">Alle Hinweise:</h2>
            <ol className="list-decimal ml-6 space-y-1">
                {gameState.hints.map((h, i) => (
                    <li
                    key={i}
                    className={i <= gameState.hintStep ? "text-white" : "text-gray-500"}
                    >
                    {h}
                    </li>
                ))}
            </ol>
        </div>)}


      {hintStep < 3 && (
        <button
          onClick={() => socket.emit("admin_action", "next_hint")}
          className="btn btn-game"
        >
          🔍 Nächster Hinweis
        </button>
      )}
      {hintStep == 3 && (
        <button
          onClick={() => socket.emit("admin_action", "next_hint")}
          className="btn btn-game"
        >
          Auflösen
        </button>
      )}
      {hintStep == 4 && (
        <button
          onClick={() => socket.emit("admin_action", "next_hint")}
          className="btn btn-game"
        >
          Nächste Person
        </button>
      )}

      {buzzedPlayer && (
        <div className="bg-gray-800 p-4 rounded-xl shadow-lg text-center">
          <h2 className="text-2xl text-green-400 font-bold mb-2">
            {buzzedPlayer.name} hat gebuzzert!
          </h2>

          <div className="flex gap-4 justify-center">
            <button
              onClick={() => socket.emit("admin_action", "correct")}
              className="btn btn-success"
            >
              ✔ Richtig
            </button>

            <button
              onClick={() => socket.emit("admin_action", "wrong")}
              className="btn btn-danger"
            >
              ✘ Falsch
            </button>
          </div>
        </div>
      )}

      {blockedPlayers?.length > 0 && (
        <div className="text-red-400 font-bold">
          Blockierte Spieler: {blockedPlayers.length}
        </div>
      )}

    </div>
  )}
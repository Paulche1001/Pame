export default function WhoIsAdmin({ gameState, socket, toggleLeaderboard}) {
  if (!gameState) return <p>Warte auf Spielstart...</p>;

  const { hintStep, buzzedPlayer, blockedPlayers } = gameState;

  const titleMap = {
    whois_emojis: "Wer wird gesucht? (Emojis)",
    guessthebeer: "Guess The Beer 🍺",
  };

  const headline = titleMap[gameState.variant] || "Wer wird gesucht?";

  return (
    <div className="flex flex-col items-center p-6 gap-6">
        <h1 className="text-3xl font-bold text-pink-600 text-center">
            {headline}
        </h1>

        <div className="flex gap-4">
            { hintStep == 4 && (
            <button
                onClick={() => toggleLeaderboard(true)}
                className="bg-yellow-500 hover:bg-yellow-600 px-4 py-2 rounded-lg font-bold"
            >
                Leaderboard
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
            className="bg-red-500 hover:bg-red-600 px-6 py-3 rounded-lg font-bold"
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
          className="bg-blue-600 px-6 py-3 rounded-xl font-bold hover:bg-blue-700 text-white"
        >
          🔍 Nächster Hinweis
        </button>
      )}
      {hintStep == 3 && (
        <button
          onClick={() => socket.emit("admin_action", "next_hint")}
          className="bg-blue-600 px-6 py-3 rounded-xl font-bold hover:bg-blue-700 text-white"
        >
          Auflösen
        </button>
      )}
      {hintStep == 4 && (
        <button
          onClick={() => socket.emit("admin_action", "next_hint")}
          className="bg-blue-600 px-6 py-3 rounded-xl font-bold hover:bg-blue-700 text-white"
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
              className="bg-green-600 px-6 py-3 rounded-xl"
            >
              ✔ Richtig
            </button>

            <button
              onClick={() => socket.emit("admin_action", "wrong")}
              className="bg-red-600 px-6 py-3 rounded-xl"
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
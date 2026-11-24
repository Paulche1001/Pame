

export default function PixelAdmin({ gameState, socket, toggleLeaderboard, timer}) {
  if (!gameState) return <p>Warte auf Spielstart...</p>;

  const { title, imageStep, buzzedPlayer, blockedPlayers } = gameState;





  return (
    <div className="flex flex-col items-center p-6 gap-6">
      <h1 className="text-3xl font-bold text-pink-600">
        Pixel Mode – {title}
      </h1>
      <div className="flex gap-4">
        { imageStep == 3 && (
          <button
            onClick={() => toggleLeaderboard(true)}
            className="bg-yellow-500 hover:bg-yellow-600 px-4 py-2 rounded-lg font-bold"
          >
            Leaderboard
          </button>
        )}

        {/* TIMER CONTAINER */}
        <div className="flex items-center justify-center">
          {timer === null ? (
            <button
              className="bg-green-500 hover:bg-green-600 px-4 py-2 rounded-lg font-bold"
              onClick={() => {
                const seconds = 5;
                if (seconds > 0) {
                  socket.emit("admin_start_timer", seconds);
                }
              }}
            >
              Timer starten
            </button>
          ) : (
            <p className="text-yellow-400 font-bold text-2xl">
              {timer}s
            </p>
          )}
        </div>

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

      <img
        key={gameState.image}
        src={gameState.image}
        alt="pixel"
        className="max-w-md w-full rounded-xl shadow-xl"
      />

      <p className="text-lg text-gray-300">
        Pixel-Level: <b>{(imageStep ?? 0) + 1} / 4</b>
      </p>

      {imageStep < 3 && (
        <button
          onClick={() => socket.emit("admin_action", "next_image")}
          className="bg-blue-600 px-6 py-3 rounded-xl font-bold hover:bg-blue-700 text-white"
        >
          🔍 Nächstes Pixel-Level
        </button>
      )}
      {imageStep == 3 && (
        <button
          onClick={() => socket.emit("admin_action", "next_image")}
          className="bg-blue-600 px-6 py-3 rounded-xl font-bold hover:bg-blue-700 text-white"
        >
          Nächstes Bild
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
  );
}

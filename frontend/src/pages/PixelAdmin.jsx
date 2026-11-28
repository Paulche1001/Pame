

export default function PixelAdmin({ gameState, socket, toggleLeaderboard, timer}) {
  if (!gameState) return <p>Warte auf Spielstart...</p>;

  const { title, imageStep, buzzedPlayer, blockedPlayers } = gameState;





  return (
    <div className="round-content">
      <p className="answer-preview">Gesuchtes Motiv: <strong>{title}</strong></p>
      <div className="flex gap-4">
        { imageStep == 3 && (
          <button
            onClick={() => toggleLeaderboard(true)}
            className="btn btn-secondary"
          >
            Rangliste
          </button>
        )}

        {/* TIMER CONTAINER */}
        <div className="flex items-center justify-center">
          {timer === null ? (
            <button
              className="btn btn-success"
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
          className="btn btn-danger"
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
          className="btn btn-game"
        >
          🔍 Nächstes Pixel-Level
        </button>
      )}
      {imageStep == 3 && (
        <button
          onClick={() => socket.emit("admin_action", "next_image")}
          className="btn btn-game"
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
  );
}

export default function WhatIsAdmin({ gameState, socket, toggleLeaderboard, timer}) {
  if (!gameState) return <p>Warte...</p>;

  const {
    screen,
    question,
    answers,
    votes = {},
    players,
    revealedAnswers
  } = gameState;

  // Anzahl der Spieler, die schon gewählt haben
  const numVoted = Object.keys(votes).length;
  const totalPlayers = players.length;

  return (
    <div className="p-6 text-center flex flex-col gap-6 items-center">
      <h1 className="text-3xl font-bold text-pink-500">What Is? — Admin</h1>
      <h2 className="text-xl font-bold">{question}</h2>

      <div className="flex gap-4">

        <button
          onClick={() => toggleLeaderboard(true)}
          className="bg-yellow-500 hover:bg-yellow-600 px-4 py-2 rounded-lg font-bold"
        >
          Leaderboard
        </button>

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

      {/* PHASE 1: Fake Antworten */}
      {screen === "fake" && (
        <>
          <p>Spieler schreiben Antworten...</p>
          <div className="w-full max-w-md text-left bg-gray-900 p-3 rounded">
            {Object.values(answers).length === 0 && (
              <p className="text-gray-500 text-sm">Noch keine Antworten</p>
            )}

            {Object.values(answers).map((a, i) => (
              <p key={i} className="text-sm text-gray-300">
                • {a.answer} — <span className="text-gray-400">{players.find(p => p.id === a.author)?.name}</span>
              </p>
            ))}
          </div>

          <p className="text-gray-400 text-sm mt-2">
            {numVoted}/{totalPlayers} Spieler haben bisher gewählt
          </p>

          <button
            className="bg-yellow-400 px-4 py-2 rounded text-black font-bold mt-2"
            onClick={() => socket.emit("admin_action", { action: "reveal" })}
          >
            Voting starten
          </button>
        </>
      )}

      {/* PHASE 2: Voting + Reveal */}
      {screen === "select" && (
        <div className="flex flex-col gap-4 w-full max-w-md">
          {Object.entries(answers).map(([id, a]) => {
            const isRevealed = revealedAnswers[id];
            const isCorrect = id === gameState.correctAnswerId;

            const voters = Object.entries(votes)
              .filter(([, v]) => v === id)
              .map(([pid]) => players.find(p => p.id === pid)?.name)
              .filter(Boolean);

            return (
              <div
                key={id}
                onClick={() =>
                  socket.emit("admin_action", {
                    action: "reveal_answer",
                    answerId: id
                  })
                }
                className={`p-3 rounded border cursor-pointer transition
                  ${!isRevealed ? "bg-gray-800" : ""}
                  ${isRevealed && isCorrect ? "bg-green-600" : ""}
                  ${isRevealed && !isCorrect ? "bg-gray-700" : ""}
                `}
              >
                <p className="font-bold">{a.answer}</p>

                <p className="text-sm mt-1">
                  {isCorrect ? "✔ Richtige Antwort" : "von " + players.find(p => p.id === a.author)?.name}
                </p>

                {voters.length > 0 && (
                  <p className="text-sm mt-1">
                    Gewählt von: {voters.join(", ")} <br />
                  </p>
                )}

              </div>
            );
          })}

          <p className="text-gray-400 text-sm mt-2">
            {numVoted}/{totalPlayers} Spieler haben bisher gewählt
          </p>

          <button
            className="bg-pink-500 px-6 py-3 rounded mt-4 font-bold"
            onClick={() => socket.emit("admin_action", { action: "next" })}
          >
            Nächste Frage
          </button>
        </div>
      )}
    </div>
  );
}

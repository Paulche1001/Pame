

export default function SLFAdmin({ gameState, socket, toggleLeaderboard }) {
  if (!gameState) return <p>Warte...</p>;

  const {
    screen,
    letter,
    categories = [],
    submissions = {},
    reviewIndex = 0,
    currentCategory,
    marks = {},
    round,
    maxRounds,
    locked,
    firstFinishPlayerId,
    lockAt,
    players = []
  } = gameState;

  const subsList = players.map((p) => {
      const sub = submissions[p.id];
      return {
        id: p.id,
        name: p.name,
        finished: !!sub?.finished,
        answers: sub?.answers || {}
      };
    });

  const finCount = subsList.filter(x => x.finished).length;

  const getMark = (cat, pid) => marks?.[cat]?.[pid] || "pending";

  const markClass = (m) => {
    if (m === "correct") return "bg-green-600";
    if (m === "dup") return "bg-orange-500";
    return "bg-red-600";
  };


  const remaining = gameState.graceRemaining;
  const firstName = firstFinishPlayerId ? players.find(p => p.id === firstFinishPlayerId)?.name : null;

  return (
    <div className="round-content">


      <div className="text-gray-200">
        <p className="font-bold text-xl">Runde {round}/{maxRounds}</p>
        <p className="text-2xl mt-2">Buchstabe: <span className="text-yellow-400 font-extrabold">{letter}</span></p>
      </div>

      <div className="flex gap-4 flex-wrap justify-center">
        <button
          onClick={() => toggleLeaderboard(true)}
          className="btn btn-secondary"
        >
          Rangliste
        </button>

        {!locked ? (
          <button
            onClick={() => socket.emit("admin_action", { action: "slf_lock" })}
            className="btn btn-game"
          >
            Eingabe stoppen
          </button>
        ) : null}

        <button
          onClick={() => {
            const confirmLeave = window.confirm("Willst du das Spiel wirklich verlassen?");
            if (confirmLeave) socket.emit("admin_action", { action: "lobby" });
          }}
          className="btn btn-danger"
        >
          Verlassen
        </button>

        {screen === "input" && !locked && (
            <button
                onClick={() => socket.emit("admin_action", { action: "slf_reroll" })}
                className="btn btn-secondary"
            >
                Buchstabe neu würfeln
            </button>
        )}


      </div>

      {/* INPUT PHASE */}
      {screen === "input" && (
        <div className="w-full max-w-2xl flex flex-col gap-4">
          <p className="text-gray-300">
            Spieler schreiben… <span className="font-bold">{finCount}/{players.length}</span> fertig.
          </p>

          {lockAt && (
            <p className="text-yellow-400 font-bold text-xl">
              {firstName ? `${firstName} hat auf Fertig geklickt.` : "Jemand hat auf Fertig geklickt."} Noch {remaining}s…
            </p>
          )}

          <div className="w-full bg-gray-900 rounded p-4 text-left">
            <p className="font-bold mb-2">Kategorien:</p>
            <ul className="list-disc ml-5">
              {categories.map((c) => <li key={c}>{c}</li>)}
            </ul>
          </div>
        </div>
      )}

      {/* REVIEW PHASE */}
      {screen === "review" && (
        <div className="w-full max-w-2xl flex flex-col gap-4">
          <h2 className="text-2xl font-bold">
            Auswertung: {currentCategory} ({reviewIndex + 1}/{categories.length})
          </h2>

          <div className="w-full flex flex-col gap-3">
            {subsList.map((p) => {
              const ans = (p.answers?.[currentCategory] || "").trim();
              const m = getMark(currentCategory, p.id);

              return (
                <div key={p.id} className="w-full bg-gray-800 rounded-xl p-3 flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                    <p className="font-bold">{p.name}</p>
                    <span className={`text-white text-sm px-2 py-1 rounded ${markClass(m)}`}>
                      {m === "correct" ? "Richtig (2)" : m === "dup" ? "Doppelt (1)" : "Falsch (0)"}
                    </span>
                  </div>

                  <p className="text-xl text-gray-100">
                    {ans ? ans : <span className="text-gray-500">—</span>}
                  </p>

                  <div className="flex gap-2 justify-center pt-2">
                    <button
                      className="btn btn-danger"
                      onClick={() => socket.emit("admin_action", { action: "slf_mark", category: currentCategory, playerId: p.id, mark: "wrong" })}
                    >
                      0
                    </button>
                    <button
                      className="btn btn-game"
                      onClick={() => socket.emit("admin_action", { action: "slf_mark", category: currentCategory, playerId: p.id, mark: "dup" })}
                    >
                      1
                    </button>
                    <button
                      className="btn btn-success"
                      onClick={() => socket.emit("admin_action", { action: "slf_mark", category: currentCategory, playerId: p.id, mark: "correct" })}
                    >
                      2
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex gap-3 justify-center flex-wrap pt-2">
            <button
              className="btn btn-secondary"
              onClick={() => socket.emit("admin_action", { action: "slf_prev_category" })}
              disabled={reviewIndex === 0}
            >
              ← Zurück
            </button>

            {reviewIndex < categories.length - 1 ? (
              <button
                className="btn btn-game"
                onClick={() => socket.emit("admin_action", { action: "slf_next_category" })}
              >
                Nächste Kategorie →
              </button>
            ) : (
              <>
                <button
                  className="btn btn-game"
                  onClick={() => socket.emit("admin_action", { action: "slf_next_round" })}
                >
                  Nächste Runde
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

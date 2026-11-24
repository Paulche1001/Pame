import { useMemo, useState } from "react";

export default function SLFPlayer({ gameState, socket, playerId }) {
  const {
    screen,
    letter,
    categories = [],
    submissions = {},
    locked,
    lockAt,
    players = [],
    currentCategory,
    marks,
  } = gameState;

  const existing = submissions?.[playerId]?.answers || {};
  const iAmFinished = !!submissions?.[playerId]?.finished;

  const [localAnswers, setLocalAnswers] = useState(() => Object.fromEntries(categories.map(c => [c, existing[c] || ""])));

  const finishedCount = useMemo(() => {
    return Object.values(submissions || {}).filter((s) => s?.finished).length;
  }, [submissions]);

  // ✅ make countdown tick by forcing rerender
  const remaining = gameState.graceRemaining;

  const submitDraft = (next) => {
    socket.emit("player_action", {
      action: "slf_submit",
      playerId,
      answers: next,
    });
  };

  const onChange = (cat, value) => {
    const next = { ...localAnswers, [cat]: value };
    setLocalAnswers(next);
    if (!locked && !iAmFinished) submitDraft(next); // autosave
  };

  // =========================
  // REVIEW SCREEN (players see admin decisions live)
  // =========================
  if (screen === "review") {
    const cat = currentCategory;
    const byCat = (marks || {})?.[cat] || {};

    const getMarkLabel = (m) => {
      if (m === "correct") return "✅ 2";
      if (m === "dup") return "🟧 1";
      if (m === "wrong") return "❌ 0";
      return "⏳ …";
    };

    const getMarkClass = (m) => {
      if (m === "correct") return "bg-green-700";
      if (m === "dup") return "bg-orange-600";
      if (m === "wrong") return "bg-red-700";
      return "bg-gray-700";
    };

    return (
      <div className="p-4 text-center flex flex-col justify-center min-h-[50vh] gap-4 items-center">
        <h1 className="text-2xl font-bold">Stadt–Land–Fluss</h1>
        <p className="text-gray-300 font-semibold">Auswertung läuft…</p>

        <div className="w-full max-w-md bg-gray-800 rounded-xl p-4 text-left">
          <p className="text-lg font-bold mb-3">
            Kategorie: <span className="text-yellow-300">{cat}</span>
          </p>

          <div className="flex flex-col gap-2">
            {players.map((p) => {
              const val = submissions?.[p.id]?.answers?.[cat] || "";
              const mark = byCat?.[p.id] || "pending";

              return (
                <div
                  key={p.id}
                  className={`p-3 rounded-lg flex items-center justify-between gap-3 ${getMarkClass(
                    mark
                  )}`}
                >
                  <div className="flex flex-col">
                    <span className="font-bold">{p.name}</span>
                    <span className="text-sm opacity-90">
                      {val?.trim() ? val : "—"}
                    </span>
                  </div>

                  <span className="font-bold">{getMarkLabel(mark)}</span>
                </div>
              );
            })}
          </div>

          <p className="text-gray-400 text-sm mt-4">
            Fertig: {finishedCount}/{players.length}
          </p>
        </div>

        <p className="text-gray-500 text-sm">
          Admin klickt gerade durch die Kategorien – du siehst die Bewertung live.
        </p>
      </div>
    );
  }

  // =========================
  // INPUT SCREEN
  // =========================
  return (
    <div className="p-4 text-center flex flex-col gap-4 min-h-[50vh] items-center">
      <h1 className="text-2xl font-bold">Stadt–Land–Fluss</h1>
      <p className="text-xl">
        Buchstabe: <span className="text-yellow-400 font-extrabold">{letter}</span>
      </p>

      {lockAt && !locked && (
        <p className="text-yellow-400 font-bold text-xl">Noch {remaining}s…</p>
      )}

      <div className="w-full flex flex-col gap-3">
        {categories.map((cat) => (
          <div key={cat} className="w-full bg-gray-800 rounded-xl p-3 text-left">
            <p className="font-bold mb-2">{cat}</p>
            <input
              value={localAnswers[cat] ?? ""}
              disabled={locked || iAmFinished}
              onChange={(e) => onChange(cat, e.target.value)}
              className="w-full p-2 rounded bg-gray-900 border border-gray-600"
              placeholder={`${cat} mit ${letter}...`}
            />
          </div>
        ))}
      </div>

      {!locked && !iAmFinished ? (
        <button
          className="bg-pink-600 hover:bg-pink-700 px-6 py-3 rounded-lg font-bold w-full"
          onClick={() => {
            socket.emit("player_action", {
              action: "slf_finish",
              playerId,
              answers: localAnswers,
            });
          }}
        >
          Fertig
        </button>
      ) : (
        <p className="text-gray-300 font-semibold">
          {locked ? "Zeit vorbei – warten…" : "Du bist fertig – warten…"}
        </p>
      )}

      <p className="text-gray-500 text-sm">
        Fertig: {finishedCount}/{players.length}
      </p>
    </div>
  );
}

import { useState } from "react";
import { rankBy } from "../lib/ranking";

export default function EstimatePlayer({ gameState, socket, playerId }) {
  const [answer, setAnswer] = useState(() => gameState.answers?.[playerId]?.answer ?? "");
  const [submitted, setSubmitted] = useState(() => !!gameState.answers?.[playerId]);
  // Zeigt die Frage
  if (gameState.screen === "question") {
    return (
      <div className="flex flex-col items-center gap-4 m-6 justify-center min-h-[50vh] text-white">
        <h2 className="text-2xl text-center font-bold">{gameState.question}</h2>

        {/* Werte eingeben */}
        <input
          type="number"
          value={answer}
          onChange={(e) => {
            setAnswer(e.target.value);
            setSubmitted(false);
          }}
          className="p-3 border rounded-lg text-white"
        />

        {/* Wert Einloggen */}
        <button
          onClick={() => {
            socket.emit("player_action", {
              action: "answer",
              playerId,
              value: Number(answer)
            });

            setSubmitted(true);
          }}
          className={`px-4 py-2 rounded-lg text-white ${submitted ? "bg-gray-500" : "bg-blue-500"}`}
          disabled={submitted || String(answer).trim() === "" || !Number.isFinite(Number(answer))}
        >
          Einloggen
        </button>
      </div>
    );
  }

  // Antwort zeigen
  if (gameState.screen === "results") {
    return (
      <div className="text-white flex flex-col m-6 justify-center min-h-[50vh]">
        <h2 className="flex flex-col items-center text-2xl font-bold">Ergebnisse</h2>

        <ul className="text-xl mt-4">
          {rankBy(Object.entries(gameState.answers || {}).map(([id, obj]) => ({ ...obj, id })), entry => Math.abs(entry.answer - gameState.correctAnswer), 1).map((obj) => {
              return (
                <li key={obj.id} className="py-1">
                  {obj.rank}. {obj.name}: <b className="text-pink-400">{obj.answer != null ? Number(obj.answer).toLocaleString("de-DE") : "-"}</b>
                </li>
              );
            })}
        </ul>

        <div className="flex flex-col items-center mt-6 p-4 bg-green-600 rounded-lg">
          <h3 className="text-lg">Richtige Antwort:</h3>
          <h3 className="text-3xl font-bold">{Number(gameState.correctAnswer).toLocaleString("de-DE")}</h3>
        </div>
      </div>
    );
  }

  return null;
}

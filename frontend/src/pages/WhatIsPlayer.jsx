import { useState } from "react";

export default function WhatIsPlayer({ gameState, socket, playerId, timer }) {
  const [input, setInput] = useState("");



  if (!gameState) return <p>...</p>;

  const { screen, question, answers, revealedAnswers, votes, players } = gameState;
  const hasRevealStarted = Object.keys(revealedAnswers || {}).length > 0;
  const hasSubmitted = answers?.[playerId] !== undefined;

  const selectedAnswer = votes?.[playerId];
  const shuffledAnswers = Object.entries(answers || {});

  /* Fake Antwort */
  if (screen === "fake") {
    return (
      <div className="p-4 text-center flex flex-col justify-center min-h-[50vh]">
        <h1 className="text-2xl mb-4">Was ist?</h1>
        <p className="mb-4">{question}</p>

        {timer !== null && (
          <p className="text-yellow-400 font-bold text-xl mb-3">
            ⏳ Zeit: {timer}s
          </p>
        )}

        {!hasSubmitted ? (
          <div className="flex flex-col items-center gap-2">
            <input
              className="p-2 bg-gray-800 rounded w-64"
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />

            <button
              disabled={!input.trim()}
              className="bg-pink-500 px-4 py-2 mt-4 rounded font-bold"
              onClick={() => {
                socket.emit("player_action", {
                  action: "submit_fake",
                  playerId,
                  value: input
                });
                setInput("");
              }}
            >
              Abschicken
            </button>
          </div>
        ) : (
          <p className="text-gray-300 font-semibold">Warte bis alle etwas eingegeben haben...</p>
        )}

      </div>
    );
  }

 /* Voting + Reveal */
  if (screen === "select") {
    return (
      <div className="p-4 text-center flex flex-col justify-center min-h-[50vh]">
        {!hasRevealStarted && <h1 className="text-xl mb-4">Welche Antwort ist richtig?</h1>}
        {hasRevealStarted && <h1 className="text-xl mb-4">Abstimmung beendet</h1>}

        <p className="mb-4">{question}</p>

        {timer !== null && (
          <p className="text-yellow-400 font-bold text-xl mb-3">⏳ Zeit: {timer}s</p>
        )}

        {shuffledAnswers.map(([id, a]) => {
          const isRevealed = revealedAnswers[id];
          const isCorrect = id === gameState.correctAnswerId;
          const voters = Object.entries(votes || {})
            .filter(([, v]) => v === id)
            .map(([pid]) => players.find(p => p.id === pid)?.name)
            .filter(Boolean);

          return (
            <button
              key={id}
              disabled={hasRevealStarted}
              className={`
                w-full mb-2 px-4 py-2 rounded transition
                ${!isRevealed ? "bg-gray-800" : ""}
                ${isRevealed && isCorrect ? "bg-green-600" : ""}
                ${isRevealed && !isCorrect ? "bg-gray-700" : ""}
                ${selectedAnswer === id ? "border-2 border-pink-500" : "border border-transparent"}
                ${hasRevealStarted ? "opacity-80 cursor-not-allowed" : ""}
              `}
              onClick={() => {
                if (hasRevealStarted) return;
                socket.emit("player_action", {
                  action: "select_answer",
                  playerId,
                  value: id
                });
              }}
            >
              <p className="font-bold">{String(a.answer).toUpperCase()}</p>

              {isRevealed && (
                <div className="text-sm mt-1 text-gray-200">
                  {isCorrect ? <p>✔ Richtige Antwort</p> : <p>von {players.find(p => p.id === a.author)?.name}</p>}
                  {voters.length > 0 && <p className="mt-1">Gewählt von: {voters.join(", ")}</p>}
                </div>
              )}
            </button>
          );
        })}
      </div>
    );
  }
}
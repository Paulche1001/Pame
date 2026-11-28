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
      <div className="round-content">
        <h3>Erfinde eine überzeugende Antwort</h3>
        <p className="question-text">{question}</p>

        {timer !== null && (
          <p className="text-yellow-400 font-bold text-xl mb-3">
            ⏳ Zeit: {timer}s
          </p>
        )}

        {!hasSubmitted ? (
          <div className="flex flex-col items-center gap-2">
            <input aria-label="Deine Antwort"
              className="p-2 bg-gray-800 rounded w-64"
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />

            <button
              disabled={!input.trim()}
              className="btn btn-game"
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
          <p className="text-gray-300 font-semibold">Antwort gesendet. Warte auf die Abstimmung.</p>
        )}

      </div>
    );
  }

 /* Voting + Reveal */
  if (screen === "select") {
    return (
      <div className="round-content">
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
              className={`answer-option mb-3 ${isRevealed && isCorrect ? "answer-option--correct" : ""}`} aria-pressed={selectedAnswer === id}
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
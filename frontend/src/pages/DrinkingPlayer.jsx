import { useState } from "react";
import DrinkingRound from "../components/DrinkingRound";

export default function DrinkingPlayer({ gameState, socket, playerId }) {
  const currentPlayer = gameState.players?.find(player => player.id === playerId);
  const participantName = currentPlayer?.name;
  const [answer, setAnswer] = useState(() => gameState.playerEstimates?.[participantName] ?? "");
  const [submitted, setSubmitted] = useState(() => Object.hasOwn(gameState.playerEstimates || {}, participantName));

  return <DrinkingRound
    gameState={gameState}
    participantName={participantName}
    answer={answer}
    submitted={submitted}
    onAnswerChange={value => { setAnswer(value); setSubmitted(false); }}
    onSubmit={() => {
      socket.emit("player_action", { action: "schaetz_wert", schaetzerName: participantName, value: answer === "" ? null : Number(answer) });
      setSubmitted(true);
    }}
    onSelect={value => socket.emit("player_action", { action: "select_player", voterName: participantName, value })}
  />;
}

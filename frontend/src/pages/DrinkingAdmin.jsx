import { useState } from "react";
import DrinkingRound from "../components/DrinkingRound";

export default function DrinkingAdmin({ gameState, socket }) {
  const { adminName, playerEstimates } = gameState;
  const [answer, setAnswer] = useState(() => playerEstimates?.[adminName] ?? "");
  const [submitted, setSubmitted] = useState(() => Object.hasOwn(playerEstimates || {}, adminName));

  return <DrinkingRound
    gameState={gameState}
    participantName={adminName}
    answer={answer}
    submitted={submitted}
    onAnswerChange={value => { setAnswer(value); setSubmitted(false); }}
    onSubmit={() => {
      socket.emit("admin_action", { action: "schaetz_wert", value: answer === "" ? null : Number(answer) });
      setSubmitted(true);
    }}
    onSelect={value => socket.emit("admin_action", { action: "select_player", value })}
    onLeave={() => {
      if (window.confirm("Willst du das Spiel wirklich verlassen?")) socket.emit("admin_action", { action: "lobby" });
    }}
    onReveal={() => socket.emit("admin_action", { action: "reveal_question" })}
    onNext={() => socket.emit("admin_action", { action: "next_question" })}
  />;
}

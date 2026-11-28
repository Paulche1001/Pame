import Scoreboard from "../components/Scoreboard";
export default function EndPlayer({ gameState }) {
  if (!gameState) return <p role="status">Lade Spielstand …</p>;
  return <Scoreboard title="Endstand" players={gameState.players || []} />;
}

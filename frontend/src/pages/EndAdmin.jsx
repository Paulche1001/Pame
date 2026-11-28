import Scoreboard from "../components/Scoreboard";
export default function EndAdmin({ gameState, socket }) {
  if (!gameState) return <p role="status">Lade Spielstand …</p>;
  return <Scoreboard title="Punktestand" players={gameState.players || []}><button className="btn btn-primary" onClick={() => socket.emit("admin_action", { action: "lobby" })}>Lobby</button></Scoreboard>;
}

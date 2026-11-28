import GameSymbol from "./GameSymbol";
import { gameDefinition } from "../lib/games";

export default function RoundFrame({ gameState, role, children }) {
  const game = gameDefinition(gameState);
  if (!game || gameState.screen === "end") return children;
  let progress = role === "host" ? "Spielleiter" : "Du spielst mit";
  if (gameState.round && gameState.maxRounds) progress = `Runde ${gameState.round} von ${gameState.maxRounds}`;
  else if (game.id === "pixel") progress = `Bildstufe ${Math.min((gameState.imageStep ?? 0) + 1, 4)} von 4`;
  else if (game.id === "whois") progress = gameState.hintStep >= 4 ? "Auflösung" : `Hinweis ${(gameState.hintStep ?? 0) + 1} von 4`;
  else if (gameState.screen === "results") progress = "Ergebnis";
  else if (gameState.screen === "selection_screen" || gameState.screen === "select") progress = "Abstimmung";
  return (
    <section className="game-surface" data-game={game.id} style={{ "--game-accent": game.color }}>
      <header className="round-heading">
        <div className="round-heading__title"><GameSymbol type={game.symbol} /><h2>{game.title}</h2></div>
        <span className="round-progress">{progress}</span>
      </header>
      {children}
    </section>
  );
}

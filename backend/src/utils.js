function shuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
function integer(value, fallback, min, max) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, Math.floor(number))) : fallback;
}
function publicPlayers(players) {
  return players.map(({ id, name, points }) => ({ id, name, points: points || 0 }));
}
function finiteAnswer(value) {
  return (typeof value === "number" || typeof value === "string") &&
    String(value).trim() !== "" && Number.isFinite(Number(value));
}
module.exports = { shuffle, integer, publicPlayers, finiteAnswer };

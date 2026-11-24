export function rankBy(items, score, direction = -1) {
  const sorted = [...items].sort((a, b) => direction * (score(a) - score(b)));
  return sorted.map((item, index) => ({
    ...item,
    rank: index > 0 && score(sorted[index - 1]) === score(item)
      ? sorted.findIndex(previous => score(previous) === score(item)) + 1
      : index + 1,
  }));
}

export function leaderboard(players = []) {
  return rankBy(players, player => player.points || 0);
}

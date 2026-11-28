export const games = [
  { id: "estimate", title: "Schätzfragen", description: "Wie nah liegt ihr dran? Schätzt Zahlen und sammelt Punkte.", color: "#6BE4D7", symbol: "estimate", label: "Zahlengefühl gefragt" },
  { id: "pixel", title: "Pixelraten", description: "Ein Bild, immer mehr Details. Wer erkennt das Motiv zuerst?", color: "#B8A1FF", symbol: "pixel", label: "Bild für Bild" },
  { id: "whois", title: "Who Is?", description: "Löst Hinweise und Emojis – oder erkennt das gesuchte Bier.", color: "#FFBF70", symbol: "whois", label: "Auf die Hinweise achten" },
  { id: "whatis", title: "What Is?", description: "Erfindet überzeugende Antworten und findet die richtige.", color: "#8AC8FF", symbol: "whatis", label: "Gut geblufft?" },
  { id: "slf", title: "Stadt–Land–Fluss", description: "Ein Buchstabe, eure Kategorien. Wer ist zuerst fertig?", color: "#B9E77F", symbol: "slf", label: "Schnell denken" },
  { id: "imposter", title: "Imposter", description: "Nicht jeder kennt das Wort. Entlarvt die falsche Fährte.", color: "#FF909F", symbol: "imposter", label: "Wem vertraut ihr?" },
  { id: "drinking", title: "DrinkGame", description: "Gemeinsame Aufgaben, Abstimmungen und Schätzrunden.", color: "#FFACD5", symbol: "drinking", label: "Für eure Runde" },
  { id: "test", title: "Testmodus", description: "Probiert eure Verbindung im gemeinsamen Chat aus.", color: "#B8B0CC", symbol: "test", label: "Kurz ausprobieren" },
];

export function gameDefinition(state) {
  const game = games.find(item => item.id === state?.mode);
  if (game?.id === "whois" && state.variant === "guessthebeer") return { ...game, title: "Guess the Beer" };
  return game;
}

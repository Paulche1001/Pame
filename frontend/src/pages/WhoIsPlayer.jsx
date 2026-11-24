

export default function WhoIsPlayer({ gameState, socket, playerId }) {


  const { hintStep, buzzedPlayer, blockedPlayers } = gameState;

  const iAmBlocked = blockedPlayers?.includes(playerId);
  const someoneBuzzed = !!buzzedPlayer;
  const iAmBuzzed = buzzedPlayer?.id === playerId;

  const titleMap = {
    whois_emojis: "Wer wird gesucht? (Emojis)",
    guessthebeer: "Guess The Beer 🍺",
    };

    const headline = titleMap[gameState.variant] || "Wer wird gesucht?";




  const handleBuzz = () => {
    if (iAmBlocked || someoneBuzzed) return;

    socket.emit("player_action", {
        action: "buzz",
        playerId: playerId
    });



  };
    return (
        <div className="w-full flex flex-col justify-center min-h-[50vh] items-center mt-6">

            <h1 className="text-3xl font-bold text-pink-600 text-center">
                {headline}
            </h1>

            {gameState.hints && (
            <div >
                <h2 className="text-2xl text-center font-bold my-2">{gameState.hintStep === 4 ? gameState.title : "???"}</h2>
                <ol className="list-decimal ml-6 mb-5 text-xl space-y-1">
                    {gameState.hints.map((h, i) => (
                        <li
                        key={i}
                        className={i <= gameState.hintStep ? "text-white" : "invisible"}
                        >
                        {h}
                        </li>
                    ))}
                </ol>
            </div>)}

            {iAmBuzzed && (
                <p className="text-green-500 font-bold text-xl">
                Du hast gebuzzert!
                </p>
            )}

            {someoneBuzzed && !iAmBuzzed && (
                <p className="text-pink-500 font-bold text-xl">
                {buzzedPlayer.name} hat gebuzzert!
                </p>
            )}

            {iAmBlocked && (
                <p className="text-red-500 font-bold">
                Du bist für dieses Bild gesperrt.
                </p>
            )}

            {!someoneBuzzed && !iAmBlocked && hintStep < 4 && (
                <button
                onClick={handleBuzz}
                className="bg-pink-600 text-white py-3 px-6 rounded-xl text-xl font-bold shadow-lg"
                >
                BUZZ!
                </button>
            )}
        </div>
    );
}
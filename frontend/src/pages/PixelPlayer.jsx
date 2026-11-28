

export default function PixelPlayer({ gameState, socket, playerId, timer }) {


  const { image, imageStep, buzzedPlayer, blockedPlayers } = gameState;

  const iAmBlocked = blockedPlayers?.includes(playerId);
  const someoneBuzzed = !!buzzedPlayer;
  const iAmBuzzed = buzzedPlayer?.id === playerId;



  const handleBuzz = () => {
    if (iAmBlocked || someoneBuzzed) return;

    socket.emit("player_action", {
      action: "buzz",
      playerId: playerId
    });





  };

  return (
    <div className="round-content">

      {timer !== null && (
          <p className="text-yellow-400 font-bold text-xl mb-3">
            ⏳ Zeit: {timer}s
          </p>
        )}

      <img alt="Verpixeltes Rätselbild" src={image} className="max-h-[50vh] w-auto rounded-xl mb-6" />

      {iAmBuzzed && (
        <p className="text-green-500 font-bold text-xl">
          Du hast gebuzzert!
        </p>
      )}

      {someoneBuzzed && !iAmBuzzed && (
        <p className="text-white font-bold text-xl">
          {buzzedPlayer.name} hat gebuzzert!
        </p>
      )}

      {iAmBlocked && (
        <p className="text-red-500 font-bold">
          Du bist für dieses Bild gesperrt.
        </p>
      )}

      {!someoneBuzzed && !iAmBlocked && imageStep < 3 && (
        <button
          onClick={handleBuzz}
          className="btn btn-game"
        >
          BUZZ!
        </button>
      )}
    </div>
  );
}

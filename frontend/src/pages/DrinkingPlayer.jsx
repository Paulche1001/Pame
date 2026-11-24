import { useMemo, useState } from "react";

export default function DrinkingPlayer({ gameState, socket, playerId }) {
    const {
        taskName,
        questKind,
        allPlayer,
        voted,
        players,
        selectedPlayers,
        topPlayers,
        playerEstimates,
        allEstimated,
        estimateRanking,
        correctAnswer,
        sips,
    } = gameState;

    const [answer, setAnswer] = useState(() => playerEstimates?.[players.find(p => p.id === playerId)?.name] ?? "");
    const [submitted, setSubmitted] = useState(() => Object.hasOwn(playerEstimates || {}, players.find(p => p.id === playerId)?.name));

    const currentPlayer = useMemo(() => {
        return players?.find((player) => player.id === playerId);
    }, [players, playerId]);

return (
        <div className="flex flex-col justify-center items-center text-center min-h-[60vh] p-6">
            <h1 className="text-2xl">{taskName}</h1>

            {questKind === "werwuerde" && (
                <div>
                    {!voted ? (
                        <div>
                            <p className="text-xl mb-4">
                                ({Object.keys(selectedPlayers || {}).length} / {allPlayer?.length})
                            </p>

                            {allPlayer?.length > 0 && (
                                <ul className="w-full">
                                    {allPlayer.map((name) => {
                                        return (
                                            <li key={name} className="flex items-center w-full text-2xl mt-3 gap-4">
                                                <span className="flex-1 text-left">{name}</span>

                                                <input
                                                    type="radio"
                                                    name="player"
                                                    checked={selectedPlayers?.[currentPlayer?.name] === name}
                                                    onChange={() => {
                                                        socket.emit("player_action", {
                                                            action: "select_player",
                                                            voterName: currentPlayer?.name,
                                                            value: name,
                                                        });
                                                    }}
                                                    className="scale-150"
                                                />
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>
                    ) : (
                        <div>
                            {topPlayers?.length > 0 ? (
                                <div>
                                    <h3 className="text-2xl">
                                        {topPlayers.length === 1
                                            ? `${topPlayers[0]} muss ${sips} ${sips === 1 ? "Schluck" : "Schlücke"} trinken!`
                                            : `${topPlayers.slice(0, -1).join(", ")} und ${topPlayers.slice(-1)} müssen ${sips} ${sips === 1 ? "Schluck" : "Schlücke"} trinken!`}
                                    </h3>
                                </div>
                            ) : (
                                <p>Niemand wurde gewählt.</p>
                            )}
                        </div>
                    )}
                </div>
            )}

            {questKind === "schaetz" && (
                <div className="flex flex-col gap-4 items-center w-full">
                    {!allEstimated && !voted ? (
                        <>
                            <p className="text-xl">
                                ({Object.keys(playerEstimates || {}).length} / {allPlayer?.length})
                            </p>

                            <input
                                type="number"
                                value={answer}
                                onChange={(e) => {
                                    setAnswer(e.target.value);
                                    setSubmitted(false);
                                }}
                                className="p-3 border rounded-lg text-white"
                            />

                            <button
                                onClick={() => {
                                    socket.emit("player_action", {
                                        action: "schaetz_wert",
                                        schaetzerName: currentPlayer?.name,
                                        value: answer === "" ? null : Number(answer),
                                    });

                                    setSubmitted(true);
                                }}
                                className={`px-4 py-2 rounded-lg text-white ${
                                    submitted ? "bg-gray-500" : "bg-blue-500"
                                }`}
                                disabled={submitted || answer === ""}
                            >
                                Absenden
                            </button>
                        </>
                    ) : (
                        <div className="w-full max-w-2xl flex flex-col gap-4">
                            <h2 className="text-2xl font-bold pt-3 text-green-600">
                                Richtige Antwort: {correctAnswer}
                            </h2>

                            {estimateRanking?.length > 0 ? (
                                <>
                                    <div className="text-lg">
                                        <p>
                                            <strong>{estimateRanking[0]?.name}</strong> darf {sips} {sips === 1 ? "Schluck" : "Schlücke"} verteilen!
                                        </p>
                                        <p>
                                            <strong>{estimateRanking[estimateRanking.length - 1]?.name}</strong> muss {sips} {sips === 1 ? "Schluck" : "Schlücke"} trinken!
                                        </p>
                                    </div>

                                    <ul className="w-full flex flex-col gap-2">
                                        {estimateRanking.map((entry, index) => (
                                            <li
                                                key={entry.name}
                                                className="border rounded-lg p-3 flex justify-between items-center"
                                            >
                                                <span className={`${ entry.name == currentPlayer?.name ? "text-pink-500" : "text-white" }`}>
                                                    {index + 1}. {entry.name}
                                                </span>
                                                <span>
                                                    {entry.estimate}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                </>
                            ) : (
                                <p>Keine Schätzungen vorhanden.</p>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

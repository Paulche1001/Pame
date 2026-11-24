import { useState } from "react";

export default function ImposterAdmin({ gameState, socket }) {

    const {


        adminName,
        allPlayer,
        isImposter,
        firstPlayer,
        word,
        helpWord,
        screen,

        selectedPlayers,
        kicked,
        problemMessage,
        imposterWin,
        crewmatesWin,
    } = gameState;

    const [open, setOpen] = useState(false);


    const youAreKicked = kicked?.includes(adminName);

    return (
        <div className="flex flex-col py-5 items-center w-full max-w-3xl mx-auto px-4">

            <div className="w-full flex justify-end">
                <button
                    onClick={() => {
                        const confirmLeave = window.confirm(
                        "Willst du das Spiel wirklich verlassen?"
                        );
                        if (confirmLeave) {
                        socket.emit("admin_action", { action: "lobby" });
                        }
                    }}
                    className="text-red-600 hover:bg-white px-2 py-2 rounded-lg font-bold"
                    >
                    X
                </button>
            </div>

            {screen === "imposter_screen" && (
                <div className="w-full max-w-2xl mx-auto">
                    <details
                        className="mb-4 w-full"
                        onToggle={(e) => setOpen(e.currentTarget.open)}
                    >
                        <summary className="cursor-pointer list-none text-white px-4 py-3 rounded-lg font-bold text-center bg-gray-800 w-full">
                            {open ? "Rolle verbergen" : "Rolle anzeigen"}
                        </summary>

                        <div className="mt-4 w-full">
                            {isImposter ? (
                                <div className="flex flex-col items-center w-full">
                                    <div className="bg-red-600 px-4 py-4 rounded-lg font-bold mb-4 w-full text-center">
                                        <h2>Du bist Imposter</h2>
                                    </div>
                                    <p>Dein Hilfs Wort ist:</p>
                                    {helpWord ? (
                                        <h2 className="text-2xl">{helpWord?.toUpperCase()}</h2>
                                    ) : (
                                        <h2>kein Hilfswort</h2>
                                    )}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center w-full">
                                    <div className="bg-green-600 px-4 py-4 rounded-lg font-bold mb-4 w-full text-center">
                                        <h2>Du bist Crewmate</h2>
                                    </div>
                                    <p>Das Wort ist:</p>
                                    {word ? (
                                        <h2 className="text-2xl">{word?.toUpperCase()}</h2>
                                    ) : (
                                        <h2>kein Wort gefunden</h2>
                                    )}
                                </div>
                            )}
                            <br />
                        </div>
                    </details>

                    {!youAreKicked ? (
                        <div>
                            {firstPlayer ? (
                                <div className="text-pink-600 font-bold w-full text-xl text-center">
                                    {firstPlayer === adminName ? (
                                        <h2>Du fängst an!</h2>
                                    ) : (
                                        <h2>{firstPlayer} fängt an!</h2>
                                    )}
                                </div>
                            ) : (
                                <h1 className="text-center">Entscheidet selbst wer beginnt</h1>
                            )}
                        </div>
                    ) : (
                        <div className="text-red-500 font-bold w-full text-xl text-center">
                            <h2>Du bist Raus!</h2>
                        </div>
                    )}

                    {problemMessage ? (
                        <h2 className="text-pink-600 text-2xl text-center">{problemMessage}!</h2>
                    ) : (
                        <h2 className="text-pink-600 text-2xl invisible">Hahaha</h2>
                    )}

                    <button
                        className="bg-green-900 px-4 py-3 rounded-lg font-bold text-center mt-4 w-full"
                        onClick={() => {
                            socket.emit("admin_action", {
                                action: "start_selection",
                            });
                        }}
                    >
                        Abstimmung
                    </button>
                </div>
            )}

            {screen === "selection_screen" && (
                <div className="w-full">

                    {allPlayer?.length && !crewmatesWin && !imposterWin ? (
                        <ul className="w-full">
                            {allPlayer.map((name) => {
                                const liveVotes = Object.values(selectedPlayers || {}).filter(
                                    (selectedName) => selectedName === name
                                ).length;

                                return (
                                    <li
                                        key={name}
                                        className="flex items-center justify-between w-full text-2xl mt-3"
                                    >
                                        {!kicked.includes(name) && (
                                            <>
                                            <span className={`flex-1 text-left ${name === adminName ? "text-blue-400" : ""}`}>
                                                - {name === adminName ? "Du" : name}{" "}
                                                <span className="text-xl text-gray-400">
                                                    {liveVotes}
                                                </span>
                                            </span>
                                            {!youAreKicked && (
                                                <input
                                                    type="radio"
                                                    name="player"
                                                    checked={selectedPlayers?.[adminName] === name}
                                                    onChange={() => {
                                                        socket.emit("admin_action", {
                                                            action: "select_player",
                                                            value: name,
                                                        });
                                                    }}
                                                    className="scale-150 ml-8"
                                                />
                                            )}
                                            </>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    ) : (
                        <>
                        {imposterWin && (
                            <h2 className="text-center text-2xl text-green-500">Imposter<br />Sieg!</h2>
                        )}
                        {crewmatesWin && (
                            <h2 className="text-center text-2xl text-green-500">Crewmate<br />Sieg</h2>
                        )}
                        </>
                    )} <br />

                    {problemMessage ? (
                        <h2 className="text-pink-600 text-2xl text-center">{problemMessage}!</h2>
                    ) : (
                        <h2 className="text-pink-600 text-2xl invisible">Hahaha</h2>
                    )}

                    <div className="flex flex-col">
                        {!imposterWin && !crewmatesWin && (
                            <>
                            <button
                                className="bg-green-900  px-4 py-3 rounded-lg font-bold text-center mt-4"
                                onClick={() => {
                                    socket.emit("admin_action", {
                                        action: "vote_imposter",
                                    })
                                }}>
                                Vote
                            </button>

                            <button
                                className="bg-green-900  px-4 py-3 rounded-lg font-bold text-center mt-4"
                                onClick={() => {
                                    socket.emit("admin_action", {
                                        action: "keep_playing",
                                    })
                                }}>
                                Weiter
                            </button>
                            </>
                        )}



                        <button
                            className="bg-green-900  px-4 py-3 rounded-lg font-bold text-center mt-4"
                            onClick={() => {
                                socket.emit("admin_action", {
                                    action: "next_round",
                                })
                            }}>
                            Nächste Runde
                        </button>
                    </div>

                </div>
            )}

            {/*
            <h2>Mein Name: {adminName}</h2>

            <h2>Anzahl Imposter: {imposterCount}</h2>  <br />

            <h2>Alle: </h2>
            {allPlayer?.length ? (
            <ul>
                {allPlayer.map((name) => (
                <li key={name}>- {name}</li>
                ))}
            </ul>
            ) : (
            <p>Niemand da</p>
            )} <br />

            <p>
                Alle:{" "}
                {allPlayer.length
                    ? allPlayer.join(", ")
                    : "Niemand da"
                }
            </p> <br />

            <p>
                Imposter:{" "}
                {imposters.length
                    ? imposters.join(", ")
                    : "Niemand da"
                }
            </p>
            */}

        </div>
    );
}

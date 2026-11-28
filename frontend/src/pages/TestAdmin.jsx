import { useEffect, useState, useRef } from "react";

export default function TestAdmin({ gameState, socket }) {


    const {
        messages,
    } = gameState;

    const list = messages ?? [];
    const [input, setInput] = useState("");
    const bottomRef = useRef(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth"});
    }, [messages]);

    return (
        <div className="round-content">
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
                    className="btn btn-game"
                    >Verlassen</button>
            </div>

            {list.length === 0 ? (
                <p>Keine Nachrichten</p>
            ) : (
                <div className="w-full text-left max-h-[40vh] overflow-y-auto">
                    {list.map((m, idx) => (
                        <div key={idx} className="break-all whitespace-pre-wrap">
                            <span className={m.name === "Admin" ? "text-red-500" : "text-green-500"}>
                                {m.name}
                            </span>
                            : {m.message}
                        </div>
                    ))}
                    <div ref={bottomRef} />
                </div>
            )}

            <div className="field-row">
                <input aria-label="Nachricht"
                    className="w-full"
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Nachricht"
                />
                <button
                    className="btn btn-game"

                    onClick={() => {
                        socket.emit("admin_action", {
                            action: "send_message",
                            value: input
                        })
                        setInput("");
                    }}
                >Senden</button>
            </div>

        </div>
    );
}

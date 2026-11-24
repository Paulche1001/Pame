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
        <div className="p-6 text-white flex flex-col gap-6 items-start">
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

            <div className="w-full flex justify-center rounded-2xl bg-white p-2">
                <input
                    className="bg-white w-full text-black caret-pink-600 px-2 py-1 outline-none focus:outline-none focus:ring-0 focus:border-transparent"
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Nachricht"
                />
                <button
                    className="bg-pink-600 w-10 h-10"
                    style={{ clipPath: "polygon(0 0, 100% 50%, 0 100%)" }}
                    onClick={() => {
                        socket.emit("admin_action", {
                            action: "send_message",
                            value: input
                        })
                        setInput("");
                    }}
                >
                </button>
            </div>

        </div>
    );
}

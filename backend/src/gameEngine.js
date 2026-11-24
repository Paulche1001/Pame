const EstimateMode = require("./modes/estimateMode");
const PixelMode = require("./modes/pixelMode");
const WhoIsMode = require("./modes/whoisMode");
const WhatIsMode = require("./modes/whatisMode");
const SLFMode = require("./modes/slfMode");
const TestMode = require("./modes/testMode");
const ImposterMode = require("./modes/imposterMode");
const DrinkingMode = require("./modes/drinkingMode");
const { publicPlayers } = require("./utils");

const estimateSets = {
  classic: require("./questions/estimateQuestions.json"),
  traben_trabach: require("./questions/estimateQuestionsRegional.json"),
  eigene: require("./questions/estimateQuestionsSelbst.json"),
};
const whoIsSets = {
  whois_emojis: require("./questions/whoIsQuestionsEmojis.json"),
  guessthebeer: require("./questions/guessTheBeer.json"),
};

function createGameEngine() {
  let currentMode = null;
  let players = [];
  let ioRef = null;
  let gameId = 0;
  let activeModeName = null;

  const engine = {
    get currentMode() { return currentMode; },
    setPlayers(list) {
      players = list;
      if (currentMode?.updatePlayers) currentMode.updatePlayers(list);
      else if (currentMode) currentMode.players = list;
    },
    selectMode(modeName, io, options = {}) {
      const factories = {
        estimate: () => new EstimateMode(modeIO, players, { ...options, sets: estimateSets }),
        pixel: () => new PixelMode(modeIO, players),
        whatis: () => new WhatIsMode(modeIO, players),
        slf: () => new SLFMode(modeIO, players, options),
        test: () => new TestMode(modeIO, players),
        imposter: () => new ImposterMode(modeIO, players, require("./questions/imposterWords.json"), options),
        drinking: () => new DrinkingMode(modeIO, players, options),
      };
      for (const [variant, questions] of Object.entries(whoIsSets)) {
        factories[variant] = () => new WhoIsMode(modeIO, players, questions, variant, options);
      }
      if (!Object.hasOwn(factories, modeName)) return false;
      const nextMode = factories[modeName]();
      this.disposeMode();
      ioRef = io;
      currentMode = nextMode;
      activeModeName = modeName;
      gameId++;
      currentMode.start();
      return true;
    },
    disposeMode() {
      currentMode?.dispose?.();
      currentMode?.clearTimers?.();
      currentMode = null;
      activeModeName = null;
    },
    handlePlayerAction(socket, payload) {
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) return;
      const player = players.find(p => p.socketId === socket.id);
      if (!player) return;
      // Bind identity to the joined socket, never to client-supplied names/IDs.
      currentMode?.onPlayerAction?.(socket, {
        ...payload, playerId: player.id, voterName: player.name, schaetzerName: player.name,
      });
    },
    handleAdminAction(payload, io = ioRef) {
      const action = typeof payload === "string" ? payload : payload?.action;
      if (typeof action !== "string") return;
      if (action === "lobby") {
        this.disposeMode();
        if (io) ioRef = io;
        this.broadcastState();
        return;
      }
      currentMode?.onAdminAction?.(typeof payload === "string" ? { action } : payload);
    },
    getState(viewer = {}) {
      const state = currentMode?.getState(viewer) || { screen: "lobby", mode: null };
      return {
        screen: "game", ...state,
        gameId,
        roundKey: `${gameId}:${currentMode?.currentIndex ?? 0}:${currentMode?.round ?? 0}:${currentMode?.letter ?? ""}`,
        mode: state.mode ?? (state.screen === "end" || !currentMode ? null : activeModeName),
        players: publicPlayers(players),
        buzzedPlayer: state.buzzedPlayer ? publicPlayers([state.buzzedPlayer])[0] : null,
      };
    },
    broadcastState() {
      if (!ioRef) return;
      ioRef.to("admins").emit("admin_state", this.getState({ role: "admin" }));
      for (const player of players) {
        ioRef.to(player.socketId).emit("game_state", this.getState({ role: "player", playerId: player.id }));
      }
    },
  };
  // All mode updates, including timer callbacks, use the same state projection.
  const modeIO = {
    emit(event) {
      if (event === "game_state") engine.broadcastState();
      if (event === "players_update") ioRef?.emit(event, publicPlayers(players));
    },
  };
  return engine;
}

module.exports = createGameEngine();
module.exports.createGameEngine = createGameEngine;

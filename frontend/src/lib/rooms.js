export function normalizeRoomCode(value) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}

export function roomCodeFromUrl() {
  return normalizeRoomCode(new URLSearchParams(window.location.search).get("room"));
}

export function setRoomInUrl(code) {
  const url = new URL(window.location.href);
  if (code) url.searchParams.set("room", code);
  else url.searchParams.delete("room");
  window.history.replaceState(null, "", url.pathname + url.search + url.hash);
}

function hostKeys() {
  try { return JSON.parse(sessionStorage.getItem("pameHostRooms") || "{}"); }
  catch { return {}; }
}

export function savedHostKey(code) {
  const key = hostKeys()?.[code];
  return typeof key === "string" ? key : "";
}

export function readHostRoom() {
  const roomCode = roomCodeFromUrl() || normalizeRoomCode(sessionStorage.getItem("pameActiveHostRoom"));
  const hostKey = savedHostKey(roomCode);
  return roomCode.length === 6 && hostKey ? { roomCode, hostKey } : null;
}

export function rememberHostRoom({ roomCode, hostKey }) {
  sessionStorage.setItem("pameHostRooms", JSON.stringify({ ...hostKeys(), [roomCode]: hostKey }));
  sessionStorage.setItem("pameActiveHostRoom", roomCode);
  setRoomInUrl(roomCode);
}

export function initialPlayerRoom() {
  return roomCodeFromUrl() || normalizeRoomCode(localStorage.getItem("pameLastPlayerRoom"));
}

export function savedPlayerName(code) {
  return localStorage.getItem("playerName:" + code);
}

export function rememberPlayerRoom(code, name) {
  localStorage.setItem("playerName:" + code, name);
  localStorage.setItem("pameLastPlayerRoom", code);
  setRoomInUrl(code);
}

export function clearPlayerRoom(code) {
  localStorage.removeItem("playerName:" + code);
  if (localStorage.getItem("pameLastPlayerRoom") === code) localStorage.removeItem("pameLastPlayerRoom");
}

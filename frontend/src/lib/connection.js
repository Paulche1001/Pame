export function serverUrl() {
  if (import.meta.env.VITE_SERVER_URL) return import.meta.env.VITE_SERVER_URL;
  if (import.meta.env.DEV) return `${window.location.protocol}//${window.location.hostname}:3001`;
  return window.location.origin;
}

function randomId() {
  return [...crypto.getRandomValues(new Uint8Array(16))].map(n => n.toString(16).padStart(2, "0")).join("");
}

export function playerIdentity() {
  let id = localStorage.getItem("playerId");
  let token = localStorage.getItem("playerToken");
  if (!id) { id = randomId(); localStorage.setItem("playerId", id); }
  if (!token) { token = randomId(); localStorage.setItem("playerToken", token); }
  return { id, token };
}

export function clearPlayerIdentity() {
  for (const key of ["playerId", "playerToken", "playerName"]) localStorage.removeItem(key);
}

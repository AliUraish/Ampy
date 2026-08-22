// popup.js — status readout and the two settings worth exposing.

const dot = document.getElementById("dot");
const state = document.getElementById("state");
const last = document.getElementById("last");
const err = document.getElementById("err");
const serverInput = document.getElementById("server");
const enabledInput = document.getElementById("enabled");

async function refresh() {
  const { status = {}, serverUrl, enabled } = await chrome.storage.local.get([
    "status", "serverUrl", "enabled",
  ]);

  serverInput.value = serverUrl || "http://localhost:3000";
  enabledInput.checked = enabled !== false;

  const connected = Boolean(status.connected) && enabled !== false;
  dot.className = `dot ${connected ? "on" : "off"}`;
  state.textContent = enabled === false
    ? "paused"
    : connected
      ? "connected to Ampy"
      : "not connected";

  last.textContent = status.lastJob
    ? `Last search: “${status.lastJob}” — ${status.lastCount ?? 0} listings`
    : "";
  err.textContent = status.error || "";
}

serverInput.addEventListener("change", () =>
  chrome.storage.local.set({ serverUrl: serverInput.value.trim() })
);
enabledInput.addEventListener("change", () =>
  chrome.storage.local.set({ enabled: enabledInput.checked })
);

refresh();
setInterval(refresh, 2000);

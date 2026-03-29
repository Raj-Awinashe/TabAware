function formatTime(ts) {
  if (!ts) return "-";

  try {
    return new Date(ts).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  } catch {
    return "-";
  }
}

function getDomainFromUrl(url) {
  if (!url) return "No events yet";

  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function setBackendUI(connected) {
  const dot = document.getElementById("backendDot");
  const text = document.getElementById("backendText");

  if (connected) {
    dot.classList.remove("bad");
    dot.classList.add("ok");
    text.textContent = "Connected";
  } else {
    dot.classList.remove("ok");
    dot.classList.add("bad");
    text.textContent = "Disconnected";
  }
}

function updateUI(data) {
  setBackendUI(Boolean(data.backendConnected));

  document.getElementById("lastCheck").textContent =
    `Last checked: ${formatTime(data.lastBackendCheck)}`;

  if (data.lastEvent) {
    document.getElementById("lastEventTime").textContent =
      formatTime(data.lastEvent.timestamp);

    document.getElementById("lastEventDomain").textContent =
      getDomainFromUrl(data.lastEvent.url);
  } else {
    document.getElementById("lastEventTime").textContent = "-";
    document.getElementById("lastEventDomain").textContent = "No events yet";
  }
}

function loadStatus() {
  chrome.runtime.sendMessage({ type: "FocusGuard_GET_STATUS" }, (response) => {
    if (chrome.runtime.lastError) {
      console.error("FocusGuard popup error:", chrome.runtime.lastError);
      return;
    }

    updateUI(response || {});
  });
}

function refreshBackend() {
  chrome.runtime.sendMessage({ type: "FocusGuard_PING_BACKEND" }, () => {
    setTimeout(loadStatus, 300);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const refreshBtn = document.getElementById("refreshBtn");

  refreshBtn.addEventListener("click", refreshBackend);

  loadStatus();
});
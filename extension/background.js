console.log("TabAware background loaded");

let cachedBlockedSites = [];
let lastFetchTime = 0;

async function getBlockedSites() {
  const now = Date.now();

  if (now - lastFetchTime < 5000 && cachedBlockedSites.length > 0) {
    return cachedBlockedSites;
  }

  try {
    const res = await fetch("http://localhost:3000/api/blocked-sites");

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();

    cachedBlockedSites = data;
    lastFetchTime = now;

    console.log("blocked sites:", data);
    return data;
  } catch (err) {
    console.error("Failed to fetch blocked sites:", err);
    return cachedBlockedSites;
  }
}

function normalizeDomain(hostname) {
  return hostname.replace(/^www\./, "").toLowerCase();
}

async function shouldBlockUrl(url) {
  try {
    const blocked = await getBlockedSites();
    const hostname = normalizeDomain(new URL(url).hostname);

    console.log("checking:", hostname);

    const result = blocked.some((site) => {
      const domain = normalizeDomain(site.domain);
      return hostname === domain || hostname.endsWith("." + domain);
    });

    console.log("should block?", result);
    return result;
  } catch (err) {
    console.error("Error checking URL:", err);
    return false;
  }
}

async function logTab(tab) {
  if (!tab || !tab.url) return;

  if (
    tab.url.startsWith("chrome://") ||
    tab.url.startsWith("chrome-extension://") ||
    tab.url.startsWith("data:")
  ) {
    return;
  }

  try {
    await fetch("http://localhost:3000/api/events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        url: tab.url,
        title: tab.title || "",
        eventType: "TAB_SWITCH",
        timestamp: Date.now(),
        tabId: tab.id ?? null
      })
    });

    console.log("logged:", tab.url);
  } catch (err) {
    console.error("Logging failed:", err);
  }
}

async function enforceBlock(tabId, tab) {
  if (!tab || !tab.url) return false;

  if (
    tab.url.startsWith("chrome://") ||
    tab.url.startsWith("chrome-extension://") ||
    tab.url.startsWith("data:")
  ) {
    return false;
  }

  const blockedPageBase = chrome.runtime.getURL("blocked.html");

  if (tab.url.startsWith(blockedPageBase)) {
    return true;
  }

  const blocked = await shouldBlockUrl(tab.url);
  if (!blocked) return false;

  const domain = normalizeDomain(new URL(tab.url).hostname);
  const blockedPage = chrome.runtime.getURL(
    `blocked.html?domain=${encodeURIComponent(domain)}&url=${encodeURIComponent(tab.url)}`
  );

  console.log("BLOCKING:", tab.url);

  await chrome.tabs.update(tabId, {
    url: blockedPage
  });

  return true;
}

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    const wasBlocked = await enforceBlock(activeInfo.tabId, tab);

    if (!wasBlocked) {
      await logTab(tab);
    }
  } catch (err) {
    console.error("onActivated error:", err);
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  try {
    if (changeInfo.status === "complete" && tab.url) {
      const wasBlocked = await enforceBlock(tabId, tab);

      if (!wasBlocked && tab.active) {
        await logTab(tab);
      }
    }
  } catch (err) {
    console.error("onUpdated error:", err);
  }
});
// ============================================================
// PRIVACY SHIELD PRO - Popup Script (Version sécurisée)
// ============================================================

// === ÉLÉMENTS DOM ===
const $ = id => document.getElementById(id);

const elements = {
  logo: $('logo'),
  siteName: $('siteName'),
  siteStatus: $('siteStatus'),
  siteStats: $('siteStats'),
  protectBtn: $('protectBtn'),
  whitelistBtn: $('whitelistBtn'),
  tempBtn: $('tempBtn'),
  statusBar: $('statusBar'),
  
  toggleEnabled: $('toggleEnabled'),
  toggleTrackers: $('toggleTrackers'),
  toggleAds: $('toggleAds'),
  toggleCookies: $('toggleCookies'),
  toggleWebRTC: $('toggleWebRTC'),
  toggleFingerprint: $('toggleFingerprint'),
  toggleRedirects: $('toggleRedirects'),
  toggleHTTPS: $('toggleHTTPS'),
  toggleNotifications: $('toggleNotifications'),
  
  statTotal: $('statTotal'),
  statSession: $('statSession'),
  statTrackers: $('statTrackers'),
  statAds: $('statAds'),
  statCookies: $('statCookies'),
  statHTTPS: $('statHTTPS'),
  chartBars: $('chartBars'),
  
  whitelistContainer: $('whitelistContainer'),
  
  resetStats: $('resetStats'),
  exportData: $('exportData'),
  importData: $('importData'),
  importFile: $('importFile'),
  clearWhitelist: $('clearWhitelist'),
  
  tempModal: $('tempModal'),
  tempMinutes: $('tempMinutes'),
  tempCancel: $('tempCancel'),
  tempConfirm: $('tempConfirm')
};

let currentDomain = null;
let currentSettings = {};
let currentStats = {};

// === FONCTIONS UTILITAIRES ===

function formatNumber(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return String(num || 0);
}

function getBaseDomain(hostname) {
  const parts = hostname.split('.');
  if (parts.length <= 2) return hostname;
  return parts.slice(-2).join('.');
}

async function getCurrentDomain() {
  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (tabs[0] && tabs[0].url) {
      const url = new URL(tabs[0].url);
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        return url.hostname;
      }
    }
  } catch (e) {}
  return null;
}

// Fonction sécurisée pour créer des éléments
function createTextElement(tag, text, className) {
  const el = document.createElement(tag);
  el.textContent = text;
  if (className) el.className = className;
  return el;
}

// === TABS ===

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    
    tab.classList.add('active');
    document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
  });
});

// === CHARGER L'ÉTAT ===

async function loadState() {
  const response = await browser.runtime.sendMessage({ action: 'getState' });
  currentSettings = response.settings;
  currentStats = response.stats;
  
  // Mettre à jour les toggles
  elements.toggleEnabled.checked = currentSettings.enabled;
  elements.toggleTrackers.checked = currentSettings.blockTrackers;
  elements.toggleAds.checked = currentSettings.blockAds;
  elements.toggleCookies.checked = currentSettings.blockCookies;
  elements.toggleWebRTC.checked = currentSettings.blockWebRTC;
  elements.toggleFingerprint.checked = currentSettings.blockFingerprint;
  elements.toggleRedirects.checked = currentSettings.blockRedirects;
  elements.toggleHTTPS.checked = currentSettings.forceHTTPS;
  elements.toggleNotifications.checked = currentSettings.notifications;
  
  // Logo et status bar
  if (currentSettings.enabled) {
    elements.logo.classList.remove('disabled');
    elements.statusBar.className = 'status-bar on';
    elements.statusBar.textContent = '🛡️ Protection active';
  } else {
    elements.logo.classList.add('disabled');
    elements.statusBar.className = 'status-bar off';
    elements.statusBar.textContent = '⚠️ Protection désactivée';
  }
  
  // Stats
  elements.statTotal.textContent = formatNumber(currentStats.total);
  elements.statSession.textContent = formatNumber(currentStats.session);
  elements.statTrackers.textContent = formatNumber(currentStats.trackers);
  elements.statAds.textContent = formatNumber(currentStats.ads);
  elements.statCookies.textContent = formatNumber(currentStats.cookies);
  elements.statHTTPS.textContent = formatNumber(currentStats.https);
  
  // Chart
  updateChart();
  
  // Site actuel
  currentDomain = await getCurrentDomain();
  
  if (currentDomain) {
    elements.siteName.textContent = currentDomain;
    
    const isWhitelisted = currentSettings.whitelist.includes(currentDomain) ||
                          currentSettings.whitelist.includes(getBaseDomain(currentDomain));
    
    const baseDomain = getBaseDomain(currentDomain);
    const isTempWhitelisted = currentSettings.tempWhitelist && 
                              currentSettings.tempWhitelist[baseDomain] &&
                              currentSettings.tempWhitelist[baseDomain] > Date.now();
    
    if (isWhitelisted) {
      elements.siteStatus.textContent = 'Autorisé';
      elements.siteStatus.className = 'site-status whitelisted';
    } else if (isTempWhitelisted) {
      const remaining = Math.ceil((currentSettings.tempWhitelist[baseDomain] - Date.now()) / 60000);
      elements.siteStatus.textContent = 'Temp (' + remaining + 'min)';
      elements.siteStatus.className = 'site-status whitelisted';
    } else {
      elements.siteStatus.textContent = 'Protégé';
      elements.siteStatus.className = 'site-status protected';
    }
    
    // Stats du site
    const siteData = currentStats.bySite[getBaseDomain(currentDomain)];
    if (siteData) {
      elements.siteStats.textContent = siteData.blocked + ' trackers bloqués sur ce site';
    } else {
      elements.siteStats.textContent = '0 trackers bloqués sur ce site';
    }
  } else {
    elements.siteName.textContent = 'Page interne';
    elements.siteStatus.textContent = '-';
    elements.siteStatus.className = 'site-status';
    elements.siteStats.textContent = '';
  }
  
  // Whitelist
  updateWhitelistUI();
}

function updateChart() {
  const data = [
    { label: 'Trackers', value: currentStats.trackers || 0, color: '#4ecca3' },
    { label: 'Publicités', value: currentStats.ads || 0, color: '#ff6b6b' },
    { label: 'Cookies', value: currentStats.cookies || 0, color: '#ffc107' },
    { label: 'Fingerprint', value: currentStats.fingerprint || 0, color: '#9b59b6' },
    { label: 'Redirections', value: currentStats.redirects || 0, color: '#3498db' },
    { label: 'HTTPS', value: currentStats.https || 0, color: '#2ecc71' }
  ];
  
  const maxValue = Math.max(...data.map(d => d.value), 1);
  
  // Vider le conteneur de manière sécurisée
  while (elements.chartBars.firstChild) {
    elements.chartBars.removeChild(elements.chartBars.firstChild);
  }
  
  // Créer les barres de manière sécurisée
  data.forEach(d => {
    const barDiv = document.createElement('div');
    barDiv.className = 'chart-bar';
    
    const labelSpan = document.createElement('span');
    labelSpan.className = 'chart-bar-label';
    labelSpan.textContent = d.label;
    
    const fillDiv = document.createElement('div');
    fillDiv.className = 'chart-bar-fill';
    
    const valueDiv = document.createElement('div');
    valueDiv.className = 'chart-bar-value';
    valueDiv.style.width = ((d.value / maxValue) * 100) + '%';
    valueDiv.style.background = d.color;
    
    const countSpan = document.createElement('span');
    countSpan.className = 'chart-bar-count';
    countSpan.textContent = formatNumber(d.value);
    
    fillDiv.appendChild(valueDiv);
    barDiv.appendChild(labelSpan);
    barDiv.appendChild(fillDiv);
    barDiv.appendChild(countSpan);
    
    elements.chartBars.appendChild(barDiv);
  });
}

function updateWhitelistUI() {
  const whitelist = currentSettings.whitelist || [];
  const tempWhitelist = currentSettings.tempWhitelist || {};
  
  // Vider le conteneur de manière sécurisée
  while (elements.whitelistContainer.firstChild) {
    elements.whitelistContainer.removeChild(elements.whitelistContainer.firstChild);
  }
  
  let hasItems = false;
  
  // Sites permanents
  whitelist.forEach(domain => {
    hasItems = true;
    const item = createWhitelistItem(domain, 'Permanent', 'permanent');
    elements.whitelistContainer.appendChild(item);
  });
  
  // Sites temporaires
  Object.entries(tempWhitelist).forEach(([domain, expiration]) => {
    if (expiration > Date.now()) {
      hasItems = true;
      const remaining = Math.ceil((expiration - Date.now()) / 60000);
      const item = createWhitelistItem(domain, 'Temporaire (' + remaining + ' min)', 'temp');
      elements.whitelistContainer.appendChild(item);
    }
  });
  
  if (!hasItems) {
    const emptyDiv = document.createElement('div');
    emptyDiv.className = 'whitelist-empty';
    emptyDiv.textContent = 'Aucun site autorisé';
    elements.whitelistContainer.appendChild(emptyDiv);
  }
}

function createWhitelistItem(domain, typeText, type) {
  const itemDiv = document.createElement('div');
  itemDiv.className = 'whitelist-item';
  
  const infoDiv = document.createElement('div');
  infoDiv.className = 'whitelist-item-info';
  
  const nameSpan = document.createElement('span');
  nameSpan.className = 'whitelist-item-name';
  nameSpan.textContent = domain;
  
  const typeSpan = document.createElement('span');
  typeSpan.className = 'whitelist-item-type';
  typeSpan.textContent = typeText;
  
  const removeBtn = document.createElement('button');
  removeBtn.className = 'whitelist-remove';
  removeBtn.textContent = '✕';
  removeBtn.addEventListener('click', async () => {
    if (type === 'permanent') {
      await browser.runtime.sendMessage({ action: 'removeFromWhitelist', domain });
    } else {
      delete currentSettings.tempWhitelist[domain];
      await browser.runtime.sendMessage({ 
        action: 'updateSettings', 
        settings: { tempWhitelist: currentSettings.tempWhitelist }
      });
    }
    loadState();
  });
  
  infoDiv.appendChild(nameSpan);
  infoDiv.appendChild(typeSpan);
  itemDiv.appendChild(infoDiv);
  itemDiv.appendChild(removeBtn);
  
  return itemDiv;
}

// === EVENT LISTENERS ===

// Toggles
const toggleMapping = {
  toggleEnabled: 'enabled',
  toggleTrackers: 'blockTrackers',
  toggleAds: 'blockAds',
  toggleCookies: 'blockCookies',
  toggleWebRTC: 'blockWebRTC',
  toggleFingerprint: 'blockFingerprint',
  toggleRedirects: 'blockRedirects',
  toggleHTTPS: 'forceHTTPS',
  toggleNotifications: 'notifications'
};

Object.entries(toggleMapping).forEach(([elementId, settingKey]) => {
  elements[elementId].addEventListener('change', async (e) => {
    const newSettings = { [settingKey]: e.target.checked };
    await browser.runtime.sendMessage({ action: 'updateSettings', settings: newSettings });
    loadState();
  });
});

// Boutons site
elements.protectBtn.addEventListener('click', async () => {
  if (currentDomain) {
    await browser.runtime.sendMessage({ action: 'removeFromWhitelist', domain: currentDomain });
    await browser.runtime.sendMessage({ action: 'removeFromWhitelist', domain: getBaseDomain(currentDomain) });
    loadState();
  }
});

elements.whitelistBtn.addEventListener('click', async () => {
  if (currentDomain) {
    await browser.runtime.sendMessage({ action: 'addToWhitelist', domain: getBaseDomain(currentDomain) });
    loadState();
  }
});

elements.tempBtn.addEventListener('click', () => {
  if (currentDomain) {
    elements.tempModal.classList.add('active');
  }
});

// Modal
elements.tempCancel.addEventListener('click', () => {
  elements.tempModal.classList.remove('active');
});

elements.tempConfirm.addEventListener('click', async () => {
  const minutes = parseInt(elements.tempMinutes.value) || 30;
  await browser.runtime.sendMessage({ 
    action: 'addTempWhitelist', 
    domain: getBaseDomain(currentDomain),
    minutes 
  });
  elements.tempModal.classList.remove('active');
  loadState();
});

// Stats
elements.resetStats.addEventListener('click', async () => {
  await browser.runtime.sendMessage({ action: 'resetStats' });
  loadState();
});

elements.exportData.addEventListener('click', async () => {
  const data = await browser.runtime.sendMessage({ action: 'exportData' });
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = 'privacy-shield-backup-' + new Date().toISOString().split('T')[0] + '.json';
  a.click();
  
  URL.revokeObjectURL(url);
});

elements.importData.addEventListener('click', () => {
  elements.importFile.click();
});

elements.importFile.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (file) {
    const text = await file.text();
    try {
      const data = JSON.parse(text);
      await browser.runtime.sendMessage({ action: 'importData', data });
      loadState();
      alert('Import réussi !');
    } catch (err) {
      alert('Erreur lors de l\'import : ' + err.message);
    }
  }
});

// Whitelist
elements.clearWhitelist.addEventListener('click', async () => {
  if (confirm('Vider toute la whitelist ?')) {
    await browser.runtime.sendMessage({ 
      action: 'updateSettings', 
      settings: { whitelist: [], tempWhitelist: {} }
    });
    loadState();
  }
});

// === INIT ===

loadState();
setInterval(loadState, 2000);
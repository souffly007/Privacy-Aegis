// ============================================================
// PRIVACY SHIELD PRO - Options Script (Version sécurisée)
// ============================================================

const $ = id => document.getElementById(id);

let currentSettings = {};
let currentStats = {};

// Charger l'état
async function loadState() {
  const response = await browser.runtime.sendMessage({ action: 'getState' });
  currentSettings = response.settings;
  currentStats = response.stats;
  
  // Toggles
  $('optEnabled').checked = currentSettings.enabled;
  $('optTrackers').checked = currentSettings.blockTrackers;
  $('optAds').checked = currentSettings.blockAds;
  $('optCookies').checked = currentSettings.blockCookies;
  $('optWebRTC').checked = currentSettings.blockWebRTC;
  $('optFingerprint').checked = currentSettings.blockFingerprint;
  $('optRedirects').checked = currentSettings.blockRedirects;
  $('optHTTPS').checked = currentSettings.forceHTTPS;
  $('optNotifications').checked = currentSettings.notifications;
  
  // Whitelist
  $('whitelistText').value = (currentSettings.whitelist || []).join('\n');
  
  // Stats - Méthode sécurisée
  updateStatsSummary();
}

function updateStatsSummary() {
  const container = $('statsSummary');
  
  // Vider le conteneur
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }
  
  const statsData = [
    { number: currentStats.total || 0, label: 'Total bloqué' },
    { number: currentStats.trackers || 0, label: 'Trackers' },
    { number: currentStats.ads || 0, label: 'Publicités' },
    { number: currentStats.cookies || 0, label: 'Cookies' },
    { number: currentStats.fingerprint || 0, label: 'Fingerprint' },
    { number: Object.keys(currentStats.bySite || {}).length, label: 'Sites protégés' }
  ];
  
  statsData.forEach(stat => {
    const box = document.createElement('div');
    box.className = 'stat-box';
    
    const numberDiv = document.createElement('div');
    numberDiv.className = 'number';
    numberDiv.textContent = stat.number;
    
    const labelDiv = document.createElement('div');
    labelDiv.className = 'label';
    labelDiv.textContent = stat.label;
    
    box.appendChild(numberDiv);
    box.appendChild(labelDiv);
    container.appendChild(box);
  });
}

// Sauvegarder un toggle
async function saveToggle(key, value) {
  await browser.runtime.sendMessage({ 
    action: 'updateSettings', 
    settings: { [key]: value }
  });
}

// Event listeners pour les toggles
const toggles = {
  'optEnabled': 'enabled',
  'optTrackers': 'blockTrackers',
  'optAds': 'blockAds',
  'optCookies': 'blockCookies',
  'optWebRTC': 'blockWebRTC',
  'optFingerprint': 'blockFingerprint',
  'optRedirects': 'blockRedirects',
  'optHTTPS': 'forceHTTPS',
  'optNotifications': 'notifications'
};

Object.entries(toggles).forEach(([elementId, settingKey]) => {
  $(elementId).addEventListener('change', (e) => {
    saveToggle(settingKey, e.target.checked);
  });
});

// Sauvegarder whitelist
$('saveWhitelist').addEventListener('click', async () => {
  const text = $('whitelistText').value;
  const whitelist = text.split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);
  
  await browser.runtime.sendMessage({
    action: 'updateSettings',
    settings: { whitelist }
  });
  
  alert('Whitelist sauvegardée !');
});

// Effacer whitelist
$('clearAllWhitelist').addEventListener('click', async () => {
  if (confirm('Effacer toute la whitelist ?')) {
    await browser.runtime.sendMessage({
      action: 'updateSettings',
      settings: { whitelist: [], tempWhitelist: {} }
    });
    $('whitelistText').value = '';
    alert('Whitelist effacée !');
  }
});

// Reset stats
$('resetAllStats').addEventListener('click', async () => {
  if (confirm('Réinitialiser toutes les statistiques ?')) {
    await browser.runtime.sendMessage({ action: 'resetStats' });
    loadState();
    alert('Statistiques réinitialisées !');
  }
});

// Export
$('exportAll').addEventListener('click', async () => {
  const data = await browser.runtime.sendMessage({ action: 'exportData' });
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = 'privacy-shield-backup-' + new Date().toISOString().split('T')[0] + '.json';
  a.click();
  
  URL.revokeObjectURL(url);
});

// Import
$('importAll').addEventListener('click', () => {
  $('importFile').click();
});

$('importFile').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (file) {
    const text = await file.text();
    try {
      const data = JSON.parse(text);
      await browser.runtime.sendMessage({ action: 'importData', data });
      loadState();
      alert('Import réussi !');
    } catch (err) {
      alert('Erreur : ' + err.message);
    }
  }
});

// Init
loadState();
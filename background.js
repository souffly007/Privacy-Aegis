// ============================================================
// PRIVACY SHIELD PRO - Background Script Complet
// ============================================================

// === ÉTAT GLOBAL ===
let settings = {
  enabled: true,
  blockTrackers: true,
  blockAds: true,
  blockWebRTC: true,
  blockCookies: true,
  blockFingerprint: true,
  forceHTTPS: true,
  blockRedirects: true,
  notifications: true,
  whitelist: [],
  tempWhitelist: {} // { domain: expirationTimestamp }
};

let stats = {
  total: 0,
  session: 0,
  trackers: 0,
  ads: 0,
  cookies: 0,
  fingerprint: 0,
  redirects: 0,
  https: 0,
  bySite: {} // { domain: { blocked: 0, types: {} } }
};

// === LISTES DE BLOCAGE ===
const TRACKERS = [
  "*://*.google-analytics.com/*",
  "*://*.googletagmanager.com/*",
  "*://*.doubleclick.net/*",
  "*://*.googleadservices.com/*",
  "*://*.googlesyndication.com/*",
  "*://*.facebook.com/tr/*",
  "*://*.facebook.net/signals/*",
  "*://*.analytics.tiktok.com/*",
  "*://*.ads.linkedin.com/*",
  "*://*.hotjar.com/*",
  "*://*.hotjar.io/*",
  "*://*.mixpanel.com/*",
  "*://*.segment.io/*",
  "*://*.segment.com/*",
  "*://*.amplitude.com/*",
  "*://*.fullstory.com/*",
  "*://*.mouseflow.com/*",
  "*://*.clarity.ms/*",
  "*://*.newrelic.com/*",
  "*://*.nr-data.net/*",
  "*://*.pingdom.net/*",
  "*://*.quantserve.com/*",
  "*://*.scorecardresearch.com/*",
  "*://*.demdex.net/*",
  "*://*.krxd.net/*",
  "*://*.bluekai.com/*",
  "*://*.exelator.com/*",
  "*://*.tapad.com/*",
  "*://*.rlcdn.com/*",
  "*://*.liveramp.com/*",
  "*://*.eyeota.net/*"
];

const ADS = [
  "*://*.doubleclick.net/*",
  "*://*.googlesyndication.com/*",
  "*://*.googleadservices.com/*",
  "*://*.adnxs.com/*",
  "*://*.criteo.com/*",
  "*://*.criteo.net/*",
  "*://*.taboola.com/*",
  "*://*.outbrain.com/*",
  "*://*.amazon-adsystem.com/*",
  "*://*.adsrvr.org/*",
  "*://*.adroll.com/*",
  "*://*.rubiconproject.com/*",
  "*://*.pubmatic.com/*",
  "*://*.openx.net/*",
  "*://*.casalemedia.com/*",
  "*://*.mediamath.com/*",
  "*://*.bidswitch.net/*",
  "*://*.contextweb.com/*",
  "*://*.sharethrough.com/*",
  "*://*.moatads.com/*",
  "*://*.adsafeprotected.com/*",
  "*://*.doubleverify.com/*",
  "*://*.zedo.com/*",
  "*://*.advertising.com/*",
  "*://*.adcolony.com/*",
  "*://*.unity3d.com/ads/*",
  "*://*.applovin.com/*",
  "*://*.mopub.com/*",
  "*://*.inmobi.com/*",
  "*://*.smaato.com/*"
];

const REDIRECT_TRACKERS = [
  'facebook.com/l.php',
  'google.com/url',
  'google.fr/url',
  't.co/',
  'bit.ly/',
  'goo.gl/',
  'ow.ly/',
  'tinyurl.com/',
  'l.instagram.com/',
  'lm.facebook.com/',
  'clickserve.',
  'click.linksynergy.com',
  'redirect.',
  'track.adform.net',
  'trk.pinterest.com'
];

const FINGERPRINT_SCRIPTS = [
  'fingerprint2',
  'fingerprintjs',
  'clientjs',
  'evercookie',
  'canvas-fingerprint',
  'webgl-fingerprint',
  'audio-fingerprint'
];

const SUSPICIOUS_PATTERNS = [
  /[?&]track/i,
  /[?&]collect/i,
  /\/beacon\//i,
  /\/pixel\//i,
  /\/telemetry\//i,
  /\/analytics\//i,
  /\.gif\?.*[a-f0-9]{20,}/i,
  /\/p\.gif/i,
  /\/b\.gif/i,
  /1x1\.gif/i,
  /transparent\.gif/i
];

// === FONCTIONS UTILITAIRES ===

function getBaseDomain(hostname) {
  const parts = hostname.split('.');
  if (parts.length <= 2) return hostname;
  const twoPartTlds = ['co.uk', 'com.br', 'com.au', 'co.jp', 'co.kr', 'com.mx', 'co.nz'];
  const lastTwo = parts.slice(-2).join('.');
  if (twoPartTlds.includes(lastTwo)) {
    return parts.slice(-3).join('.');
  }
  return parts.slice(-2).join('.');
}

function getDomainFromUrl(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function isWhitelisted(url) {
  const hostname = getDomainFromUrl(url);
  if (!hostname) return false;
  
  const baseDomain = getBaseDomain(hostname);
  
  // Vérifier whitelist permanente
  const inWhitelist = settings.whitelist.some(domain => {
    const wlBase = getBaseDomain(domain);
    return hostname === domain || hostname.endsWith('.' + domain) || baseDomain === wlBase;
  });
  
  if (inWhitelist) return true;
  
  // Vérifier whitelist temporaire
  const tempExpiration = settings.tempWhitelist[baseDomain];
  if (tempExpiration) {
    if (Date.now() < tempExpiration) {
      return true;
    } else {
      // Expiré, supprimer
      delete settings.tempWhitelist[baseDomain];
      saveSettings();
    }
  }
  
  return false;
}

function matchesPattern(url, patterns) {
  for (const pattern of patterns) {
    const regexStr = '^' + pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '\\?') + '$';
    try {
      if (new RegExp(regexStr).test(url)) {
        return true;
      }
    } catch (e) {}
  }
  return false;
}

function recordBlock(type, originUrl) {
  stats.total++;
  stats.session++;
  stats[type] = (stats[type] || 0) + 1;
  
  // Stats par site
  if (originUrl) {
    const domain = getBaseDomain(getDomainFromUrl(originUrl) || 'unknown');
    if (!stats.bySite[domain]) {
      stats.bySite[domain] = { blocked: 0, types: {} };
    }
    stats.bySite[domain].blocked++;
    stats.bySite[domain].types[type] = (stats.bySite[domain].types[type] || 0) + 1;
  }
  
  saveStats();
}

function showNotification(title, message) {
  if (settings.notifications) {
    browser.notifications.create({
      type: 'basic',
      iconUrl: browser.runtime.getURL('icons/icon-48.png'),
      title: title,
      message: message
    });
  }
}

// === SAUVEGARDE/CHARGEMENT ===

function saveSettings() {
  browser.storage.local.set({ settings });
}

function saveStats() {
  browser.storage.local.set({ stats });
}

function loadAll() {
  browser.storage.local.get(['settings', 'stats']).then(result => {
    if (result.settings) {
      settings = { ...settings, ...result.settings };
    }
    if (result.stats) {
      stats = { ...stats, ...result.stats };
      stats.session = 0;
    }
    console.log('🛡️ Privacy Aegis chargé');
  });
}

// === BLOCAGE PRINCIPAL ===

browser.webRequest.onBeforeRequest.addListener(
  function(details) {
    if (!settings.enabled) return { cancel: false };
    
    const url = details.url;
    const originUrl = details.originUrl || details.documentUrl;
    
    // Vérifier whitelist
    if (originUrl && isWhitelisted(originUrl)) {
      return { cancel: false };
    }
    
    let blocked = false;
    let blockType = null;
    
    // 1. Bloquer les trackers
    if (settings.blockTrackers) {
      if (matchesPattern(url, TRACKERS)) {
        blocked = true;
        blockType = 'trackers';
      }
      
      // Patterns suspects
      if (!blocked && SUSPICIOUS_PATTERNS.some(p => p.test(url))) {
        blocked = true;
        blockType = 'trackers';
      }
    }
    
    // 2. Bloquer les pubs
    if (!blocked && settings.blockAds) {
      if (matchesPattern(url, ADS)) {
        blocked = true;
        blockType = 'ads';
      }
    }
    
    // 3. Bloquer les scripts de fingerprinting
    if (!blocked && settings.blockFingerprint && details.type === 'script') {
      const urlLower = url.toLowerCase();
      if (FINGERPRINT_SCRIPTS.some(fp => urlLower.includes(fp))) {
        blocked = true;
        blockType = 'fingerprint';
      }
    }
    
    // 4. Bloquer les redirections de tracking
    if (!blocked && settings.blockRedirects) {
      if (REDIRECT_TRACKERS.some(rt => url.includes(rt))) {
        // Essayer d'extraire l'URL finale
        try {
          const urlObj = new URL(url);
          const finalUrl = urlObj.searchParams.get('u') || 
                          urlObj.searchParams.get('url') || 
                          urlObj.searchParams.get('q') ||
                          urlObj.searchParams.get('dest');
          if (finalUrl) {
            recordBlock('redirects', originUrl);
            return { redirectUrl: decodeURIComponent(finalUrl) };
          }
        } catch (e) {}
        blocked = true;
        blockType = 'redirects';
      }
    }
    
    if (blocked) {
      recordBlock(blockType, originUrl);
      console.log(`🛡️ [${blockType}] Bloqué:`, url.substring(0, 60));
      return { cancel: true };
    }
    
    return { cancel: false };
  },
  { urls: ["<all_urls>"] },
  ["blocking"]
);

// === FORCER HTTPS ===

browser.webRequest.onBeforeRequest.addListener(
  function(details) {
    if (!settings.enabled || !settings.forceHTTPS) return {};
    
    const url = details.url;
    if (url.startsWith('http://')) {
      const originUrl = details.originUrl || details.documentUrl;
      if (originUrl && isWhitelisted(originUrl)) {
        return {};
      }
      
      const httpsUrl = url.replace('http://', 'https://');
      recordBlock('https', details.originUrl);
      console.log('🔒 HTTPS forcé:', httpsUrl.substring(0, 60));
      return { redirectUrl: httpsUrl };
    }
    
    return {};
  },
  { urls: ["http://*/*"] },
  ["blocking"]
);

// === BLOQUER COOKIES TIERS ===

browser.webRequest.onBeforeSendHeaders.addListener(
  function(details) {
    if (!settings.enabled || !settings.blockCookies) return {};
    
    const originUrl = details.originUrl || details.documentUrl;
    if (originUrl && isWhitelisted(originUrl)) return {};
    
    // Vérifier si c'est une requête tierce
    const requestDomain = getDomainFromUrl(details.url);
    const originDomain = getDomainFromUrl(originUrl || '');
    
    if (requestDomain && originDomain) {
      const reqBase = getBaseDomain(requestDomain);
      const origBase = getBaseDomain(originDomain);
      
      if (reqBase !== origBase) {
        // Requête tierce : supprimer les cookies
        let headers = details.requestHeaders.filter(h => {
          return h.name.toLowerCase() !== 'cookie';
        });
        
        return { requestHeaders: headers };
      }
    }
    
    return {};
  },
  { urls: ["<all_urls>"] },
  ["blocking", "requestHeaders"]
);

browser.webRequest.onHeadersReceived.addListener(
  function(details) {
    if (!settings.enabled || !settings.blockCookies) return {};
    
    const originUrl = details.originUrl || details.documentUrl;
    if (originUrl && isWhitelisted(originUrl)) return {};
    
    const requestDomain = getDomainFromUrl(details.url);
    const originDomain = getDomainFromUrl(originUrl || '');
    
    if (requestDomain && originDomain) {
      const reqBase = getBaseDomain(requestDomain);
      const origBase = getBaseDomain(originDomain);
      
      if (reqBase !== origBase) {
        // Supprimer Set-Cookie des réponses tierces
        let headers = details.responseHeaders.filter(h => {
          if (h.name.toLowerCase() === 'set-cookie') {
            recordBlock('cookies', originUrl);
            return false;
          }
          return true;
        });
        
        return { responseHeaders: headers };
      }
    }
    
    return {};
  },
  { urls: ["<all_urls>"] },
  ["blocking", "responseHeaders"]
);

// === BLOQUER WEBRTC ===

// WebRTC est géré dans content.js car il faut injecter du code

// === ÉCOUTER LES CHANGEMENTS DE STORAGE ===

browser.storage.onChanged.addListener((changes, area) => {
  if (area === 'local') {
    if (changes.settings) {
      settings = changes.settings.newValue;
      console.log('🛡️ Settings mis à jour');
    }
  }
});

// === MESSAGES DU POPUP/OPTIONS ===

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case 'getState':
      sendResponse({ settings, stats });
      break;
      
    case 'updateSettings':
      settings = { ...settings, ...message.settings };
      saveSettings();
      sendResponse({ success: true });
      break;
      
    case 'addToWhitelist':
      if (!settings.whitelist.includes(message.domain)) {
        settings.whitelist.push(message.domain);
        saveSettings();
      }
      sendResponse({ success: true });
      break;
      
    case 'removeFromWhitelist':
      settings.whitelist = settings.whitelist.filter(d => d !== message.domain);
      saveSettings();
      sendResponse({ success: true });
      break;
      
    case 'addTempWhitelist':
      const duration = message.minutes * 60 * 1000;
      settings.tempWhitelist[message.domain] = Date.now() + duration;
      saveSettings();
      showNotification('Privacy Shield', `${message.domain} autorisé pour ${message.minutes} minutes`);
      sendResponse({ success: true });
      break;
      
    case 'resetStats':
      stats = {
        total: 0,
        session: 0,
        trackers: 0,
        ads: 0,
        cookies: 0,
        fingerprint: 0,
        redirects: 0,
        https: 0,
        bySite: {}
      };
      saveStats();
      sendResponse({ success: true, stats });
      break;
      
    case 'exportData':
      sendResponse({
        settings,
        stats,
        exportDate: new Date().toISOString()
      });
      break;
      
    case 'importData':
      if (message.data.settings) {
        settings = message.data.settings;
        saveSettings();
      }
      if (message.data.stats) {
        stats = message.data.stats;
        saveStats();
      }
      sendResponse({ success: true });
      break;
      
    case 'getStatsForSite':
      const siteStats = stats.bySite[message.domain] || { blocked: 0, types: {} };
      sendResponse(siteStats);
      break;
  }
  
  return true;
});

// === NETTOYAGE WHITELIST TEMPORAIRE ===

setInterval(() => {
  const now = Date.now();
  let changed = false;
  
  for (const domain in settings.tempWhitelist) {
    if (settings.tempWhitelist[domain] < now) {
      delete settings.tempWhitelist[domain];
      changed = true;
      console.log('🛡️ Whitelist temporaire expirée:', domain);
    }
  }
  
  if (changed) saveSettings();
}, 60000); // Vérifier chaque minute

// === INIT ===

loadAll();
// ============================================================
// PRIVACY SHIELD PRO - Content Script Anti-Fingerprint
// S'exécute AVANT les scripts de la page
// ============================================================

(function() {
  'use strict';
  
  // Injecter le script directement dans la page pour bypasser l'isolation
  const script = document.createElement('script');
  script.textContent = `
    (function() {
      'use strict';
      
      // === ANTI-CANVAS FINGERPRINT ===
      
      const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
      const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;
      const originalToBlob = HTMLCanvasElement.prototype.toBlob;
      const originalGetContext = HTMLCanvasElement.prototype.getContext;
      
      // Générateur de bruit déterministe basé sur la session
      const sessionNoise = Math.random() * 0.01;
      
      function addNoise(imageData) {
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
          // Ajouter un bruit subtil mais constant pour cette session
          const noise = Math.sin(i * sessionNoise) > 0.9999 ? 1 : 0;
          data[i] ^= noise;     // R
          data[i + 1] ^= noise; // G  
          data[i + 2] ^= noise; // B
        }
        return imageData;
      }
      
      // Override getContext pour tracker les canvas 2D
      HTMLCanvasElement.prototype.getContext = function(type, attributes) {
        const context = originalGetContext.call(this, type, attributes);
        if (context && type === '2d') {
          this._privacyShield2D = true;
        }
        return context;
      };
      
      // Override toDataURL
      HTMLCanvasElement.prototype.toDataURL = function(type, quality) {
        if (this._privacyShield2D && this.width > 0 && this.height > 0) {
          try {
            const context = originalGetContext.call(this, '2d');
            if (context) {
              const imageData = originalGetImageData.call(context, 0, 0, this.width, this.height);
              addNoise(imageData);
              context.putImageData(imageData, 0, 0);
            }
          } catch(e) {}
        }
        return originalToDataURL.call(this, type, quality);
      };
      
      // Override getImageData
      CanvasRenderingContext2D.prototype.getImageData = function(sx, sy, sw, sh) {
        const imageData = originalGetImageData.call(this, sx, sy, sw, sh);
        addNoise(imageData);
        return imageData;
      };
      
      // Override toBlob
      HTMLCanvasElement.prototype.toBlob = function(callback, type, quality) {
        if (this._privacyShield2D && this.width > 0 && this.height > 0) {
          try {
            const context = originalGetContext.call(this, '2d');
            if (context) {
              const imageData = originalGetImageData.call(context, 0, 0, this.width, this.height);
              addNoise(imageData);
              context.putImageData(imageData, 0, 0);
            }
          } catch(e) {}
        }
        return originalToBlob.call(this, callback, type, quality);
      };
      
      // === ANTI-WEBGL FINGERPRINT ===
      
      const originalGetParameter = WebGLRenderingContext.prototype.getParameter;
      const originalGetExtension = WebGLRenderingContext.prototype.getExtension;
      const originalGetSupportedExtensions = WebGLRenderingContext.prototype.getSupportedExtensions;
      
      // Paramètres WebGL à masquer
      const webglParams = {
        // Vendor et Renderer
        37445: 'Intel Inc.',  // UNMASKED_VENDOR_WEBGL
        37446: 'Intel Iris OpenGL Engine',  // UNMASKED_RENDERER_WEBGL
        7936: 'WebKit',  // VENDOR
        7937: 'WebKit WebGL',  // RENDERER
        7938: 'WebGL 1.0',  // VERSION
        35724: 'WebGL GLSL ES 1.0',  // SHADING_LANGUAGE_VERSION
      };
      
      WebGLRenderingContext.prototype.getParameter = function(param) {
        if (webglParams[param] !== undefined) {
          return webglParams[param];
        }
        return originalGetParameter.call(this, param);
      };
      
      // WebGL2 si disponible
      if (typeof WebGL2RenderingContext !== 'undefined') {
        const originalGetParameter2 = WebGL2RenderingContext.prototype.getParameter;
        WebGL2RenderingContext.prototype.getParameter = function(param) {
          if (webglParams[param] !== undefined) {
            return webglParams[param];
          }
          return originalGetParameter2.call(this, param);
        };
      }
      
      // === ANTI-AUDIO FINGERPRINT ===
      
      if (window.AudioContext || window.webkitAudioContext) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        
        const originalCreateAnalyser = AudioCtx.prototype.createAnalyser;
        const originalCreateOscillator = AudioCtx.prototype.createOscillator;
        const originalCreateDynamicsCompressor = AudioCtx.prototype.createDynamicsCompressor;
        
        // Override analyser
        AudioCtx.prototype.createAnalyser = function() {
          const analyser = originalCreateAnalyser.call(this);
          
          const originalGetFloatFrequencyData = analyser.getFloatFrequencyData.bind(analyser);
          const originalGetByteFrequencyData = analyser.getByteFrequencyData.bind(analyser);
          
          analyser.getFloatFrequencyData = function(array) {
            originalGetFloatFrequencyData(array);
            for (let i = 0; i < array.length; i++) {
              array[i] += (Math.random() - 0.5) * 0.001;
            }
          };
          
          analyser.getByteFrequencyData = function(array) {
            originalGetByteFrequencyData(array);
            for (let i = 0; i < array.length; i++) {
              array[i] += Math.floor((Math.random() - 0.5) * 2);
            }
          };
          
          return analyser;
        };
      }
      
      // === ANTI-WEBRTC ===
      
      // Bloquer RTCPeerConnection
      const originalRTCPeerConnection = window.RTCPeerConnection;
      
      window.RTCPeerConnection = function(config) {
        // Bloquer les requêtes STUN/TURN qui révèlent l'IP
        if (config && config.iceServers) {
          config.iceServers = [];
        }
        
        const pc = new originalRTCPeerConnection(config);
        
        // Override createDataChannel pour bloquer
        const originalCreateDataChannel = pc.createDataChannel.bind(pc);
        pc.createDataChannel = function() {
          return originalCreateDataChannel.apply(this, arguments);
        };
        
        // Override createOffer pour masquer les IPs
        const originalCreateOffer = pc.createOffer.bind(pc);
        pc.createOffer = function(options) {
          return originalCreateOffer(options).then(offer => {
            // Remplacer les IPs locales dans le SDP
            offer.sdp = offer.sdp.replace(/([0-9]{1,3}(\\.[0-9]{1,3}){3})/g, '0.0.0.0');
            return offer;
          });
        };
        
        return pc;
      };
      
      window.RTCPeerConnection.prototype = originalRTCPeerConnection.prototype;
      window.webkitRTCPeerConnection = window.RTCPeerConnection;
      
      // === MASQUER PROPRIÉTÉS DU NAVIGATEUR ===
      
      // Plugins
      Object.defineProperty(navigator, 'plugins', {
        get: function() {
          return { length: 0, item: () => null, namedItem: () => null, refresh: () => {} };
        }
      });
      
      // Mime Types
      Object.defineProperty(navigator, 'mimeTypes', {
        get: function() {
          return { length: 0, item: () => null, namedItem: () => null };
        }
      });
      
      // Langues - valeurs génériques
      Object.defineProperty(navigator, 'languages', {
        get: function() { return ['en-US', 'en']; }
      });
      
      Object.defineProperty(navigator, 'language', {
        get: function() { return 'en-US'; }
      });
      
      // Hardware
      Object.defineProperty(navigator, 'hardwareConcurrency', {
        get: function() { return 4; }
      });
      
      Object.defineProperty(navigator, 'deviceMemory', {
        get: function() { return 8; }
      });
      
      // Platform
      Object.defineProperty(navigator, 'platform', {
        get: function() { return 'Win32'; }
      });
      
      // Vendor
      Object.defineProperty(navigator, 'vendor', {
        get: function() { return 'Google Inc.'; }
      });
      
      // User Agent - on ne le change pas car ça peut casser des sites
      // Mais on peut le faire si nécessaire
      
      // === MASQUER L'ÉCRAN ===
      
      const fakeScreen = {
        width: 1920,
        height: 1080,
        availWidth: 1920,
        availHeight: 1040,
        colorDepth: 24,
        pixelDepth: 24,
        availLeft: 0,
        availTop: 0
      };
      
      Object.keys(fakeScreen).forEach(prop => {
        Object.defineProperty(screen, prop, {
          get: function() { return fakeScreen[prop]; }
        });
      });
      
      // === MASQUER LA TIMEZONE ===
      
      const originalDateGetTimezoneOffset = Date.prototype.getTimezoneOffset;
      Date.prototype.getTimezoneOffset = function() {
        return 0; // UTC
      };
      
      const originalIntlDateTimeFormat = Intl.DateTimeFormat;
      Intl.DateTimeFormat = function(locales, options) {
        options = options || {};
        options.timeZone = 'UTC';
        return new originalIntlDateTimeFormat(locales, options);
      };
      Intl.DateTimeFormat.prototype = originalIntlDateTimeFormat.prototype;
      
      // === BLOQUER BATTERY API ===
      
      if (navigator.getBattery) {
        navigator.getBattery = function() {
          return Promise.resolve({
            charging: true,
            chargingTime: 0,
            dischargingTime: Infinity,
            level: 1,
            addEventListener: function() {},
            removeEventListener: function() {}
          });
        };
      }
      
      // === BLOQUER NETWORK INFORMATION API ===
      
      if (navigator.connection) {
        Object.defineProperty(navigator, 'connection', {
          get: function() {
            return {
              effectiveType: '4g',
              downlink: 10,
              rtt: 50,
              saveData: false,
              addEventListener: function() {},
              removeEventListener: function() {}
            };
          }
        });
      }
      
      // === BLOQUER SPEECH SYNTHESIS (utilisé pour fingerprint) ===
      
      if (window.speechSynthesis) {
        const originalGetVoices = window.speechSynthesis.getVoices;
        window.speechSynthesis.getVoices = function() {
          return []; // Retourner une liste vide
        };
      }
      
      // === BLOQUER FONTS FINGERPRINT ===
      
      // Override measureText pour donner des valeurs constantes
      const originalMeasureText = CanvasRenderingContext2D.prototype.measureText;
      CanvasRenderingContext2D.prototype.measureText = function(text) {
        const metrics = originalMeasureText.call(this, text);
        
        // Retourner des métriques légèrement modifiées
        return {
          width: Math.round(metrics.width),
          actualBoundingBoxLeft: metrics.actualBoundingBoxLeft,
          actualBoundingBoxRight: metrics.actualBoundingBoxRight,
          actualBoundingBoxAscent: metrics.actualBoundingBoxAscent,
          actualBoundingBoxDescent: metrics.actualBoundingBoxDescent,
          fontBoundingBoxAscent: metrics.fontBoundingBoxAscent,
          fontBoundingBoxDescent: metrics.fontBoundingBoxDescent
        };
      };
      
      console.log('🛡️ Privacy Aegis: Anti-fingerprint actif');
      
    })();
  `;
  
  // Injecter AVANT tout autre script
  (document.head || document.documentElement).prepend(script);
  script.remove();
  
})();
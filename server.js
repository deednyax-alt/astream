const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Activer CORS pour permettre au frontend d'accéder au proxy
app.use(cors());
app.use(express.json());

// Proxy de télémétrie pour éviter les erreurs CORS navigateur sur send-key-bug
app.post('/api/send-key-bug', async (req, res) => {
  try {
    await axios.post('https://deadcow-streaming.lol/api/v1/send-key-bug', req.body, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 5000
    });
    res.json({ success: true });
  } catch (e) {
    res.status(200).json({ success: false, error: e.message });
  }
});

let isMaintenanceMode = false;
let maintenanceMessage = "Le site DeadCow Streaming est actuellement en cours de maintenance pour mise à jour et optimisation des serveurs.";

// API Healthcheck (Surveillance de santé du serveur Node & mode maintenance)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', maintenance: isMaintenanceMode, maintenanceMessage, uptime: process.uptime(), timestamp: Date.now() });
});

const WEEKLY_SCHEDULE_DATA = {
  lundi: [
    { id: 'https://anime-sama.to/catalogue/vinland-saga/', title: 'Vinland Saga — S2 Ep. 24', type: 'anime', rating: 9.2, poster: 'https://raw.githubusercontent.com/Anime-Sama/IMG/img/contenu/vinland-saga.jpg', genres: [{ name: '🕒 18:00 · Action' }] },
    { id: 'https://anime-sama.to/catalogue/tower-of-god/', title: 'Tower of God — S2 Ep. 14', type: 'anime', rating: 8.5, poster: 'https://raw.githubusercontent.com/Anime-Sama/IMG/img/contenu/tower-of-god.jpg', genres: [{ name: '🕒 19:30 · Aventure' }] },
    { id: 'https://anime-sama.to/catalogue/bleach/', title: 'Bleach: TYBW — Ep. 26', type: 'anime', rating: 9.3, poster: 'https://raw.githubusercontent.com/Anime-Sama/IMG/img/contenu/bleach.jpg', genres: [{ name: '🕒 21:00 · Action' }] }
  ],
  mardi: [
    { id: 'https://anime-sama.to/catalogue/overlord/', title: 'Overlord — S4 Ep. 13', type: 'anime', rating: 8.7, poster: 'https://raw.githubusercontent.com/Anime-Sama/IMG/img/contenu/overlord.jpg', genres: [{ name: '🕒 18:30 · Isekai' }] },
    { id: 'https://anime-sama.to/catalogue/dandadan/', title: 'Dandadan — Épisode 12', type: 'anime', rating: 9.1, poster: 'https://raw.githubusercontent.com/Anime-Sama/IMG/img/contenu/dandadan.jpg', genres: [{ name: '🕒 17:00 · Surnaturel' }] },
    { id: 'https://anime-sama.to/catalogue/black-clover/', title: 'Black Clover — Ep. 170', type: 'anime', rating: 8.9, poster: 'https://raw.githubusercontent.com/Anime-Sama/IMG/img/contenu/black-clover.jpg', genres: [{ name: '🕒 19:00 · Shonen' }] }
  ],
  mercredi: [
    { id: 'https://anime-sama.to/catalogue/re-zero/', title: 'Re:Zero — S3 Ep. 8', type: 'anime', rating: 9.0, poster: 'https://raw.githubusercontent.com/Anime-Sama/IMG/img/contenu/re-zero.jpg', genres: [{ name: '🕒 16:30 · Drame' }] },
    { id: 'https://anime-sama.to/catalogue/kaiju-no-8/', title: 'Kaiju N°8 — Ep. 12', type: 'anime', rating: 8.8, poster: 'https://raw.githubusercontent.com/Anime-Sama/IMG/img/contenu/kaiju-no-8.jpg', genres: [{ name: '🕒 18:00 · Sci-Fi' }] },
    { id: 'https://anime-sama.to/catalogue/mob-psycho-100/', title: 'Mob Psycho 100 — S3 Ep. 12', type: 'anime', rating: 9.4, poster: 'https://raw.githubusercontent.com/Anime-Sama/IMG/img/contenu/mob-psycho-100.jpg', genres: [{ name: '🕒 20:00 · Comédie' }] }
  ],
  jeudi: [
    { id: 'https://anime-sama.to/catalogue/dr-stone/', title: 'Dr. STONE — S4 Ep. 10', type: 'anime', rating: 8.9, poster: 'https://raw.githubusercontent.com/Anime-Sama/IMG/img/contenu/dr-stone.jpg', genres: [{ name: '🕒 17:30 · Aventure' }] },
    { id: 'https://anime-sama.to/catalogue/wind-breaker/', title: 'Wind Breaker — Ep. 12', type: 'anime', rating: 8.7, poster: 'https://raw.githubusercontent.com/Anime-Sama/IMG/img/contenu/wind-breaker.jpg', genres: [{ name: '🕒 19:00 · Baston' }] },
    { id: 'https://anime-sama.to/catalogue/mushoku-tensei/', title: 'Mushoku Tensei — S2 Ep. 24', type: 'anime', rating: 9.2, poster: 'https://raw.githubusercontent.com/Anime-Sama/IMG/img/contenu/mushoku-tensei.jpg', genres: [{ name: '🕒 20:30 · Fantastique' }] }
  ],
  vendredi: [
    { id: 'https://anime-sama.to/catalogue/frieren/', title: 'Frieren — Ep. 28', type: 'anime', rating: 9.5, poster: 'https://raw.githubusercontent.com/Anime-Sama/IMG/img/contenu/frieren.jpg', genres: [{ name: '🕒 17:00 · Aventure' }] },
    { id: 'https://anime-sama.to/catalogue/dragon-ball-daima/', title: 'Dragon Ball Daima — Ep. 10', type: 'anime', rating: 8.8, poster: 'https://raw.githubusercontent.com/Anime-Sama/IMG/img/contenu/dragon-ball-daima.jpg', genres: [{ name: '🕒 18:30 · Combat' }] },
    { id: 'https://anime-sama.to/catalogue/fire-force/', title: 'Fire Force — S2 Ep. 24', type: 'anime', rating: 8.6, poster: 'https://raw.githubusercontent.com/Anime-Sama/IMG/img/contenu/fire-force.jpg', genres: [{ name: '🕒 20:00 · Action' }] }
  ],
  samedi: [
    { id: 'https://anime-sama.to/catalogue/solo-leveling/', title: 'Solo Leveling — S2 Ep. 4', type: 'anime', rating: 9.3, poster: 'https://raw.githubusercontent.com/Anime-Sama/IMG/img/contenu/solo-leveling0.jpg', genres: [{ name: '🕒 18:00 · Action' }] },
    { id: 'https://anime-sama.to/catalogue/blue-lock/', title: 'Blue Lock — S2 Ep. 10', type: 'anime', rating: 9.0, poster: 'https://raw.githubusercontent.com/Anime-Sama/IMG/img/contenu/blue-lock.jpg', genres: [{ name: '🕒 19:30 · Sport' }] },
    { id: 'https://anime-sama.to/catalogue/my-hero-academia/', title: 'My Hero Academia — S7 Ep. 21', type: 'anime', rating: 8.9, poster: 'https://raw.githubusercontent.com/Anime-Sama/IMG/img/contenu/my-hero-academia.jpg', genres: [{ name: '🕒 11:30 · Super-Héros' }] }
  ],
  dimanche: [
    { id: 'https://anime-sama.to/catalogue/one-piece/', title: 'One Piece — Ep. 1122', type: 'anime', rating: 9.6, poster: 'https://raw.githubusercontent.com/Anime-Sama/IMG/img/contenu/one-piece.jpg', genres: [{ name: '🕒 09:30 · Aventure' }] },
    { id: 'https://anime-sama.to/catalogue/jujutsu-kaisen/', title: 'Jujutsu Kaisen — S2 Ep. 23', type: 'anime', rating: 9.4, poster: 'https://raw.githubusercontent.com/Anime-Sama/IMG/img/contenu/jujutsu-kaisen.jpg', genres: [{ name: '🕒 19:00 · Fantastique' }] },
    { id: 'https://anime-sama.to/catalogue/demon-slayer/', title: 'Demon Slayer — S4 Ep. 8', type: 'anime', rating: 9.5, poster: 'https://raw.githubusercontent.com/Anime-Sama/IMG/img/contenu/demon-slayer.jpg', genres: [{ name: '🕒 17:30 · Action' }] },
    { id: 'https://anime-sama.to/catalogue/chainsaw-man/', title: 'Chainsaw Man — Ep. 12', type: 'anime', rating: 8.8, poster: 'https://raw.githubusercontent.com/Anime-Sama/IMG/img/contenu/chainsaw-man.jpg', genres: [{ name: '🕒 20:30 · Action' }] }
  ]
};

// API : Planning des Sorties Hebdomadaires Anime
app.get('/api/schedule', (req, res) => {
  const day = req.query.day ? req.query.day.toLowerCase() : null;
  if (day && WEEKLY_SCHEDULE_DATA[day]) {
    return res.json({ success: true, day, releases: WEEKLY_SCHEDULE_DATA[day] });
  }
  res.json({ success: true, schedule: WEEKLY_SCHEDULE_DATA });
});

// API : Statut du mode maintenance
app.get('/api/maintenance/status', (req, res) => {
  res.json({ maintenance: isMaintenanceMode, message: maintenanceMessage });
});

// API : Basculement du mode maintenance (Toggle ON/OFF)
app.post('/api/maintenance/toggle', (req, res) => {
  if (req.body && typeof req.body.enabled === 'boolean') {
    isMaintenanceMode = req.body.enabled;
  } else {
    isMaintenanceMode = !isMaintenanceMode;
  }
  if (req.body && req.body.message) {
    maintenanceMessage = req.body.message;
  }
  console.log(`[Maintenance] Mode maintenance : ${isMaintenanceMode ? 'ACTIVÉ 🟡' : 'DÉSACTIVÉ 🟢'}`);
  res.json({ success: true, maintenance: isMaintenanceMode, message: maintenanceMessage });
});

// Servir les fichiers statiques du frontend
app.use(express.static(path.join(__dirname, 'frontend')));

// API : Récupérer la liste des animes (scrapes ou mock)
app.get('/api/animes', (req, res) => {
  const scrapedPath = path.join(__dirname, 'scraper', 'scraped_anime.json');
  const mockPath = path.join(__dirname, 'frontend', 'mockData.json');

  if (fs.existsSync(scrapedPath)) {
    fs.readFile(scrapedPath, 'utf8', (err, data) => {
      if (err) return res.status(500).json({ error: "Erreur de lecture des données scrapées." });
      res.json(JSON.parse(data));
    });
  } else if (fs.existsSync(mockPath)) {
    fs.readFile(mockPath, 'utf8', (err, data) => {
      if (err) return res.status(500).json({ error: "Erreur de lecture des données de démo." });
      res.json(JSON.parse(data));
    });
  } else {
    res.status(404).json({ error: "Aucune donnée disponible." });
  }
});

// Proxy Vidéo Premium avec support complet des requêtes partielles (HTTP Range 206) pour PC & iOS (iPhone)
app.get('/api/proxy', async (req, res) => {
  const videoUrl = req.query.url;
  const referer = req.query.referer || '';

  console.log(`[Proxy] Requête reçue pour : ${videoUrl} (Referer: ${referer}) (Range: ${req.headers.range || 'Aucun'})`);

  if (!videoUrl) {
    console.log(`[Proxy] Erreur: URL manquante.`);
    return res.status(400).send('Le paramètre URL est requis.');
  }

  // Préparation des headers pour l'hébergeur distant (avec ajustement automatique du Referer pour contourner les 403)
  const headers = {
    'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  };

  try {
    const targetObj = new URL(videoUrl);
    if (!targetObj.host.includes('deadcow')) {
      // Les CDN HLS externes (ex: vmwesa.online) bloquent deadcow avec un 403 ; envoyer leur propre origin
      headers['Referer'] = `https://${targetObj.host}/`;
    } else if (referer) {
      headers['Referer'] = referer;
    }
  } catch (e) {
    if (referer) headers['Referer'] = referer;
  }

  // Si le client (ex: Safari sur iPhone) demande une partie de la vidéo
  if (req.headers.range) {
    headers['Range'] = req.headers.range;
  }

  try {
    // Effectuer la requête vers la vidéo brute
    const response = await axios({
      method: 'get',
      url: videoUrl,
      headers: headers,
      responseType: 'stream',
      timeout: 30000,
      validateStatus: (status) => status >= 200 && status < 300 || status === 206
    });

    // Copier les headers importants de la réponse de l'hébergeur vers le client
    const headersToForward = [
      'content-type',
      'content-length',
      'content-range',
      'accept-ranges',
      'cache-control'
    ];

    headersToForward.forEach(header => {
      if (response.headers[header]) {
        res.setHeader(header, response.headers[header]);
      }
    });

    // Forcer Content-Type video/mp4 si l'hébergeur renvoie un type générique (ex: application/octet-stream)
    const ct = (response.headers['content-type'] || '').toLowerCase();
    if (!ct.includes('video/') && !ct.includes('application/vnd.apple.mpegurl') && !ct.includes('audio/')) {
      res.setHeader('content-type', 'video/mp4');
    }

    // Renvoyer le statut approprié (206 pour le Range/iOS, ou 200 standard)
    res.status(response.status);

    // Streamer la vidéo au client
    response.data.pipe(res);

    // Gérer les fermetures de connexion prématurées
    req.on('close', () => {
      response.data.destroy();
    });

  } catch (error) {
    console.error('Erreur Proxy Vidéo:', error.message);
    if (error.response) {
      res.status(error.response.status).send(error.response.statusText);
    } else {
      res.status(500).send('Erreur lors de la récupération de la vidéo.');
    }
  }
});

// Proxy Embed HTML pour débloquer les X-Frame-Options & Content-Security-Policy (CSP)
app.get('/api/embed-proxy', async (req, res) => {
  const embedUrl = req.query.url;
  const referer = req.query.referer || embedUrl;

  console.log(`[Embed Proxy] Déblocage de l'iframe pour : ${embedUrl}`);

  if (!embedUrl) return res.status(400).send('URL requise.');

  try {
    const response = await axios.get(embedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': referer,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      timeout: 15000,
      maxRedirects: 10,
      validateStatus: s => s < 500
    });

    if (response.status >= 400) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(`<div style="color:#ef4444;font-family:sans-serif;padding:30px;text-align:center;background:#06070a;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;">
        <h3 style="font-size:1.2rem;margin-bottom:10px;">⚠ Ce lecteur vidéo est indisponible (Erreur ${response.status})</h3>
        <p style="color:#9ca3af;margin-top:5px;">Basculement automatique vers une autre source disponible...</p>
        <script>
          try {
            window.parent.postMessage({ type: 'EMBED_404', status: ${response.status} }, '*');
          } catch(e) {}
        </script>
      </div>`);
    }

    let html = response.data;
    if (typeof html === 'string') {
      // Détecter si la vidéo a été supprimée chez l'hébergeur (détection structurelle fiable pour Sibnet & hébergeurs génériques)
      const isDeadSibnet = embedUrl.includes('sibnet.ru') && !html.includes('.mp4') && !html.includes('player.src');
      const isDeadGeneric = html.includes('File was deleted') || html.includes('Video not found') || html.includes('404 Not Found');

      if (isDeadSibnet || isDeadGeneric) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.send(`<div style="color:#ef4444;font-family:sans-serif;padding:30px;text-align:center;background:#06070a;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;">
          <h3 style="font-size:1.3rem;margin-bottom:10px;">⚠ Fichier vidéo supprimé par l'hébergeur</h3>
          <p style="color:#9ca3af;max-width:480px;line-height:1.5;">Ce fichier n'est plus disponible sur ce serveur. Veuillez choisir un autre lecteur dans le menu déroulant en haut du lecteur.</p>
        </div>`);
      }

      // Injecter la balise <base> pour résoudre les URLs relatives vers l'hôte d'origine
      try {
        const urlObj = new URL(embedUrl);
        const originUrl = `${urlObj.protocol}//${urlObj.host}/`;
        if (html.includes('<head>')) {
          html = html.replace('<head>', `<head><base href="${originUrl}">`);
        } else {
          html = `<base href="${originUrl}">${html}`;
        }
      } catch (e) {}

      // Filtrer les scripts publicitaires et trackers connus (SANS bloquer les scripts indispensables du player Yandex/Sibnet)
      const AD_PATTERNS = [
        /betweendigital/gi,
        /adfox\/header-bidding/gi,
        /cvt1\.sibnet\.ru\/sbcount/gi,
        /googlesyndication/gi,
        /doubleclick/gi,
        /yandex\.ru\/ads/gi,
        /mc\.yandex/gi,
        /vignette/gi,
        /tag\.min\.js/gi,
        /disable-devtool/gi,
        /theajack/gi,
        /cordClip/gi,
        /cloudnestra/gi
      ];

      // Supprimer les balises <script src="..."> contenant des domaines pub
      html = html.replace(/<script[^>]+src=["'][^"']*["'][^>]*><\/script>/gi, (match) => {
        const isAd = AD_PATTERNS.some(p => p.test(match));
        return isAd ? '<!-- [ad script removed] -->' : match;
      });

      // Supprimer les balises <script> inline contenant des appels pub ou anti-devtools
      html = html.replace(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/gi, (match, content) => {
        const isAd = /betweendigital|adfox\/header|header.?bidding|disable-devtool|theajack|cordClip|vignette|cloudnestra/gi.test(content);
        return isAd ? '<!-- [ad inline removed] -->' : match;
      });

      // Injection d'un bloqueur pub runtime (silencieux, anti-warning capteurs & bloqueur XHR/fetch/beacon pub)
      const adBlockerScript = `
<script>
(function() {
  var AD_RE = new RegExp("betweendigital|adfox|header-bidding|googlesyndication|doubleclick|adjson|sbcount|cvt1|vignette|tag\\\\.min|disable-devtool|theajack|cordClip|cloudnestra", "i");
  
  // Neutraliser disable-devtool (évite le 404 cordClip, ReferenceError et le blocage F12)
  var dummyFn = function() {};
  dummyFn.isSupported = true;
  dummyFn.md5 = function() { return ''; };

  window.disableDevtool = dummyFn;
  window.DisableDevtool = dummyFn;
  window.DisableDevTool = dummyFn;
  window.disableDevTool = dummyFn;

  ['disableDevtool', 'DisableDevtool', 'DisableDevTool', 'disableDevTool'].forEach(function(prop) {
    try {
      Object.defineProperty(window, prop, {
        get: function() { return dummyFn; },
        set: function() {}
      });
    } catch(e) {}
  });

  // Débloquer systématiquement la touche F12 et les raccourcis devtools
  window.addEventListener('keydown', function(e) {
    if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c')) || (e.ctrlKey && (e.key === 'u' || e.key === 'U'))) {
      e.stopImmediatePropagation();
      return true;
    }
  }, true);

  // Neutraliser les boucles debugger; abusives des scripts tiers
  var _Function = window.Function;
  window.Function = function() {
    var args = Array.prototype.slice.call(arguments);
    if (args.length > 0 && typeof args[args.length - 1] === 'string' && args[args.length - 1].indexOf('debugger') !== -1) {
      return function() {};
    }
    return _Function.apply(this, args);
  };

  // Neutraliser les tentatives de détection Bluetooth
  if (navigator.bluetooth) {
    try {
      Object.defineProperty(navigator, 'bluetooth', {
        get: function() {
          return {
            getAvailability: function() { return Promise.resolve(false); },
            requestDevice: function() { return Promise.reject(new DOMException("Bluetooth non disponible", "NotAllowedError")); }
          };
        }
      });
    } catch(e) {}
  }

  // Intercepter et neutraliser XHR publicitaires (renvoie statut 200 factice)
  var _xhrOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url) {
    if (AD_RE.test(url || '')) {
      this.send = function() {
        Object.defineProperty(this, 'status', { value: 200 });
        Object.defineProperty(this, 'responseText', { value: '{}' });
        if (typeof this.onreadystatechange === 'function') this.onreadystatechange();
        if (typeof this.onload === 'function') this.onload();
      };
      return;
    }
    return _xhrOpen.apply(this, arguments);
  };
  // Intercepter et neutraliser fetch publicitaires
  var _fetch = window.fetch;
  if (_fetch) {
    window.fetch = function(url, opts) {
      var u = (typeof url === 'string') ? url : (url && url.url);
      if (AD_RE.test(u || '')) {
        return Promise.resolve(new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      return _fetch.apply(this, arguments);
    };
  }
  // Intercepter sendBeacon publicitaires
  if (navigator.sendBeacon) {
    navigator.sendBeacon = function(url, data) {
      if (AD_RE.test(url || '')) return true;
      return true;
    };
  }
  // Intercepter et ignorer silencieusement les écouteurs de capteurs (devicemotion/accelerometer)
  var _addEventListener = window.addEventListener.bind(window);
  window.addEventListener = function(type, listener, options) {
    if (type === 'devicemotion' || type === 'deviceorientation') return;
    return _addEventListener(type, listener, options);
  };
  // Bloquer window.open (popups pub)
  var _open = window.open;
  window.open = function(url) {
    if (AD_RE.test(url || '')) return null;
    return _open.apply(this, arguments);
  };
  // Bloquer l'injection dynamique de scripts pub
  var _createElement = document.createElement.bind(document);
  document.createElement = function(tag) {
    var el = _createElement(tag);
    if (tag && tag.toLowerCase() === 'script') {
      var origSrc = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, 'src');
      Object.defineProperty(el, 'src', {
        set: function(v) { if (!AD_RE.test(v || '')) origSrc.set.call(this, v); },
        get: function() { return origSrc.get.call(this); }
      });
    }
    return el;
  };
})();
</script>`;
      html = html.replace('<head>', `<head>${adBlockerScript}`);
    }

    res.removeHeader('X-Frame-Options');
    res.removeHeader('Content-Security-Policy');
    res.setHeader('Content-Type', response.headers['content-type'] || 'text/html');

    res.send(html);
  } catch (error) {
    console.error('Erreur Embed Proxy:', error.message);
    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(`<div style="color:#ef4444;font-family:sans-serif;padding:30px;text-align:center;background:#000;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;">
      <h3>⚠ Hébergeur indisponible (${error.message})</h3>
      <p style="color:#9ca3af;margin-top:10px;">Veuillez changer de lecteur/source en haut à droite.</p>
    </div>`);
  }
});

// Résolution directe d'URL depuis les embeds Sibnet / Vidmoly (sans iframe)
app.get('/api/resolve-embed', async (req, res) => {
  const embedUrl = req.query.url;
  if (!embedUrl) return res.status(400).json({ error: 'URL requise.' });

  console.log(`[Embed Resolver] Extraction URL directe depuis : ${embedUrl}`);

  try {
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

    // ── Sibnet ─────────────────────────────────────────────────
    if (embedUrl.includes('sibnet.ru')) {
      const videoIdMatch = embedUrl.match(/videoid=(\d+)/);
      if (!videoIdMatch) return res.status(400).json({ error: 'ID vidéo Sibnet introuvable.' });

      const videoId = videoIdMatch[1];

      // Étape 1 : Charger shell.php pour obtenir les cookies de session Sibnet
      const shellResp = await axios.get(`https://video.sibnet.ru/shell.php?videoid=${videoId}`, {
        headers: { 'User-Agent': ua, 'Referer': 'https://video.sibnet.ru/' },
        timeout: 10000
      });

      // Extraire les cookies de la réponse shell.php
      const rawCookies = shellResp.headers['set-cookie'] || [];
      const cookieStr = rawCookies.map(c => c.split(';')[0]).join('; ');

      // Étape 2 : Appeler /video.php avec les cookies — Sibnet renvoie 302 vers le MP4
      const videoResp = await axios.get(`https://video.sibnet.ru/video.php?videoid=${videoId}`, {
        maxRedirects: 0,
        validateStatus: s => s < 500,
        headers: {
          'User-Agent': ua,
          'Referer': `https://video.sibnet.ru/shell.php?videoid=${videoId}`,
          'Cookie': cookieStr || 'video_adult_confirmed=1'
        }
      });

      // La redirection 302 contient l'URL du MP4
      const location = videoResp.headers['location'];
      if (location) {
        const fullMp4 = location.startsWith('http') ? location : `https://video.sibnet.ru${location}`;
        console.log(`[Sibnet] MP4 extrait : ${fullMp4}`);
        return res.json({
          success: true,
          videoUrl: `/api/proxy?url=${encodeURIComponent(fullMp4)}&referer=${encodeURIComponent('https://video.sibnet.ru/')}`,
          type: 'mp4'
        });
      }

      // Fallback : chercher src: "..." dans le HTML de shell.php
      const shellHtml = shellResp.data || '';
      const srcMatch = shellHtml.match(/src\s*:\s*["']([^"']+\.mp4[^"']*)/);
      if (srcMatch) {
        const mp4Url = srcMatch[1].startsWith('http') ? srcMatch[1] : `https://video.sibnet.ru${srcMatch[1]}`;
        return res.json({
          success: true,
          videoUrl: `/api/proxy?url=${encodeURIComponent(mp4Url)}&referer=${encodeURIComponent('https://video.sibnet.ru/')}`,
          type: 'mp4'
        });
      }

      console.warn(`[Sibnet] Aucune URL MP4 trouvée pour videoid=${videoId}, basculement iframe.`);
      return res.json({ success: false, error: 'URL MP4 Sibnet introuvable.' });
    }

    // ── Vidmoly ────────────────────────────────────────────────
    if (embedUrl.includes('vidmoly.to')) {
      const vidResp = await axios.get(embedUrl, {
        headers: { 'User-Agent': ua, 'Referer': 'https://vidmoly.to/' },
        timeout: 10000
      });
      const html = vidResp.data || '';

      // Chercher le fichier source M3U8 ou MP4 dans les scripts du player
      const m3u8Match = html.match(/["'](https?:\/\/[^"']+\.m3u8[^"']*)/);
      const mp4Match  = html.match(/["'](https?:\/\/[^"']+\.mp4[^"']*)/);

      if (m3u8Match) {
        return res.json({ success: true, videoUrl: `/api/proxy?url=${encodeURIComponent(m3u8Match[1])}&referer=${encodeURIComponent('https://vidmoly.to/')}`, type: 'hls' });
      }
      if (mp4Match) {
        return res.json({ success: true, videoUrl: `/api/proxy?url=${encodeURIComponent(mp4Match[1])}&referer=${encodeURIComponent('https://vidmoly.to/')}`, type: 'mp4' });
      }

      return res.json({ success: false, error: 'URL Vidmoly introuvable, utilisation de l\'iframe.' });
    }

    return res.json({ success: false, error: 'Hébergeur non supporté par le résolveur direct.' });

  } catch (error) {
    console.error('[Embed Resolver] Erreur:', error.message);
    res.json({ success: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`===========================================================`);
  console.log(` SERVEUR PREMIUM ANIME STREAMING & PROXY DÉMARRÉ `);
  console.log(` URL locale : http://localhost:${PORT} `);
  console.log(`===========================================================`);
});

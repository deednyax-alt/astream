const axios = require('axios');
const http  = require('http');

const LOCAL_SERVER = 'http://localhost:3000';
const API_KEY      = 'dc_live_c5d15446a0c5cf51b22b5be9';
const DC_API       = 'https://deadcow-streaming.lol/api/v1';

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': '*/*',
  'Referer': 'https://deadcow-streaming.lol/'
};

async function verifySite100Percent() {
  console.log('===========================================================');
  console.log('      AUDIT ET VÉRIFICATION 100% OPÉRATIONNEL - ASTREAM    ');
  console.log('===========================================================');
  let passed = 0;
  let total  = 0;

  async function checkTest(name, fn) {
    total++;
    try {
      await fn();
      console.log(`[PASS ✅] ${name}`);
      passed++;
    } catch (err) {
      console.log(`[FAIL ❌] ${name} -> ${err.message}`);
    }
  }

  // 1. Healthcheck Serveur Local
  await checkTest('1. Serveur Node local (HTTP 200 sur port 3000)', async () => {
    const res = await axios.get(`${LOCAL_SERVER}/api/health`, { headers, timeout: 5000 });
    if (res.status !== 200 || res.data.status !== 'ok') throw new Error(`Status HTTP ${res.status}`);
  });

  // 2. API Planning Hebdomadaire
  await checkTest('2. API Planning Hebdomadaire (/api/schedule?day=dimanche)', async () => {
    const res = await axios.get(`${LOCAL_SERVER}/api/schedule?day=dimanche`, { headers, timeout: 5000 });
    if (!res.data.success || !res.data.releases || res.data.releases.length === 0) throw new Error('Données planning manquantes');
  });

  // 3. Proxy Embeds VidSrc & Neutralisation Anti-Devtools
  await checkTest('3. Proxy Embeds VidSrc (/api/embed-proxy)', async () => {
    const embedUrl = encodeURIComponent('https://vidsrc.me/embed/movie?tmdb=1083381');
    const res = await axios.get(`${LOCAL_SERVER}/api/embed-proxy?url=${embedUrl}`, { headers, timeout: 5000 });
    if (!res.data.includes('<base href="https://vidsrc.me/">') || !res.data.includes('DisableDevtool')) {
      throw new Error('Injection base tag ou mock disableDevtool absente');
    }
  });

  // 4. API Catalogue Animes (One Piece)
  await checkTest('4. API Catalogue Animes (One Piece)', async () => {
    const res = await axios.get(`${DC_API}/seasons?key=${API_KEY}&id=${encodeURIComponent('https://anime-sama.to/catalogue/one-piece/')}`, { headers, timeout: 8000 });
    if (!res.data) throw new Error('Données anime non trouvées');
  });

  // 5. API Séries TV (Breaking Bad)
  await checkTest('5. API Séries TV (Breaking Bad)', async () => {
    const res = await axios.get(`${DC_API}/seasons?key=${API_KEY}&id=${encodeURIComponent('https://anime-sama.to/catalogue/breaking-bad/')}`, { headers, timeout: 8000 });
    if (!res.data) throw new Error('Données série non trouvées');
  });

  // 6. Flux IPTV Live HD (ADN Anime / BFM2 Live)
  await checkTest('6. Flux IPTV Live HD 1080p (BFM2 Live HLS Playlist)', () => {
    return new Promise((resolve, reject) => {
      const streamUrl = encodeURIComponent('https://d1ib1gsg71oarf.cloudfront.net/v1/master/3722c60a815c199d9c0ef36c5b73da68a62b09d1/cc-scp7wda722jph/BFM2_FR.m3u8');
      http.get(`${LOCAL_SERVER}/api/proxy?url=${streamUrl}`, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          if (res.statusCode === 200 && body.includes('#EXTM3U')) resolve();
          else reject(new Error(`HTTP ${res.statusCode}`));
        });
      }).on('error', reject);
    });
  });

  // 7. Résolution Film TMDB (Inception)
  await checkTest('7. Résolution Film TMDB (Inception ID 27205)', async () => {
    const tmdbUrl = `https://vidsrc.me/embed/movie?tmdb=27205`;
    const res = await axios.get(`${LOCAL_SERVER}/api/embed-proxy?url=${encodeURIComponent(tmdbUrl)}`, { headers, timeout: 5000 });
    if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
  });

  console.log('===========================================================');
  console.log(`  RÉSULTAT DE AUDIT : ${passed} / ${total} TESTS RÉUSSIS (${Math.round((passed/total)*100)}%)`);
  console.log('===========================================================');
}

verifySite100Percent();

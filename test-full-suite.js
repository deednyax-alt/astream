const axios = require('axios');

const API_KEY  = 'dc_live_c5d15446a0c5cf51b22b5be9';
const BASE_URL = 'https://deadcow-streaming.lol/api/v1';
const headers  = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Referer': 'https://deadcow-streaming.lol/' };

async function runFullAudit() {
  console.log('================================================================');
  console.log('    TEST SUITE COMPLET : ANIMES, SERIES TV, FILMS & LECTEUR     ');
  console.log('================================================================\n');

  const mediaList = [
    // --- ANIMES ---
    { name: 'Anime: One Piece (VF)', query: 'one piece', type: 'anime', ep: 1, ver: 'vf' },
    { name: 'Anime: One Piece (VOSTFR)', query: 'one piece', type: 'anime', ep: 1, ver: 'vostfr' },
    { name: 'Anime: Dragon Ball Super (VF)', query: 'dragon ball super', type: 'anime', ep: 1, ver: 'vf' },
    { name: 'Anime: Dragon Ball Super (VOSTFR)', query: 'dragon ball super', type: 'anime', ep: 1, ver: 'vostfr' },
    { name: 'Anime: Naruto Shippuden (VF)', query: 'naruto', type: 'anime', ep: 1, ver: 'vf' },
    { name: 'Anime: Demon Slayer (VF)', query: 'demon slayer', type: 'anime', ep: 1, ver: 'vf' },
    { name: 'Anime: Solo Leveling (VOSTFR)', query: 'solo leveling', type: 'anime', ep: 1, ver: 'vostfr' },

    // --- SERIES TV ---
    { name: 'Série: Game of Thrones (S01E01)', query: 'game of thrones', type: 'tv', ep: 1, season: 1, ver: 'vf' },
    { name: 'Série: Breaking Bad (S01E01)', query: 'breaking bad', type: 'tv', ep: 1, season: 1, ver: 'vf' },
    { name: 'Série: The Rookie (S01E01)', query: 'the rookie', type: 'tv', ep: 1, season: 1, ver: 'vf' },
    { name: 'Série: House of the Dragon (S01E01)', query: 'house of the dragon', type: 'tv', ep: 1, season: 1, ver: 'vf' },

    // --- FILMS ---
    { name: 'Film: Inception', query: 'inception', type: 'movie', ep: 1, ver: 'vf' },
    { name: 'Film: Vaiana 2', query: 'vaiana 2', type: 'movie', ep: 1, ver: 'vf' },
    { name: 'Film: Avatar (2009)', query: 'avatar', type: 'movie', ep: 1, ver: 'vf' },
    { name: 'Film: Dune (2021)', query: 'dune', type: 'movie', ep: 1, ver: 'vf' },
    { name: 'Film: Interstellar', query: 'interstellar', type: 'movie', ep: 1, ver: 'vf' }
  ];

  let totalTested = 0;
  let totalSuccess = 0;

  for (const item of mediaList) {
    totalTested++;
    try {
      // Étape 1 : Recherche
      const searchRes = await axios.get(`${BASE_URL}/search?q=${encodeURIComponent(item.query)}&type=${item.type}&key=${API_KEY}`, { headers, timeout: 15000 });
      const results = searchRes.data.results || [];
      if (results.length === 0) {
        console.log(`❌ [${totalTested}/${mediaList.length}] ${item.name.padEnd(38)} | Recherche 0 résultat`);
        continue;
      }
      const match = results[0];
      const targetId = match.id || match.tmdbId;

      // Étape 2 : Résolution du flux vidéo
      const start = Date.now();
      const params = { id: targetId, type: item.type, episode: item.ep, version: item.ver, key: API_KEY };
      if (item.season) params.season = item.season;

      const resolveRes = await axios.get(`${BASE_URL}/resolve?` + new URLSearchParams(params).toString(), { headers, timeout: 20000 });
      const elapsed = Date.now() - start;
      const data = resolveRes.data;

      if (!data || !data.success) {
        console.log(`❌ [${totalTested}/${mediaList.length}] ${item.name.padEnd(38)} | Non résolu (${elapsed}ms)`);
        continue;
      }

      totalSuccess++;
      let mirrorsStr = '';
      if (data.embeds) {
        mirrorsStr = Object.keys(data.embeds).join(', ');
      }

      // Étape 3 : Ping du stream direct avec header Range
      let pingStatus = 'OK';
      if (data.streamUrl) {
        try {
          const testUrl = data.streamUrl.startsWith('/api/') ? `https://deadcow-streaming.lol${data.streamUrl}` : data.streamUrl;
          const ping = await axios.get(testUrl, { headers: { ...headers, Range: 'bytes=0-100' }, timeout: 8000, validateStatus: s => s < 400 });
          pingStatus = `HTTP ${ping.status}`;
        } catch (pErr) {
          pingStatus = pErr.response ? `HTTP ${pErr.response.status}` : 'Ping Err';
        }
      }

      console.log(`✅ [${totalTested}/${mediaList.length}] ${item.name.padEnd(38)} | ${elapsed}ms | Ping Stream: ${pingStatus} | Lecteurs: [${mirrorsStr}]`);

    } catch (err) {
      console.log(`❌ [${totalTested}/${mediaList.length}] ${item.name.padEnd(38)} | Erreur: ${err.message}`);
    }
  }

  console.log('\n================================================================');
  console.log(`   RÉSULTAT GLOBAL DU TEST: ${totalSuccess}/${totalTested} FLUX VALIDÉS (${Math.round((totalSuccess/totalTested)*100)}%)`);
  console.log('================================================================');
}

runFullAudit();

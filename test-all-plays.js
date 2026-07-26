const axios = require('axios');

const API_KEY  = 'dc_live_c5d15446a0c5cf51b22b5be9';
const BASE_URL = 'https://deadcow-streaming.lol/api/v1';
const headers  = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Referer': 'https://deadcow-streaming.lol/' };

async function runDiagnostic() {
  console.log('===========================================================');
  console.log('       DIAGNOSTIC DE LECTURE (ANIMES, SERIES, FILMS)       ');
  console.log('===========================================================\n');

  const targets = [
    { title: 'Anime: One Piece Ep 1', id: 'https://anime-sama.to/catalogue/one-piece/', type: 'anime', ep: 1, season: 1 },
    { title: 'Anime: Dragon Ball Super Ep 1', id: 'https://anime-sama.to/catalogue/dragon-ball-super/', type: 'anime', ep: 1, season: 1 },
    { title: 'Série TV: Game of Thrones S1E1', id: '1399', type: 'tv', ep: 1, season: 1 },
    { title: 'Film: Inception', id: '27205', type: 'movie', ep: 1 },
    { title: 'Film: Vaiana 2', id: '1241982', type: 'movie', ep: 1 }
  ];

  for (const item of targets) {
    console.log(`\n--- Test: ${item.title} (ID: ${item.id}, Type: ${item.type}) ---`);
    try {
      const start = Date.now();
      const params = { id: item.id, type: item.type, episode: item.ep, version: 'vf', key: API_KEY };
      if (item.season) params.season = item.season;

      const url = `${BASE_URL}/resolve?` + new URLSearchParams(params).toString();
      const res = await axios.get(url, { headers, timeout: 20000 });
      const elapsed = Date.now() - start;

      console.log(`✅ Success in ${elapsed}ms!`);
      console.log(`   Title: ${res.data.title}`);
      console.log(`   StreamUrl: ${res.data.streamUrl ? res.data.streamUrl.slice(0, 60) + '...' : 'none'}`);
      console.log(`   EmbedUrl:  ${res.data.embedUrl  ? res.data.embedUrl.slice(0, 60) + '...' : 'none'}`);
      console.log(`   Embeds:    ${res.data.embeds ? Object.keys(res.data.embeds).join(', ') : 'none'}`);
    } catch (err) {
      console.log(`❌ Fail: ${err.response?.status || err.message}`);
      if (err.response?.data) console.log(`   Detail:`, err.response.data);
    }
  }
}

runDiagnostic();

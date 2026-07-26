const axios = require('axios');

const API_KEY  = 'dc_live_c5d15446a0c5cf51b22b5be9';
const BASE_URL = 'https://deadcow-streaming.lol/api/v1';
const headers  = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Referer': 'https://deadcow-streaming.lol/' };

async function runAudit() {
  console.log('===========================================================');
  console.log('    AUDIT COMPLET DES ROUTES DEADCOW STREAMING API v1     ');
  console.log('===========================================================\n');

  const tests = [
    { name: '1. Search Anime (One Piece)', url: '/search?q=one+piece&type=anime' },
    { name: '2. Search TV Series (Game of Thrones)', url: '/search?q=game+of+thrones&type=tv' },
    { name: '3. Search Movie (Inception)', url: '/search?q=inception&type=movie' },
    { name: '4. Resolve Anime VF (One Piece Ep 1)', url: '/resolve?id=https%3A%2F%2Fanime-sama.to%2Fcatalogue%2Fone-piece%2F&type=anime&episode=1&version=vf' },
    { name: '5. Resolve Anime VOSTFR (Naruto Ep 1)', url: '/resolve?id=https%3A%2F%2Fanime-sama.to%2Fcatalogue%2Fnaruto%2F&type=anime&episode=1&version=vostfr' },
    { name: '6. Resolve Movie (Inception)', url: '/resolve?id=27205&type=movie&episode=1' },
    { name: '7. Catalog Popular TV', url: '/catalog/popular?type=tv&page=1' },
    { name: '8. Catalog Popular Movies', url: '/catalog/popular?type=movie&page=1' },
    { name: '9. Catalog Genres', url: '/catalog/genres' },
    { name: '10. IPTV Channels', url: '/iptv/channels' },
    { name: '11. IPTV Matches', url: '/iptv/matches' },
    { name: '12. MangaDex Search (Solo Leveling)', url: '/mangadex/search?q=solo+leveling' },
    { name: '13. Resolver Status (Pings)', url: '/resolvers/status' },
    { name: '14. WatchParty Rooms', url: '/watchparty' }
  ];

  for (const t of tests) {
    const fullUrl = `${BASE_URL}${t.url}${t.url.includes('?') ? '&' : '?'}key=${API_KEY}`;
    try {
      const start = Date.now();
      const res = await axios.get(fullUrl, { headers, timeout: 25000 });
      const elapsed = Date.now() - start;
      
      let summary = 'OK';
      if (res.data.embeds) {
        const embedKeys = Object.keys(res.data.embeds);
        summary = `[Embeds Vidéo: ${embedKeys.length} sources (${embedKeys.join(', ')})]`;
        if (res.data.streamUrl) summary += ` [Stream Direct: ${res.data.streamUrl.slice(0, 45)}...]`;
      } else if (res.data.results) {
        summary = `[${res.data.results.length} résultats]`;
      } else if (res.data.channels) {
        summary = `[${res.data.channels.length} chaînes TV]`;
      } else if (res.data.matches) {
        summary = `[${res.data.matches.length} matchs live]`;
      } else if (res.data.resolvers) {
        summary = `[Resolvers: ${Object.keys(res.data.resolvers).join(', ')}]`;
      }

      console.log(`✅ ${t.name.padEnd(42)} | ${res.status} OK | ${elapsed}ms | ${summary}`);
    } catch (err) {
      const status = err.response ? err.response.status : 'TIMEOUT/NET';
      const msg = err.response && err.response.data ? JSON.stringify(err.response.data).slice(0, 80) : err.message;
      console.log(`❌ ${t.name.padEnd(42)} | ERR ${status} | ${msg}`);
    }
  }
}

runAudit();

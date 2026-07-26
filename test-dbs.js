const axios = require('axios');
const API_KEY = 'dc_live_c5d15446a0c5cf51b22b5be9';
const BASE_URL = 'https://deadcow-streaming.lol/api/v1';
const headers = { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://deadcow-streaming.lol/' };

async function testDBS() {
  console.log('--- 1. Search Dragon Ball Super ---');
  try {
    const rSearch = await axios.get(`${BASE_URL}/search?q=dragon+ball+super&type=anime&key=${API_KEY}`, { headers });
    console.log('Search results count:', rSearch.data.results?.length);
    const dbs = rSearch.data.results?.[0];
    console.log('First DBS item:', dbs);

    console.log('\n--- 2. Resolve DBS Ep 1 (id: ' + (dbs ? dbs.id : 'none') + ') ---');
    const targetId = dbs ? dbs.id : 'https://anime-sama.to/catalogue/dragon-ball-super/';
    
    try {
      const rRes = await axios.get(`${BASE_URL}/resolve?id=${encodeURIComponent(targetId)}&type=anime&episode=1&version=vf&key=${API_KEY}`, { headers, timeout: 20000 });
      console.log('Resolve VF success:', rRes.data);
    } catch(e) {
      console.log('Resolve VF Err:', e.response?.status, e.response?.data || e.message);
    }

    try {
      const rResVost = await axios.get(`${BASE_URL}/resolve?id=${encodeURIComponent(targetId)}&type=anime&episode=1&version=vostfr&key=${API_KEY}`, { headers, timeout: 20000 });
      console.log('Resolve VOSTFR success:', rResVost.data);
    } catch(e) {
      console.log('Resolve VOSTFR Err:', e.response?.status, e.response?.data || e.message);
    }

    console.log('\n--- 3. Seasons for DBS ---');
    try {
      const rSeasons = await axios.get(`${BASE_URL}/seasons?id=${encodeURIComponent(targetId)}&type=anime&key=${API_KEY}`, { headers });
      console.log('Seasons DBS:', rSeasons.data);
    } catch(e) {
      console.log('Seasons Err:', e.response?.status, e.response?.data || e.message);
    }

  } catch (err) {
    console.log('Search Err:', err.message);
  }
}

testDBS();

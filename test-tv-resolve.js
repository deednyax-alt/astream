const axios = require('axios');
const API_KEY = 'dc_live_c5d15446a0c5cf51b22b5be9';
const BASE_URL = 'https://deadcow-streaming.lol/api/v1';
const headers = { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://deadcow-streaming.lol/' };

async function testTV() {
  console.log('--- 1. Search TV Series ---');
  try {
    const rSearch = await axios.get(`${BASE_URL}/search?q=game+of+thrones&type=tv&key=${API_KEY}`, { headers });
    const tvItem = rSearch.data.results?.[0];
    console.log('TV Item:', tvItem);

    if (tvItem) {
      console.log('\n--- 2. Resolve TV (ID: ' + tvItem.id + ') ---');
      const res = await axios.get(`${BASE_URL}/resolve?id=${tvItem.id}&type=tv&season=1&episode=1&version=vf&key=${API_KEY}`, { headers, timeout: 20000 });
      console.log('Resolve TV result:', JSON.stringify(res.data, null, 2));
    }
  } catch (err) {
    console.log('TV Err:', err.response?.data || err.message);
  }
}

testTV();

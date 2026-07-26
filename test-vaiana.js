const axios = require('axios');
const API_KEY = 'dc_live_c5d15446a0c5cf51b22b5be9';
const BASE_URL = 'https://deadcow-streaming.lol/api/v1';
const headers = { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://deadcow-streaming.lol/' };

async function testVaiana() {
  console.log('--- Search Vaiana ---');
  try {
    const res = await axios.get(`${BASE_URL}/search?q=vaiana&type=movie&key=${API_KEY}`, { headers });
    console.log('Vaiana items:', res.data.results);
    const item = res.data.results?.[0];
    if (item) {
      console.log('\n--- Resolve Vaiana (ID: ' + item.id + ') ---');
      const rRes = await axios.get(`${BASE_URL}/resolve?id=${encodeURIComponent(item.id)}&type=movie&episode=1&version=vf&key=${API_KEY}`, { headers });
      console.log('Resolve Vaiana:', rRes.data);
    }
  } catch (e) {
    console.log('Err:', e.response?.data || e.message);
  }
}

testVaiana();

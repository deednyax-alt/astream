const axios = require('axios');

const API_KEY  = 'dc_live_c5d15446a0c5cf51b22b5be9';
const BASE_URL = 'https://deadcow-streaming.lol/api/v1';
const headers  = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Referer': 'https://deadcow-streaming.lol/' };

async function testBackroomsTmdb() {
  console.log('--- Test Backrooms TMDB ID 1083381 ---');
  try {
    const res = await axios.get(`${BASE_URL}/resolve?id=1083381&type=movie&episode=1&version=vf&key=${API_KEY}`, { headers });
    console.log('Result for TMDB ID 1083381:', res.data);
  } catch (e) {
    console.log('Err:', e.response?.data || e.message);
  }
}

testBackroomsTmdb();

const axios = require('axios');
const API_KEY = 'dc_live_c5d15446a0c5cf51b22b5be9';
const BASE_URL = 'https://deadcow-streaming.lol/api/v1';
const headers = { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://deadcow-streaming.lol/' };

async function testSlash() {
  const withSlash = 'https://anime-sama.to/catalogue/dragon-ball-super/';
  console.log('Testing WITH trailing slash:', withSlash);
  try {
    const res = await axios.get(`${BASE_URL}/resolve?id=${encodeURIComponent(withSlash)}&type=anime&episode=1&version=vf&key=${API_KEY}`, { headers, timeout: 20000 });
    console.log('✅ WITH SLASH SUCCESS:', res.data);
  } catch(e) {
    console.log('❌ WITH SLASH ERR:', e.response?.status, e.response?.data || e.message);
  }

  const vostfrWithSlash = 'https://anime-sama.to/catalogue/dragon-ball-super/';
  console.log('Testing VOSTFR WITH trailing slash:', vostfrWithSlash);
  try {
    const res = await axios.get(`${BASE_URL}/resolve?id=${encodeURIComponent(vostfrWithSlash)}&type=anime&episode=1&version=vostfr&key=${API_KEY}`, { headers, timeout: 20000 });
    console.log('✅ VOSTFR WITH SLASH SUCCESS:', res.data);
  } catch(e) {
    console.log('❌ VOSTFR WITH SLASH ERR:', e.response?.status, e.response?.data || e.message);
  }
}

testSlash();

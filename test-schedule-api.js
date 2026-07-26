const axios = require('axios');

const API_KEY  = 'dc_live_c5d15446a0c5cf51b22b5be9';
const BASE_URL = 'https://deadcow-streaming.lol/api/v1';
const headers  = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Referer': 'https://deadcow-streaming.lol/' };

async function testScheduleEndpoints() {
  console.log('--- Test Endpoints Planning API ---');
  
  const endpoints = [
    '/schedule',
    '/catalog/schedule',
    '/anime/schedule',
    '/planning',
    '/calendar',
    '/anime/planning',
    '/releases/today'
  ];

  for (const ep of endpoints) {
    try {
      const res = await axios.get(`${BASE_URL}${ep}?key=${API_KEY}`, { headers, timeout: 5000 });
      console.log(`✅ ${ep}: HTTP ${res.status}`);
      console.log('   Data sample:', Array.isArray(res.data) ? res.data.slice(0, 2) : (res.data.results || res.data.schedule || res.data));
    } catch (err) {
      console.log(`❌ ${ep}: HTTP ${err.response?.status || err.message}`);
    }
  }
}

testScheduleEndpoints();

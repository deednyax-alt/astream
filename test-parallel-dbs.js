const axios = require('axios');
const API_KEY = 'dc_live_c5d15446a0c5cf51b22b5be9';
const BASE_URL = 'https://deadcow-streaming.lol/api/v1';
const headers = { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://deadcow-streaming.lol/' };

async function testParallelDBS() {
  console.log('--- Parallel Resolve DBS ---');
  const targetId = 'https://anime-sama.to/catalogue/dragon-ball-super/';
  
  const start = Date.now();
  try {
    const promises = [
      axios.get(`${BASE_URL}/resolve?id=${encodeURIComponent(targetId)}&type=anime&episode=1&version=vostfr&key=${API_KEY}`, { headers }),
      axios.get(`${BASE_URL}/resolve?id=${encodeURIComponent(targetId)}&type=anime&episode=1&version=vf&key=${API_KEY}`, { headers })
    ];

    const result = await Promise.any(promises);
    console.log(`⚡ Winner in ${Date.now() - start}ms! Version:`, result.data.version, 'Title:', result.data.title);
  } catch (e) {
    console.log('Parallel failed:', e.message);
  }
}

testParallelDBS();

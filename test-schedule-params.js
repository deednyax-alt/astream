const axios = require('axios');

const API_KEY  = 'dc_live_c5d15446a0c5cf51b22b5be9';
const BASE_URL = 'https://deadcow-streaming.lol/api/v1';
const headers  = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Referer': 'https://deadcow-streaming.lol/' };

async function testScheduleParams() {
  console.log('--- Test Params for /schedule ---');
  
  const testCases = [
    { day: 'lundi' },
    { day: 'mardi' },
    { day: 'dimanche' },
    { type: 'anime' },
    { type: 'anime', day: 'lundi' },
    { type: 'anime', day: 'dimanche' },
    { page: 1 }
  ];

  for (const tc of testCases) {
    try {
      const params = { key: API_KEY, ...tc };
      const url = `${BASE_URL}/schedule?` + new URLSearchParams(params).toString();
      const res = await axios.get(url, { headers, timeout: 5000 });
      console.log(`✅ Success for ${JSON.stringify(tc)}: HTTP ${res.status}`);
      console.log('   Data:', res.data);
    } catch (err) {
      console.log(`❌ Fail for ${JSON.stringify(tc)}: HTTP ${err.response?.status || err.message}`);
      if (err.response?.data) console.log('   Body:', err.response.data);
    }
  }
}

testScheduleParams();

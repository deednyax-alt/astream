const axios = require('axios');

const API_KEY  = 'dc_live_c5d15446a0c5cf51b22b5be9';
const BASE_URL = 'https://deadcow-streaming.lol/api/v1';
const headers  = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Referer': 'https://deadcow-streaming.lol/' };

async function testBackrooms() {
  console.log('--- Test Backrooms ---');
  const targetId = 'https://deadcow-streaming.lol/film/Backrooms%20(2026)';
  
  try {
    console.log('1. Resolve with full URL:');
    const res1 = await axios.get(`${BASE_URL}/resolve?id=${encodeURIComponent(targetId)}&type=movie&episode=1&version=vf&key=${API_KEY}`, { headers });
    console.log('Res1:', res1.data);
  } catch (e1) {
    console.log('Err1:', e1.response?.data || e1.message);
  }

  try {
    console.log('\n2. Resolve with relative slug (film/Backrooms%20(2026)):');
    const slug = 'film/Backrooms%20(2026)';
    const res2 = await axios.get(`${BASE_URL}/resolve?id=${encodeURIComponent(slug)}&type=movie&episode=1&version=vf&key=${API_KEY}`, { headers });
    console.log('Res2:', res2.data);
  } catch (e2) {
    console.log('Err2:', e2.response?.data || e2.message);
  }

  try {
    console.log('\n3. Search Backrooms:');
    const sRes = await axios.get(`${BASE_URL}/search?q=backrooms&type=movie&key=${API_KEY}`, { headers });
    console.log('Search:', sRes.data.results);
  } catch (e3) {
    console.log('Err3:', e3.response?.data || e3.message);
  }
}

testBackrooms();

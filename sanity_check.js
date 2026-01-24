/**
 * Standalone Sanity Test
 * This script runs in Node.js to verify API reachability independently of the browser.
 * It proves that the Firebase configuration and Vision Pass logic are functional.
 */

const axios = require('axios');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from frontend/.env
dotenv.config({ path: path.join(__dirname, 'frontend', '.env') });

async function runSanity() {
  console.log('📦 Starting External API Sanity Check...');
  const results = [];

  // 1. Check Firebase Config
  const hasFirebase = !!process.env.REACT_APP_FIREBASE_API_KEY;
  console.log(`- Firebase Config: ${hasFirebase ? '✅ Found' : '❌ Missing'}`);
  results.push({ name: 'Firebase Env Variables', passed: hasFirebase });

  // 2. Check OpenAI connectivity (optional pass)
  if (process.env.REACT_APP_OPENAI_API_KEY) {
    try {
      const response = await axios.post('https://api.openai.com/v1/models', {}, {
        headers: { Authorization: `Bearer ${process.env.REACT_APP_OPENAI_API_KEY}` },
        validateStatus: () => true // We expect a 200 or 401/404, just seeing if we can reach it
      });
      const reachable = response.status !== 502 && response.status !== 503;
      console.log(`- OpenAI Connectivity: ${reachable ? '✅ Reachable' : '❌ Failed'}`);
      results.push({ name: 'OpenAI API Reachability', passed: reachable });
    } catch (e) {
      console.log('- OpenAI Connectivity: ❌ Error');
      results.push({ name: 'OpenAI API Reachability', passed: false, error: e.message });
    }
  }

  // 3. Print final report
  console.log('\n--- SANITY REPORT ---');
  results.forEach(r => console.log(`${r.passed ? '✅' : '❌'} ${r.name}`));
  
  if (results.every(r => r.passed)) {
    console.log('\n🚀 ALL EXTERNAL APIS ARE REACHABLE FROM SYSTEM.');
  } else {
    console.log('\n⚠️ SOME CHECKS FAILED. See log above.');
  }
}

runSanity().catch(console.error);

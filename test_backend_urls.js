// Simple test to check if backend returns market_id
// This assumes backend is running locally or on Railway

const duelId = 'cf2556e3-5f7e-407c-94a7-8f8776308d46';

// Try different possible URLs
const urls = [
    `http://localhost:8080/api/duels/${duelId}`,
    `https://prediction-market-production.up.railway.app/api/duels/${duelId}`,
    `https://bebrafun.up.railway.app/api/duels/${duelId}`
];

async function testUrl(url) {
    try {
        const response = await fetch(url);
        const data = await response.json();

        console.log(`\n✅ ${url}`);
        console.log(`Status: ${response.status}`);

        if (data.market_id !== undefined) {
            console.log(`market_id: ${data.market_id} ✅`);
        } else {
            console.log(`market_id: UNDEFINED ❌`);
        }

        console.log('Response:', JSON.stringify(data, null, 2).substring(0, 500));

    } catch (error) {
        console.log(`\n❌ ${url}`);
        console.log(`Error: ${error.message}`);
    }
}

(async () => {
    console.log('🔍 Testing backend URLs...\n');

    for (const url of urls) {
        await testUrl(url);
    }
})();

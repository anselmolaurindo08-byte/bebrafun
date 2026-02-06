const https = require('https');

const duelId = 'cf2556e3-5f7e-407c-94a7-8f8776308d46'; // Latest duel from database

const options = {
    hostname: 'bebrafun-production.up.railway.app',
    port: 443,
    path: `/api/duels/${duelId}`,
    method: 'GET',
    headers: {
        'Accept': 'application/json'
    }
};

console.log(`🔍 Fetching duel: ${duelId}`);
console.log(`URL: https://${options.hostname}${options.path}\n`);

const req = https.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        console.log(`Status: ${res.statusCode}\n`);

        try {
            const duel = JSON.parse(data);

            console.log('📊 Duel Response:');
            console.log('=====================================');
            console.log(`ID: ${duel.id}`);
            console.log(`Duel ID: ${duel.duel_id}`);
            console.log(`market_id: ${duel.market_id === undefined ? 'UNDEFINED ❌' : duel.market_id === null ? 'NULL ❌' : duel.market_id + ' ✅'}`);
            console.log(`currency: ${duel.currency}`);
            console.log(`direction: ${duel.direction}`);
            console.log(`status: ${duel.status}`);

            console.log('\n📄 Full JSON Response:');
            console.log('=====================================');
            console.log(JSON.stringify(duel, null, 2));

        } catch (error) {
            console.error('❌ Failed to parse JSON:', error.message);
            console.log('Raw response:', data);
        }
    });
});

req.on('error', (error) => {
    console.error('❌ Request failed:', error.message);
});

req.end();

const https = require('https');

// Latest duel ID from logs
const duelId = 'd8e70bef-ecac-4a46-a0ee-ad737d3f8c64';

const options = {
    hostname: 'pumpsly.up.railway.app',
    port: 443,
    path: `/api/duels/${duelId}`,
    method: 'GET',
    headers: {
        'Accept': 'application/json'
    }
};

console.log(`🔍 Testing API for latest duel...`);
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

            console.log('📊 API Response:');
            console.log('=====================================');
            console.log(`ID: ${duel.id}`);
            console.log(`duel_id: ${duel.duel_id}`);
            console.log(`market_id: ${duel.market_id === undefined ? '❌ UNDEFINED' : duel.market_id === null ? '⚠️  NULL' : '✅ ' + duel.market_id}`);
            console.log(`currency: ${duel.currency}`);

            console.log('\n📄 Full Response:');
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

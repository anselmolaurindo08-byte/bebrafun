const https = require('https');

const duelId = '321ae633-dc06-414b-b15d-7cce9b393d7d';

const options = {
    hostname: 'pumpsly.up.railway.app',
    port: 443,
    path: `/api/duels/${duelId}`,
    method: 'GET',
    headers: {
        'Accept': 'application/json'
    }
};

console.log(`🔍 Checking backend response for latest duel...`);
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

            console.log('📊 Backend Response:');
            console.log('=====================================');
            console.log(`ID: ${duel.id}`);
            console.log(`duel_id: ${duel.duel_id}`);
            console.log(`market_id: ${duel.market_id === undefined ? '❌ UNDEFINED (field missing from response!)' : duel.market_id === null ? '⚠️  NULL' : '✅ ' + duel.market_id}`);
            console.log(`currency: ${duel.currency}`);
            console.log(`direction: ${duel.direction}`);

            console.log('\n📄 Full Response:');
            console.log('=====================================');
            console.log(JSON.stringify(duel, null, 2));

            if (duel.market_id === undefined) {
                console.log('\n❌ CRITICAL: Backend is NOT returning market_id field!');
                console.log('   This means the DuelResponse struct is missing MarketID');
                console.log('   OR the field is not being populated when creating the response.');
            }

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

const https = require('https');

// Latest duel ID from logs
const duelId = 'aed75d2f-0d07-41ff-a31f-160127090e59';

const options = {
    hostname: 'pumpsly.up.railway.app',
    port: 443,
    path: `/api/duels/${duelId}`,
    method: 'GET',
    headers: {
        'Accept': 'application/json'
    }
};

console.log(`🔍 Testing backend API...`);
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
            console.log(`market_id: ${duel.market_id === undefined ? '❌ UNDEFINED (field missing)' : duel.market_id === null ? '❌ NULL' : '✅ ' + duel.market_id}`);
            console.log(`currency: ${duel.currency}`);
            console.log(`direction: ${duel.direction}`);

            console.log('\n📄 Full Response (first 1000 chars):');
            console.log('=====================================');
            console.log(JSON.stringify(duel, null, 2).substring(0, 1000));

            if (duel.market_id === undefined) {
                console.log('\n❌ PROBLEM: Backend is NOT returning market_id field!');
                console.log('   This means GORM has not reloaded the schema.');
                console.log('   Solution: Manually restart backend on Railway dashboard.');
            } else {
                console.log('\n✅ Backend is returning market_id correctly!');
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

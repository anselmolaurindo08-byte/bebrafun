const fetch = require('node-fetch');

async function testAPI() {
    try {
        console.log('Testing GET /api/amm/pools/market/47...\n');

        const response = await fetch('https://pumpsly.up.railway.app/api/amm/pools/market/47');

        console.log('Status:', response.status);
        console.log('Status Text:', response.statusText);

        const text = await response.text();
        console.log('\nResponse body:');
        console.log(text);

        if (response.ok) {
            try {
                const json = JSON.parse(text);
                console.log('\nParsed JSON:');
                console.log(JSON.stringify(json, null, 2));
            } catch (e) {
                console.log('Could not parse as JSON');
            }
        }

    } catch (err) {
        console.error('Error:', err.message);
    }
}

testAPI();

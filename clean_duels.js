const { Client } = require('pg');

const client = new Client({
    host: 'interchange.proxy.rlwy.net',
    port: 52098,
    user: 'postgres',
    password: 'cqRUbikesgVWrWqakbOfUicvaexClAFK',
    database: 'railway',
    ssl: {
        rejectUnauthorized: false
    }
});

async function cleanDuels() {
    try {
        await client.connect();
        console.log('Connected to database');

        // Delete all duel transactions first (foreign key constraint)
        const txResult = await client.query('DELETE FROM duel_transactions');
        console.log(`Deleted ${txResult.rowCount} duel transactions`);

        // Delete all duels
        const duelResult = await client.query('DELETE FROM duels');
        console.log(`Deleted ${duelResult.rowCount} duels`);

        console.log('✅ All duels cleaned successfully!');
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

cleanDuels();

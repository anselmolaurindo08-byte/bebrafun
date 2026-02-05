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

async function cleanupDuels() {
    try {
        await client.connect();
        console.log('Connected to database');

        // Delete all duel-related data
        console.log('Deleting duel transactions...');
        const txResult = await client.query('DELETE FROM duel_transactions');
        console.log(`Deleted ${txResult.rowCount} duel transactions`);

        console.log('Deleting duel results...');
        const resultsResult = await client.query('DELETE FROM duel_results');
        console.log(`Deleted ${resultsResult.rowCount} duel results`);

        console.log('Deleting duels...');
        const duelsResult = await client.query('DELETE FROM duels');
        console.log(`Deleted ${duelsResult.rowCount} duels`);

        console.log('✅ All duels cleaned up successfully!');
    } catch (err) {
        console.error('Error cleaning up duels:', err);
    } finally {
        await client.end();
    }
}

cleanupDuels();

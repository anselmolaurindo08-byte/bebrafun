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

async function cleanupMarkets() {
    try {
        console.log('🔌 Connecting to Railway database...');
        await client.connect();
        console.log('✅ Connected!');

        console.log('🗑️  Deleting ALL markets...');

        // Delete all markets (not just ACTIVE/PENDING)
        const result = await client.query('DELETE FROM markets;');
        console.log(`✅ Deleted ${result.rowCount} markets`);

        // Verify
        const countResult = await client.query('SELECT COUNT(*) FROM markets;');
        console.log(`📊 Remaining markets: ${countResult.rows[0].count}`);

        console.log('\n✅ Cleanup complete!');

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    } finally {
        await client.end();
    }
}

cleanupMarkets();

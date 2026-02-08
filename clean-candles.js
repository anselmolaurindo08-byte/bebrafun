const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgresql://postgres:cqRUbikesgVWrWqakbOfUicvaexClAFK@interchange.proxy.rlwy.net:52098/railway',
    ssl: {
        rejectUnauthorized: false
    }
});

async function cleanOldCandles() {
    try {
        await client.connect();
        console.log('✅ Connected to Railway Postgres');

        // Delete old 50/50 price candles for test market
        const result = await client.query(`
      DELETE FROM price_candles 
      WHERE pool_id = (
        SELECT id FROM amm_pools WHERE onchain_pool_id = 1770549658972
      )
    `);

        console.log(`🗑️  Deleted ${result.rowCount} old price candles`);

        // Verify
        const countResult = await client.query('SELECT COUNT(*) as remaining FROM price_candles');
        console.log(`📊 Remaining candles in DB: ${countResult.rows[0].remaining}`);

        console.log('✅ Done! New trades will now record correct historical prices.');
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await client.end();
    }
}

cleanOldCandles();

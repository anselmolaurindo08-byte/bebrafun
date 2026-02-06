const { Client } = require('pg');

const connectionString = 'postgresql://postgres:cqRUbikesgVWrWqakbOfUicvaexClAFK@interchange.proxy.rlwy.net:52098/railway';

async function checkMarketId() {
    const client = new Client({ connectionString });

    try {
        await client.connect();
        console.log('✅ Connected to database');

        // Get the latest duel
        const result = await client.query(`
      SELECT id, duel_id, market_id, currency, direction, status, created_at
      FROM duels 
      ORDER BY created_at DESC 
      LIMIT 5
    `);

        console.log('\n📊 Latest 5 duels:');
        console.log('=====================================');

        result.rows.forEach((row, index) => {
            console.log(`\n${index + 1}. Duel ID: ${row.duel_id}`);
            console.log(`   UUID: ${row.id}`);
            console.log(`   market_id: ${row.market_id === null ? 'NULL ❌' : row.market_id + ' ✅'}`);
            console.log(`   currency: ${row.currency}`);
            console.log(`   direction: ${row.direction}`);
            console.log(`   status: ${row.status}`);
            console.log(`   created: ${row.created_at}`);
        });

        // Count duels with market_id
        const countResult = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(market_id) as with_market_id,
        COUNT(*) - COUNT(market_id) as without_market_id
      FROM duels
    `);

        console.log('\n\n📈 Statistics:');
        console.log('=====================================');
        console.log(`Total duels: ${countResult.rows[0].total}`);
        console.log(`With market_id: ${countResult.rows[0].with_market_id}`);
        console.log(`Without market_id (NULL): ${countResult.rows[0].without_market_id}`);

    } catch (error) {
        console.error('❌ Error:', error.message);
        throw error;
    } finally {
        await client.end();
        console.log('\n🔌 Disconnected from database');
    }
}

checkMarketId().catch(console.error);

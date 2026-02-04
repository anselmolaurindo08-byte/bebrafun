const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgresql://postgres:cqRUbikesgVWrWqakbOfUicvaexClAFK@interchange.proxy.rlwy.net:52098/railway'
});

async function checkPools() {
    try {
        await client.connect();
        console.log('✅ Connected to database\n');

        // Check pool for market 47
        const result = await client.query(`
      SELECT id, market_id, onchain_pool_id, status, authority, 
             yes_reserve, no_reserve, fee_percentage, created_at 
      FROM amm_pools 
      WHERE market_id = 47 
      ORDER BY created_at DESC 
      LIMIT 5
    `);

        console.log(`Found ${result.rows.length} pools for market 47:\n`);
        result.rows.forEach((pool, i) => {
            console.log(`Pool ${i + 1}:`);
            console.log(`  ID: ${pool.id}`);
            console.log(`  Market ID: ${pool.market_id}`);
            console.log(`  Onchain Pool ID: ${pool.onchain_pool_id}`);
            console.log(`  Status: ${pool.status}`);
            console.log(`  Authority: ${pool.authority}`);
            console.log(`  Reserves: ${pool.yes_reserve} / ${pool.no_reserve}`);
            console.log(`  Fee: ${pool.fee_percentage} bps`);
            console.log(`  Created: ${pool.created_at}`);
            console.log('');
        });

    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        await client.end();
    }
}

checkPools();

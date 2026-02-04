const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgresql://postgres:cqRUbikesgVWrWqakbOfUicvaexClAFK@interchange.proxy.rlwy.net:52098/railway'
});

async function checkPools() {
    try {
        await client.connect();
        console.log('✅ Connected to database\n');

        // Check all pools for market 46
        const result = await client.query(`
      SELECT id, market_id, onchain_pool_id, status, authority, 
             yes_reserve, no_reserve, fee_percentage, created_at 
      FROM amm_pools 
      WHERE market_id = 46 
      ORDER BY created_at DESC 
      LIMIT 5
    `);

        console.log(`Found ${result.rows.length} pools for market 46:\n`);
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

        // Check status counts
        const statusResult = await client.query(`
      SELECT status, COUNT(*) 
      FROM amm_pools 
      WHERE market_id = 46 
      GROUP BY status
    `);

        console.log('Status breakdown:');
        statusResult.rows.forEach(row => {
            console.log(`  ${row.status}: ${row.count}`);
        });

    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        await client.end();
    }
}

checkPools();

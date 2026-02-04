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

async function checkSchema() {
    try {
        console.log('🔌 Connecting to Railway database...');
        await client.connect();
        console.log('✅ Connected!');

        // Check if column exists
        const columnCheck = await client.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'amm_pools' AND column_name = 'onchain_pool_id';
        `);

        console.log('\n📊 Column onchain_pool_id:');
        if (columnCheck.rows.length > 0) {
            const col = columnCheck.rows[0];
            console.log(`  ✅ EXISTS`);
            console.log(`  Type: ${col.data_type}`);
            console.log(`  Nullable: ${col.is_nullable}`);
        } else {
            console.log('  ❌ NOT FOUND');
        }

        // Check index
        const indexCheck = await client.query(`
            SELECT indexname, indexdef
            FROM pg_indexes
            WHERE tablename = 'amm_pools' AND indexname = 'idx_amm_pools_onchain_pool_id';
        `);

        console.log('\n📊 Index idx_amm_pools_onchain_pool_id:');
        if (indexCheck.rows.length > 0) {
            console.log(`  ✅ EXISTS`);
            console.log(`  ${indexCheck.rows[0].indexdef}`);
        } else {
            console.log('  ❌ NOT FOUND');
        }

        // Check all columns in amm_pools
        const allColumns = await client.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'amm_pools'
            ORDER BY ordinal_position;
        `);

        console.log('\n📋 All columns in amm_pools:');
        allColumns.rows.forEach(col => {
            console.log(`  - ${col.column_name} (${col.data_type}, nullable: ${col.is_nullable})`);
        });

        console.log('\n✅ Schema check complete!');

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    } finally {
        await client.end();
    }
}

checkSchema();

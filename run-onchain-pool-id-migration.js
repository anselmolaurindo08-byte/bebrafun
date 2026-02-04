const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

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

async function runMigration() {
    try {
        console.log('📖 Reading migration file...');
        const migrationPath = path.join(__dirname, 'prediction-market', 'migrations', '014_add_onchain_pool_id.sql');
        const sql = fs.readFileSync(migrationPath, 'utf8');

        console.log('🔌 Connecting to Railway database...');
        await client.connect();
        console.log('✅ Connected!');

        console.log('🚀 Executing migration...');
        console.log('='.repeat(60));

        await client.query(sql);

        console.log('✅ Migration executed successfully!');
        console.log('='.repeat(60));

        // Verification
        console.log('\n📊 Verification Results:');
        console.log('-'.repeat(60));

        // Check if column exists
        const columnCheck = await client.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'amm_pools' AND column_name = 'onchain_pool_id';
        `);

        console.log('\n✅ Column onchain_pool_id:');
        if (columnCheck.rows.length > 0) {
            const col = columnCheck.rows[0];
            console.log(`  Type: ${col.data_type}`);
            console.log(`  Nullable: ${col.is_nullable}`);
        } else {
            console.log('  ❌ Column not found!');
        }

        // Check index
        const indexCheck = await client.query(`
            SELECT indexname, indexdef
            FROM pg_indexes
            WHERE tablename = 'amm_pools' AND indexname = 'idx_amm_pools_onchain_pool_id';
        `);

        console.log('\n✅ Index idx_amm_pools_onchain_pool_id:');
        if (indexCheck.rows.length > 0) {
            console.log(`  ${indexCheck.rows[0].indexdef}`);
        } else {
            console.log('  ❌ Index not found!');
        }

        console.log('\n' + '='.repeat(60));
        console.log('✅ All done!');

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    } finally {
        await client.end();
    }
}

runMigration();

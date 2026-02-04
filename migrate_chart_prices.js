const { Client } = require('pg');

const connectionString = 'postgresql://postgres:cqRUbikesgVWrWqakbOfUicvaexClAFK@interchange.proxy.rlwy.net:52098/railway';

async function runMigration() {
    const client = new Client({ connectionString });

    try {
        await client.connect();
        console.log('✅ Connected to Railway database');

        // Add chart_start_price column
        console.log('Adding chart_start_price column...');
        await client.query(`
      ALTER TABLE duels 
      ADD COLUMN IF NOT EXISTS chart_start_price DOUBLE PRECISION;
    `);
        console.log('✅ chart_start_price column added');

        // Add price_at_end column (if not exists)
        console.log('Adding price_at_end column...');
        await client.query(`
      ALTER TABLE duels 
      ADD COLUMN IF NOT EXISTS price_at_end DOUBLE PRECISION;
    `);
        console.log('✅ price_at_end column added');

        // Add index for faster queries
        console.log('Adding index on (status, started_at)...');
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_duels_status_started_at 
      ON duels(status, started_at);
    `);
        console.log('✅ Index created');

        // Verify columns exist
        const result = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'duels' 
      AND column_name IN ('chart_start_price', 'price_at_end')
      ORDER BY column_name;
    `);

        console.log('\n📊 Verification:');
        result.rows.forEach(row => {
            console.log(`  - ${row.column_name}: ${row.data_type}`);
        });

        console.log('\n✅ Migration completed successfully!');

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        throw error;
    } finally {
        await client.end();
        console.log('🔌 Database connection closed');
    }
}

runMigration().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});

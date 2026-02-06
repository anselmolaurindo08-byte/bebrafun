const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = 'postgresql://postgres:cqRUbikesgVWrWqakbOfUicvaexClAFK@interchange.proxy.rlwy.net:52098/railway';

async function runMigration() {
    const client = new Client({ connectionString });

    try {
        await client.connect();
        console.log('✅ Connected to database');

        // Read migration file
        const migrationPath = path.join(__dirname, 'prediction-market', 'migrations', '016_add_market_id_to_duels.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

        console.log('📄 Running migration: 016_add_market_id_to_duels.sql');
        console.log('SQL:', migrationSQL);

        // Run migration
        await client.query(migrationSQL);

        console.log('✅ Migration completed successfully!');

        // Verify column was added
        const result = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'duels' AND column_name = 'market_id'
    `);

        if (result.rows.length > 0) {
            console.log('✅ Verified: market_id column exists');
            console.log('   Type:', result.rows[0].data_type);
        } else {
            console.log('❌ WARNING: market_id column not found after migration');
        }

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        throw error;
    } finally {
        await client.end();
        console.log('🔌 Disconnected from database');
    }
}

runMigration().catch(console.error);

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
        const migrationPath = path.join(__dirname, 'migrations', '018_add_player2_direction.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

        console.log('📄 Running migration: 018_add_player2_direction.sql');
        console.log('SQL:', migrationSQL);

        // Execute migration
        await client.query(migrationSQL);

        console.log('✅ Migration completed successfully!');

        // Verify the column was added
        const result = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'duels' AND column_name = 'player_2_direction'
    `);

        if (result.rows.length > 0) {
            console.log('✅ Verified: player_2_direction column exists');
            console.log('   Type:', result.rows[0].data_type);
        } else {
            console.log('⚠️  Warning: Could not verify column');
        }

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        throw error;
    } finally {
        await client.end();
        console.log('🔌 Disconnected from database');
    }
}

runMigration()
    .then(() => {
        console.log('\n🎉 All done!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n💥 Error:', error);
        process.exit(1);
    });

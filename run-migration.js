const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = 'postgresql://postgres:cqRUbikesgVWrWqakbOfUicvaexClAFK@interchange.proxy.rlwy.net:52098/railway';

async function runMigration() {
    const client = new Client({ connectionString });

    try {
        await client.connect();
        console.log('Connected to database');

        const migrationPath = path.join(__dirname, 'prediction-market', 'migrations', '016_add_user_nickname.sql');
        const sql = fs.readFileSync(migrationPath, 'utf8');

        console.log('Running migration 016_add_user_nickname.sql...');
        await client.query(sql);

        console.log('✅ Migration completed successfully!');
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        console.error(error);
    } finally {
        await client.end();
    }
}

runMigration();

const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
    console.error('DATABASE_URL environment variable is required');
    process.exit(1);
}

async function runMigration() {
    const client = new Client({
        connectionString: DATABASE_URL,
        ssl: {
            rejectUnauthorized: false
        }
    });

    try {
        await client.connect();
        console.log('Connected to database');

        // Read migration file
        const fs = require('fs');
        const path = require('path');
        const migrationPath = path.join(__dirname, 'prediction-market', 'migrations', '014_user_positions.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

        // Split by semicolon and execute each statement
        const statements = migrationSQL
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0);

        for (const statement of statements) {
            console.log(`\nExecuting: ${statement.substring(0, 100)}...`);
            await client.query(statement);
            console.log('✅ Success');
        }

        console.log('\n✅ Migration 014_user_positions.sql completed successfully!');

    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    } finally {
        await client.end();
    }
}

runMigration();

const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgresql://postgres:cqRUbikesgVWrWqakbOfUicvaexClAFK@interchange.proxy.rlwy.net:52098/railway',
    ssl: {
        rejectUnauthorized: false
    }
});

async function listTables() {
    try {
        await client.connect();
        console.log('✅ Connected to Railway Postgres');

        // List all tables
        const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

        console.log('\n📊 Tables in database:');
        result.rows.forEach(row => {
            console.log(`  - ${row.table_name}`);
        });
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await client.end();
    }
}

listTables();

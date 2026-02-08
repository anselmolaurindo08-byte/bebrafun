const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgresql://postgres:cqRUbikesgVWrWqakbOfUicvaexClAFK@interchange.proxy.rlwy.net:52098/railway',
    ssl: {
        rejectUnauthorized: false
    }
});

async function showSchema() {
    try {
        await client.connect();
        console.log('✅ Connected to Railway Postgres\n');

        const result = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'price_candles'
      ORDER BY ordinal_position
    `);

        console.log('📋 price_candles table schema:\n');
        result.rows.forEach(col => {
            console.log(`  ${col.column_name.padEnd(20)} ${col.data_type}`);
        });

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await client.end();
    }
}

showSchema();

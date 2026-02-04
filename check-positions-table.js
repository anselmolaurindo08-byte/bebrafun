const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;

async function checkTable() {
    const client = new Client({
        connectionString: DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        // Check if table exists
        const tableCheck = await client.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'user_positions'
            );
        `);

        console.log('Table exists:', tableCheck.rows[0].exists);

        if (tableCheck.rows[0].exists) {
            // Get table structure
            const columns = await client.query(`
                SELECT column_name, data_type, is_nullable
                FROM information_schema.columns
                WHERE table_name = 'user_positions'
                ORDER BY ordinal_position;
            `);

            console.log('\nColumns:');
            columns.rows.forEach(col => {
                console.log(`  ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
            });

            // Get indexes
            const indexes = await client.query(`
                SELECT indexname, indexdef
                FROM pg_indexes
                WHERE tablename = 'user_positions';
            `);

            console.log('\nIndexes:');
            indexes.rows.forEach(idx => {
                console.log(`  ${idx.indexname}`);
            });
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await client.end();
    }
}

checkTable();

const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;

async function checkTrigger() {
    const client = new Client({
        connectionString: DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        // Check for trigger
        const trigger = await client.query(`
            SELECT tgname, proname
            FROM pg_trigger t
            JOIN pg_proc p ON t.tgfoid = p.oid
            WHERE tgrelid = 'user_positions'::regclass;
        `);

        console.log('Triggers on user_positions:');
        if (trigger.rows.length === 0) {
            console.log('  No triggers found');

            // Create the trigger
            console.log('\nCreating trigger...');
            await client.query(`
                CREATE OR REPLACE FUNCTION update_user_positions_updated_at()
                RETURNS TRIGGER AS $$
                BEGIN
                    NEW.updated_at = CURRENT_TIMESTAMP;
                    RETURN NEW;
                END;
                $$ LANGUAGE plpgsql;
            `);
            console.log('✅ Function created');

            await client.query(`
                CREATE TRIGGER trigger_update_user_positions_updated_at
                    BEFORE UPDATE ON user_positions
                    FOR EACH ROW
                    EXECUTE FUNCTION update_user_positions_updated_at();
            `);
            console.log('✅ Trigger created');
        } else {
            trigger.rows.forEach(t => {
                console.log(`  ${t.tgname} -> ${t.proname}`);
            });
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await client.end();
    }
}

checkTrigger();

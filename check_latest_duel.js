const { Client } = require('pg');

const connectionString = 'postgresql://postgres:cqRUbikesgVWrWqakbOfUicvaexClAFK@interchange.proxy.rlwy.net:52098/railway';

async function checkLatestDuel() {
    const client = new Client({ connectionString });

    try {
        await client.connect();
        console.log('✅ Connected to database\n');

        // Get the very latest duel
        const result = await client.query(`
      SELECT id, duel_id, market_id, currency, direction, status, created_at
      FROM duels 
      ORDER BY created_at DESC 
      LIMIT 1
    `);

        if (result.rows.length === 0) {
            console.log('No duels found');
            return;
        }

        const duel = result.rows[0];

        console.log('📊 Latest Duel from Database:');
        console.log('=====================================');
        console.log(`UUID: ${duel.id}`);
        console.log(`Duel ID: ${duel.duel_id}`);
        console.log(`market_id: ${duel.market_id} ${duel.market_id === 1 ? '(SOL/USDT)' : duel.market_id === 2 ? '(PUMP/USDT)' : ''}`);
        console.log(`currency: ${duel.currency}`);
        console.log(`direction: ${duel.direction} ${duel.direction === 0 ? '(UP)' : '(DOWN)'}`);
        console.log(`status: ${duel.status}`);
        console.log(`created: ${duel.created_at}`);

        if (duel.market_id === 1) {
            console.log('\n⚠️  This duel is for SOL/USDT chart');
            console.log('   If you selected PUMP, check if the button was actually clicked.');
        } else if (duel.market_id === 2) {
            console.log('\n✅ This duel is for PUMP/USDT chart');
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
        throw error;
    } finally {
        await client.end();
        console.log('\n🔌 Disconnected from database');
    }
}

checkLatestDuel().catch(console.error);

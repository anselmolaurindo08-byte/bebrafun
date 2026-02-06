const { Client } = require('pg');

const connectionString = 'postgresql://postgres:cqRUbikesgVWrWqakbOfUicvaexClAFK@interchange.proxy.rlwy.net:52098/railway';

async function checkDuel() {
    const client = new Client({ connectionString });

    try {
        await client.connect();
        console.log('✅ Connected to database');

        // Check the newest duel
        const result = await client.query(`
      SELECT 
        id,
        duel_id,
        player1_id,
        player2_id,
        direction as player_1_direction,
        player_2_direction,
        status,
        winner_id,
        created_at
      FROM duels 
      WHERE duel_id = 1770411115206
      ORDER BY created_at DESC 
      LIMIT 1
    `);

        if (result.rows.length > 0) {
            console.log('\n📊 Latest Duel:');
            console.log(JSON.stringify(result.rows[0], null, 2));

            const duel = result.rows[0];
            console.log('\n🔍 Analysis:');
            console.log('Player 1 Direction:', duel.player_1_direction);
            console.log('Player 2 Direction:', duel.player_2_direction);
            console.log('Winner ID:', duel.winner_id);
            console.log('Status:', duel.status);

            if (duel.player_2_direction === null) {
                console.log('\n❌ PROBLEM: Player 2 direction is NULL!');
                console.log('   Frontend is NOT sending direction parameter');
            } else {
                console.log('\n✅ Player 2 direction is set correctly');
            }
        } else {
            console.log('⚠️  No duel found with ID 1770411115206');
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
        throw error;
    } finally {
        await client.end();
        console.log('\n🔌 Disconnected from database');
    }
}

checkDuel()
    .then(() => {
        console.log('\n🎉 Done!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n💥 Error:', error);
        process.exit(1);
    });

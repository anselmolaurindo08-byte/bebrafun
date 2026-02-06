const { Client } = require('pg');

async function checkNewDuel() {
    const client = new Client({
        connectionString: 'postgresql://postgres:oCQqZQpJVHNMvJLPWKcJjzGHqGCGdFZd@junction.proxy.rlwy.net:31060/railway'
    });

    try {
        console.log('✅ Connected to database\n');
        await client.connect();

        // Check the NEW duel from logs
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
      WHERE id = '412d722a-e4fc-46b3-93d7-806e90e1883b'
    `);

        if (result.rows.length === 0) {
            console.log('❌ Duel not found!');
            return;
        }

        const duel = result.rows[0];
        console.log('📊 New Duel (412d722a):');
        console.log(JSON.stringify(duel, null, 2));
        console.log('\n🔍 Analysis:');
        console.log(`Player 1 Direction: ${duel.player_1_direction}`);
        console.log(`Player 2 Direction: ${duel.player_2_direction}`);
        console.log(`Status: ${duel.status}`);

        // Interpret direction
        console.log('\n📝 Direction Interpretation (1=UP, 0=DOWN):');
        console.log(`Player 1: ${duel.player_1_direction === 1 ? '▲ UP' : duel.player_1_direction === 0 ? '▼ DOWN' : 'UNKNOWN'}`);

        if (duel.player_2_direction !== null) {
            console.log(`Player 2: ${duel.player_2_direction === 1 ? '▲ UP' : duel.player_2_direction === 0 ? '▼ DOWN' : 'UNKNOWN'}`);
        } else {
            console.log('Player 2: Not joined yet');
        }

    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        await client.end();
        console.log('\n🔌 Disconnected from database\n');
    }
}

checkNewDuel().then(() => console.log('🎉 Done!'));

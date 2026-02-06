const { Client } = require('pg');

const connectionString = 'postgresql://postgres:cqRUbikesgVWrWqakbOfUicvaexClAFK@interchange.proxy.rlwy.net:52098/railway';

async function checkDuel() {
    const client = new Client({ connectionString });

    try {
        await client.connect();
        console.log('✅ Connected to database\n');

        const duelId = 'f34703d9-65e2-4746-95f9-0d8f9397e7b8';

        const result = await client.query(`
      SELECT 
        id, 
        duel_id,
        player1_id,
        player2_id,
        direction,
        market_id,
        price_at_start,
        price_at_end,
        winner_id,
        status,
        created_at,
        started_at,
        resolved_at
      FROM duels 
      WHERE id = $1
    `, [duelId]);

        if (result.rows.length === 0) {
            console.log('Duel not found');
            return;
        }

        const duel = result.rows[0];

        console.log('📊 Duel Details:');
        console.log('=====================================');
        console.log(`UUID: ${duel.id}`);
        console.log(`Duel ID: ${duel.duel_id}`);
        console.log(`Player 1: ${duel.player1_id} (direction: ${duel.direction} = ${duel.direction === 0 ? 'UP' : 'DOWN'})`);
        console.log(`Player 2: ${duel.player2_id} (direction: ${duel.direction === 0 ? 'DOWN' : 'UP'} - opposite)`);
        console.log(`Market: ${duel.market_id} (${duel.market_id === 1 ? 'SOL/USDT' : 'PUMP/USDT'})`);
        console.log(`Price Start: ${duel.price_at_start}`);
        console.log(`Price End: ${duel.price_at_end}`);
        console.log(`Winner: ${duel.winner_id}`);
        console.log(`Status: ${duel.status}`);

        console.log('\n🔍 Winner Logic Analysis:');
        console.log('=====================================');

        if (duel.price_at_start && duel.price_at_end) {
            const priceWentUp = duel.price_at_end > duel.price_at_start;
            const player1Direction = duel.direction; // 0 = UP, 1 = DOWN

            console.log(`Price movement: ${duel.price_at_start} → ${duel.price_at_end}`);
            console.log(`Price went: ${priceWentUp ? 'UP ⬆️' : 'DOWN ⬇️'}`);
            console.log(`Player 1 predicted: ${player1Direction === 0 ? 'UP ⬆️' : 'DOWN ⬇️'}`);
            console.log(`Player 2 predicted: ${player1Direction === 0 ? 'DOWN ⬇️' : 'UP ⬆️'} (opposite)`);

            // Correct logic: if price went up and player predicted UP, they win
            const player1ShouldWin = (priceWentUp && player1Direction === 0) || (!priceWentUp && player1Direction === 1);
            const correctWinner = player1ShouldWin ? duel.player1_id : duel.player2_id;

            console.log(`\nCorrect winner should be: Player ${player1ShouldWin ? '1' : '2'} (ID: ${correctWinner})`);
            console.log(`Actual winner in DB: Player ${duel.winner_id === duel.player1_id ? '1' : '2'} (ID: ${duel.winner_id})`);

            if (correctWinner !== duel.winner_id) {
                console.log('\n❌ WINNER IS WRONG! Backend logic is broken!');
            } else {
                console.log('\n✅ Winner is correct!');
            }
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
        throw error;
    } finally {
        await client.end();
        console.log('\n🔌 Disconnected from database');
    }
}

checkDuel().catch(console.error);

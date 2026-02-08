const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgresql://postgres:cqRUbikesgVWrWqakbOfUicvaexClAFK@interchange.proxy.rlwy.net:52098/railway'
});

async function checkVolume() {
    await client.connect();

    // Check AMM trades table
    console.log('=== AMM Trades ===');
    const trades = await client.query(`
        SELECT id, user_address, trade_type, input_amount, output_amount, status, created_at 
        FROM amm_trades 
        ORDER BY created_at DESC 
        LIMIT 20
    `);
    console.log(`Total AMM trades: ${trades.rowCount}`);
    trades.rows.forEach(r => {
        console.log(`  ${r.user_address.substring(0, 8)}... | type=${r.trade_type} | input=${r.input_amount} | out=${r.output_amount} | status=${r.status}`);
    });

    // Check AMM trades for our specific user
    console.log('\n=== Trades for ARytv9UP... ===');
    const userTrades = await client.query(`
        SELECT id, trade_type, input_amount, output_amount, status, created_at 
        FROM amm_trades 
        WHERE user_address = 'ARytv9UPs8ajtsHboVgtVJDwz1u7VrHTfDj8qERFrcJE'
        ORDER BY created_at DESC
    `);
    console.log(`User trades: ${userTrades.rowCount}`);
    userTrades.rows.forEach(r => {
        console.log(`  type=${r.trade_type} | input=${r.input_amount} | out=${r.output_amount} | status=${r.status}`);
    });

    // Check all unique statuses
    console.log('\n=== Unique AMM Trade Statuses ===');
    const statuses = await client.query(`SELECT DISTINCT status FROM amm_trades`);
    statuses.rows.forEach(r => console.log(`  ${r.status}`));

    // Check duels for user
    console.log('\n=== Duels for user ID 1 ===');
    const duels = await client.query(`
        SELECT duel_id, bet_amount, status, player1_id, player2_id 
        FROM duels 
        WHERE player1_id = 1 OR player2_id = 1
        ORDER BY created_at DESC 
        LIMIT 10
    `);
    console.log(`User duels: ${duels.rowCount}`);
    duels.rows.forEach(r => {
        console.log(`  duel=${r.duel_id} | bet=${r.bet_amount} | status=${r.status} | p1=${r.player1_id} | p2=${r.player2_id}`);
    });

    // Check all unique duel statuses
    console.log('\n=== Unique Duel Statuses ===');
    const duelStatuses = await client.query(`SELECT DISTINCT status FROM duels`);
    duelStatuses.rows.forEach(r => console.log(`  ${r.status}`));

    // List all tables to find where trades might be stored
    console.log('\n=== All Tables ===');
    const tables = await client.query(`
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name
    `);
    tables.rows.forEach(r => console.log(`  ${r.table_name}`));

    await client.end();
}

checkVolume().catch(console.error);

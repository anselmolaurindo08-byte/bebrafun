const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgresql://postgres:cqRUbikesgVWrWqakbOfUicvaexClAFK@interchange.proxy.rlwy.net:52098/railway',
    ssl: {
        rejectUnauthorized: false
    }
});

async function inspectCandles() {
    try {
        await client.connect();
        console.log('✅ Connected to Railway Postgres\n');

        // Get pool info
        const poolInfo = await client.query(`
      SELECT id, onchain_pool_id 
      FROM amm_pools 
      WHERE onchain_pool_id = 1770549658972
    `);

        if (poolInfo.rows.length === 0) {
            console.log('❌ Pool not found');
            return;
        }

        const poolId = poolInfo.rows[0].id;
        console.log(`📊 Pool ID: ${poolId} (onchain: 1770549658972)\n`);

        // Get latest price candles
        const candles = await client.query(`
      SELECT 
        timestamp,
        open,
        high,
        low,
        close,
        volume
      FROM price_candles
      WHERE pool_id = $1
      ORDER BY timestamp DESC
      LIMIT 10
    `, [poolId]);

        if (candles.rows.length === 0) {
            console.log('📈 No price candles yet. Make a trade to create first candle!');
        } else {
            console.log(`📈 Latest ${candles.rows.length} price candles:\n`);
            candles.rows.forEach((candle, i) => {
                const time = new Date(candle.timestamp).toLocaleTimeString('ru-RU');
                const yesPrice = parseFloat(candle.open);
                console.log(`${i + 1}. ${time}`);
                console.log(`   Open:  ${candle.open} (YES: ${(yesPrice * 100).toFixed(1)}%)`);
                console.log(`   High:  ${candle.high}`);
                console.log(`   Low:   ${candle.low}`);
                console.log(`   Close: ${candle.close}`);
                console.log(`   Volume: ${candle.volume}`);

                // Check if it's 50/50
                if (Math.abs(yesPrice - 0.5) < 0.01) {
                    console.log(`   ⚠️  WARNING: This looks like 50/50!`);
                }
                console.log('');
            });
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await client.end();
    }
}

inspectCandles();

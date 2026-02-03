const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const client = new Client({
    host: 'interchange.proxy.rlwy.net',
    port: 52098,
    user: 'postgres',
    password: 'cqRUbikesgVWrWqakbOfUicvaexClAFK',
    database: 'railway',
    ssl: {
        rejectUnauthorized: false
    }
});

async function runMigration() {
    try {
        console.log('📖 Reading migration file...');
        const migrationPath = path.join(__dirname, 'prediction-market', 'migrations', '012_add_admin_user.sql');
        const sql = fs.readFileSync(migrationPath, 'utf8');

        console.log('🔌 Connecting to Railway database...');
        await client.connect();
        console.log('✅ Connected!');

        console.log('🚀 Executing migration...');
        console.log('='.repeat(60));

        await client.query(sql);

        console.log('✅ Migration executed successfully!');
        console.log('='.repeat(60));

        // Verification
        console.log('\n📊 Verification Results:');
        console.log('-'.repeat(60));

        // Check duels
        const duelsResult = await client.query('SELECT status, COUNT(*) FROM duels GROUP BY status;');
        console.log('\n🥊 Duels by status:');
        duelsResult.rows.forEach(row => {
            console.log(`  ${row.status}: ${row.count}`);
        });

        // Check markets
        const marketsResult = await client.query('SELECT status, COUNT(*) FROM markets GROUP BY status;');
        console.log('\n📈 Markets by status:');
        marketsResult.rows.forEach(row => {
            console.log(`  ${row.status}: ${row.count}`);
        });

        // Check admin user
        const adminResult = await client.query(`
      SELECT au.id, au.role, u.wallet_address, au.created_at
      FROM admin_users au
      JOIN users u ON u.id = au.user_id
      WHERE u.wallet_address = 'ARytv9UPs8ajtsHboVgtVJDwz1u7VrHTfDj8qERFrcJE';
    `);

        console.log('\n👤 Admin user:');
        if (adminResult.rows.length > 0) {
            const admin = adminResult.rows[0];
            console.log(`  ID: ${admin.id}`);
            console.log(`  Role: ${admin.role}`);
            console.log(`  Wallet: ${admin.wallet_address}`);
            console.log(`  Created: ${admin.created_at}`);
        } else {
            console.log('  ❌ Admin user not found!');
        }

        console.log('\n' + '='.repeat(60));
        console.log('✅ All done!');

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    } finally {
        await client.end();
    }
}

runMigration();

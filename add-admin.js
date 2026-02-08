const { Client } = require('pg');

const connectionString = 'postgresql://postgres:cqRUbikesgVWrWqakbOfUicvaexClAFK@interchange.proxy.rlwy.net:52098/railway';

async function addAdmin() {
    const client = new Client({ connectionString });

    try {
        await client.connect();
        console.log('✅ Connected to Railway PostgreSQL');

        const walletAddress = 'ARytv9UPs8ajtsHboVgtVJDwz1u7VrHTfDj8qERFrcJE';

        // Step 1: Find user ID
        console.log(`\n🔍 Finding user with wallet: ${walletAddress}`);
        const userResult = await client.query(
            'SELECT id FROM users WHERE wallet_address = $1',
            [walletAddress]
        );

        if (userResult.rows.length === 0) {
            console.log('❌ User not found!');
            await client.end();
            return;
        }

        const userId = userResult.rows[0].id;
        console.log(`✅ Found user ID: ${userId}`);

        // Step 2: Check if already admin
        const existingAdmin = await client.query(
            'SELECT * FROM admin_users WHERE user_id = $1',
            [userId]
        );

        if (existingAdmin.rows.length > 0) {
            console.log('⚠️  User is already an admin!');
            console.log('Current role:', existingAdmin.rows[0].role);
            await client.end();
            return;
        }

        // Step 3: Insert into admin_users
        console.log('\n➕ Adding user to admin_users table...');
        const permissions = {
            manage_users: true,
            manage_markets: true,
            manage_contests: true,
            view_analytics: true
        };

        await client.query(
            `INSERT INTO admin_users (user_id, role, permissions, created_at, updated_at) 
       VALUES ($1, $2, $3, NOW(), NOW())`,
            [userId, 'SUPER_ADMIN', JSON.stringify(permissions)]
        );

        console.log('✅ User successfully added as SUPER_ADMIN!');
        console.log('\n🎉 Admin panel will now be visible after backend restart!');

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await client.end();
        console.log('\n✅ Disconnected from database');
    }
}

addAdmin();

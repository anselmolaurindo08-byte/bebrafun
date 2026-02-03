import psycopg2
import sys

# Database connection parameters
DB_CONFIG = {
    'host': 'interchange.proxy.rlwy.net',
    'port': 52098,
    'user': 'postgres',
    'password': 'cqRUbikesgVWrWqakbOfUicvaexClAFK',
    'database': 'railway'
}

# Read migration file
migration_file = r'C:\Users\mormeli\.gemini\antigravity\scratch\bebrafun\prediction-market\migrations\012_add_admin_user.sql'

try:
    print("📖 Reading migration file...")
    with open(migration_file, 'r', encoding='utf-8') as f:
        sql_content = f.read()
    
    # Remove comments for cleaner output
    sql_lines = [line for line in sql_content.split('\n') if not line.strip().startswith('--')]
    sql_clean = '\n'.join(sql_lines)
    
    print("🔌 Connecting to Railway database...")
    conn = psycopg2.connect(**DB_CONFIG)
    conn.autocommit = True
    cursor = conn.cursor()
    
    print("🚀 Executing migration...")
    print("=" * 60)
    
    # Execute the migration
    cursor.execute(sql_content)
    
    print("✅ Migration executed successfully!")
    print("=" * 60)
    
    # Verification queries
    print("\n📊 Verification Results:")
    print("-" * 60)
    
    # Check duels
    cursor.execute("SELECT status, COUNT(*) FROM duels GROUP BY status;")
    duels_result = cursor.fetchall()
    print("\n🥊 Duels by status:")
    for status, count in duels_result:
        print(f"  {status}: {count}")
    
    # Check markets
    cursor.execute("SELECT status, COUNT(*) FROM markets GROUP BY status;")
    markets_result = cursor.fetchall()
    print("\n📈 Markets by status:")
    for status, count in markets_result:
        print(f"  {status}: {count}")
    
    # Check admin user
    cursor.execute("""
        SELECT au.id, au.role, u.wallet_address, au.created_at
        FROM admin_users au
        JOIN users u ON u.id = au.user_id
        WHERE u.wallet_address = 'ARytv9UPs8ajtsHboVgtVJDwz1u7VrHTfDj8qERFrcJE';
    """)
    admin_result = cursor.fetchone()
    print("\n👤 Admin user:")
    if admin_result:
        print(f"  ID: {admin_result[0]}")
        print(f"  Role: {admin_result[1]}")
        print(f"  Wallet: {admin_result[2]}")
        print(f"  Created: {admin_result[3]}")
    else:
        print("  ❌ Admin user not found!")
    
    print("\n" + "=" * 60)
    print("✅ All done!")
    
    cursor.close()
    conn.close()
    
except FileNotFoundError:
    print(f"❌ Migration file not found: {migration_file}")
    sys.exit(1)
except psycopg2.Error as e:
    print(f"❌ Database error: {e}")
    sys.exit(1)
except Exception as e:
    print(f"❌ Unexpected error: {e}")
    sys.exit(1)

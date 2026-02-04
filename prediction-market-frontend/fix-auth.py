import re

# Read the file
with open('src/services/blockchainService.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Define the old and new code
old_pattern = r"(\s+console\.log\('  payload:', JSON\.stringify\(payload, null, 2\)\);)\s+(\s+const response = await fetch\(`\$\{import\.meta\.env\.VITE_API_URL\}/api/amm/pools`, \{\s+method: 'POST',\s+headers: \{ 'Content-Type': 'application/json' \},\s+body: JSON\.stringify\(payload\)\s+\}\);)"

new_code = r"""\1

        // Get JWT token from localStorage
        const token = localStorage.getItem('token');
        const headers: HeadersInit = {
          'Content-Type': 'application/json'
        };
        
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
          console.log('  ✅ Authorization token added');
        } else {
          console.warn('  ⚠️ No auth token found in localStorage');
        }
        
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/amm/pools`, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload)
        });"""

# Replace
content = re.sub(old_pattern, new_code, content, flags=re.DOTALL)

# Write back
with open('src/services/blockchainService.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print('✅ File updated!')

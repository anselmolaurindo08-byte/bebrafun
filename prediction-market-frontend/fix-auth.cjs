const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'services', 'blockchainService.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Find and replace the fetch call
const oldCode = `        console.log('  payload:', JSON.stringify(payload, null, 2));
        
        const response = await fetch(\`\${import.meta.env.VITE_API_URL}/api/amm/pools\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });`;

const newCode = `        console.log('  payload:', JSON.stringify(payload, null, 2));
        
        // Get JWT token from localStorage
        const token = localStorage.getItem('token');
        const headers: HeadersInit = {
          'Content-Type': 'application/json'
        };
        
        if (token) {
          headers['Authorization'] = \`Bearer \${token}\`;
          console.log('  ✅ Authorization token added');
        } else {
          console.warn('  ⚠️ No auth token found in localStorage');
        }
        
        const response = await fetch(\`\${import.meta.env.VITE_API_URL}/api/amm/pools\`, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload)
        });`;

content = content.replace(oldCode, newCode);

fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ File updated successfully!');

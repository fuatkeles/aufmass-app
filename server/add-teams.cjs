const http = require('http');

const teams = ['APO', 'IZAR'];

async function getToken() {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 3001,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const json = JSON.parse(data);
        resolve(json.token);
      });
    });
    req.on('error', reject);
    req.write(JSON.stringify({ email: 'admin@aylux.de', password: 'admin123' }));
    req.end();
  });
}

async function addTeam(token, name) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 3001,
      path: '/api/montageteams',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`Added ${name}:`, data);
        resolve(data);
      });
    });
    req.on('error', reject);
    req.write(JSON.stringify({ name }));
    req.end();
  });
}

async function main() {
  const token = await getToken();
  console.log('Got token');

  for (const team of teams) {
    await addTeam(token, team);
  }
}

main().catch(console.error);

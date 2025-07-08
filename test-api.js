const http = require('http');

function testAPI() {
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/matches?page=1&limit=5',
    method: 'GET'
  };

  const req = http.request(options, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      try {
        const parsed = JSON.parse(data);
        console.log('API Response Status:', res.statusCode);
        console.log('API Response Type:', Array.isArray(parsed) ? 'Array' : 'Object');
        console.log('API Response Structure:', typeof parsed);
        
        if (Array.isArray(parsed)) {
          console.log('Matches count (old format):', parsed.length);
        } else {
          console.log('Matches count (new format):', parsed.matches ? parsed.matches.length : 0);
          console.log('Pagination info:', parsed.pagination);
        }
      } catch (e) {
        console.error('Error parsing JSON:', e);
        console.log('Raw response:', data);
      }
    });
  });

  req.on('error', (err) => {
    console.error('Request error:', err);
  });

  req.end();
}

testAPI();
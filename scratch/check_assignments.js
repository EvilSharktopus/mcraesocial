const https = require('https');
const API_KEY = 'AIzaSyB4Yc51IzKEcBzDPqy3B8fA9QSrnhIAzr4';
const PROJECT_ID = 'mcrae-assignments-ca';
const query = { structuredQuery: { from: [{ collectionId: 'assignments' }] } };
const body = JSON.stringify(query);
const options = {
  hostname: 'firestore.googleapis.com',
  path: `/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery?key=${API_KEY}`,
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
};
const req = https.request(options, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const raw = data.substring(0, 1000);
    console.log('STATUS:', res.statusCode);
    console.log('RAW:', raw);
  });
});
req.on('error', e => console.error('ERROR:', e));
req.write(body);
req.end();

const http = require('http');
const fs   = require('fs');
const path = require('path');

const FLOWS_FILE = path.join(__dirname, '..', 'flows', 'flows.json');
const NR_HOST    = 'localhost';
const NR_PORT    = 1880;

function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function main() {
  const newFlows = JSON.parse(fs.readFileSync(FLOWS_FILE, 'utf8'));
  const newIds   = new Set(newFlows.map(n => n.id));

  // GET current flows + ETag
  const get = await request({ hostname: NR_HOST, port: NR_PORT, path: '/flows', method: 'GET' });
  if (get.status !== 200) throw new Error('GET /flows failed: ' + get.status);

  const existing = JSON.parse(get.body);
  const etag     = get.headers['etag'];

  // Remove nodes with same IDs (clean re-import), then append new ones
  const filtered = existing.filter(n => !newIds.has(n.id));
  const merged   = [...filtered, ...newFlows];

  const bodyBuf = Buffer.from(JSON.stringify(merged), 'utf8');

  // POST merged flows
  const post = await request({
    hostname: NR_HOST,
    port:     NR_PORT,
    path:     '/flows',
    method:   'POST',
    headers:  {
      'Content-Type':             'application/json; charset=utf-8',
      'Node-RED-Deployment-Type': 'full',
      'If-Match':                 etag,
      'Content-Length':           bodyBuf.length
    }
  }, bodyBuf);

  console.log('Deploy status:', post.status, post.status === 204 ? 'OK' : post.body);
}

main().catch(err => { console.error('ERRO:', err.message); process.exit(1); });

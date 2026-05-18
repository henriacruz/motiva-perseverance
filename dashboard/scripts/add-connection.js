'use strict';
const fs   = require('fs');
const http = require('http');
const path = require('path');
const FLOWS_FILE = path.join(__dirname, '..', 'flows', 'flows.json');

let flows = JSON.parse(fs.readFileSync(FLOWS_FILE, 'utf8'));

// ── fn_status: add connected field ────────────────────────────────────────────
const fnStatus = flows.find(n => n.id === 'fn_status');
fnStatus.func = [
  "var modes   = ['MANUAL', 'SEMI-AUTO'];",
  "var alertas = [",
  "    'Nenhum alerta',",
  "    'Nenhum alerta',",
  "    'Nenhum alerta',",
  "    'Bateria baixa!',",
  "    'Obstáculo frontal < 30 cm'",
  "];",
  "msg.payload = {",
  "    mode:      modes[Math.round(Math.random())],",
  "    battery:   Math.round(Math.random() * 60 + 40),",
  "    alert:     alertas[Math.floor(Math.random() * alertas.length)],",
  "    connected: Math.random() > 0.15",
  "};",
  "return msg;"
].join('\n');

// ── tmpl_status: insert connection row ────────────────────────────────────────
const tmpl = flows.find(n => n.id === 'tmpl_status');

const CONN_ROW = [
  '      <div class="conn-row"',
  '        :style="{borderColor:msg.payload.connected?\'#69db7c\':\'#ff6b6b\',',
  '                 background:msg.payload.connected?\'rgba(105,219,124,.08)\':\'rgba(255,107,107,.08)\'}"',
  '      >',
  '        <span class="conn-dot" :style="{background:msg.payload.connected?\'#69db7c\':\'#ff6b6b\'}"></span>',
  '        <v-icon :size="14" :color="msg.payload.connected?\'#69db7c\':\'#ff6b6b\'"',
  '          :icon="msg.payload.connected?\'mdi-wifi\':\'mdi-wifi-off\'"></v-icon>',
  '        <span :style="{color:msg.payload.connected?\'#69db7c\':\'#ff6b6b\',fontWeight:600,fontSize:\'12px\'}">',
  '          {{ msg.payload.connected ? \'Online\' : \'Offline\' }}',
  '        </span>',
  '        <span style="margin-left:auto;font-size:10px;opacity:.5">MQTT</span>',
  '      </div>',
].join('\n');

const CONN_CSS = [
  '.conn-row{display:flex;align-items:center;gap:6px;padding:5px 8px;border-radius:8px;border:1px solid;margin-bottom:10px;font-size:12px}',
  '.conn-dot{width:7px;height:7px;border-radius:50%;animation:pulse 1.5s infinite}',
  '@keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}',
].join('\n');

tmpl.format = tmpl.format
  .replace('      <div class="batt-wrap">', CONN_ROW + '\n      <div class="batt-wrap">')
  .replace(
    '.status-c .c-wait{opacity:.5;font-size:13px;text-align:center;margin-top:20px}',
    '.status-c .c-wait{opacity:.5;font-size:13px;text-align:center;margin-top:20px}\n' + CONN_CSS
  );

fs.writeFileSync(FLOWS_FILE, JSON.stringify(flows, null, 4), 'utf8');
console.log('flows.json saved');

// ── Deploy ─────────────────────────────────────────────────────────────────────
function request(opts, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: d }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

(async () => {
  const get = await request({ hostname: 'localhost', port: 1880, path: '/flows', method: 'GET' });
  const buf = Buffer.from(JSON.stringify(flows), 'utf8');
  const post = await request({
    hostname: 'localhost', port: 1880, path: '/flows', method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Node-RED-Deployment-Type': 'full',
      'If-Match': get.headers['etag'],
      'Content-Length': buf.length
    }
  }, buf);
  console.log('Deploy:', post.status, post.status === 204 ? 'OK ✓' : post.body.slice(0, 150));
})().catch(err => { console.error('ERRO:', err.message); process.exit(1); });

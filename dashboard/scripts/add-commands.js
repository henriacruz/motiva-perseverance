'use strict';
const fs   = require('fs');
const http = require('http');
const path = require('path');
const FLOWS_FILE = path.join(__dirname, '..', 'flows', 'flows.json');

let f = JSON.parse(fs.readFileSync(FLOWS_FILE, 'utf8'));

// ══════════════════════════════════════════════════════════════════════════════
// 1. Empurrar grupos existentes — abrir espaço na order 2 para grp_cmd
//    Header permanece order 1; os demais sobem 1.
// ══════════════════════════════════════════════════════════════════════════════
const SHIFT_IDS = ['grp_dist','grp_imu','grp_status','grp_energy','grp_oper','grp_gps','grp_map'];
SHIFT_IDS.forEach(id => {
  const g = f.find(n => n.id === id);
  if (g) g.order += 1;
});

// ══════════════════════════════════════════════════════════════════════════════
// 2. Novo grupo grp_cmd (order 2, largura 12)
// ══════════════════════════════════════════════════════════════════════════════
f = f.filter(n => !['grp_cmd','tmpl_cmd','fn_cmd','mqtt_out_cmd','cmt_cmd'].includes(n.id));

f.push({
  id: 'grp_cmd', type: 'ui-group', name: 'Centro de Comandos',
  page: 'mp_page1', width: 12, height: 'auto', order: 2, showTitle: false
});

// ══════════════════════════════════════════════════════════════════════════════
// 3. Template do Centro de Comandos
//    Botões enviam mensagem ao flow via send() — global disponível no ui-template
// ══════════════════════════════════════════════════════════════════════════════
const CMD_TPL = [
  '<template>',
  '  <div class="cmd-c">',
  '    <div class="c-title">',
  '      <v-icon size="15">mdi-remote</v-icon> Centro de Comandos',
  '      <span v-if="lastCmd" class="cmd-feedback">',
  '        &mdash; último: <strong>{{ lastCmd }}</strong>',
  '      </span>',
  '    </div>',
  '    <div class="cmd-row">',
  '',
  '      <button class="cmd-btn cmd-start" @click="doCmd(\'START\')">',
  '        <v-icon :size="30" color="#fff">mdi-play-circle-outline</v-icon>',
  '        <span class="cmd-label">START</span>',
  '        <span class="cmd-sub">Iniciar operação</span>',
  '      </button>',
  '',
  '      <button class="cmd-btn cmd-stop" @click="doCmd(\'STOP\')">',
  '        <v-icon :size="30" color="#fff">mdi-stop-circle-outline</v-icon>',
  '        <span class="cmd-label">STOP</span>',
  '        <span class="cmd-sub">Parar rover</span>',
  '      </button>',
  '',
  '      <button class="cmd-btn cmd-emerg" @click="doEmerg()">',
  '        <v-icon :size="30" color="#fff">mdi-alert-octagon</v-icon>',
  '        <span class="cmd-label">EMERGÊNCIA</span>',
  '        <span class="cmd-sub">Parada imediata</span>',
  '      </button>',
  '',
  '    </div>',
  '  </div>',
  '</template>',
  '<script>',
  'export default {',
  '  data() { return { lastCmd: null }; },',
  '  methods: {',
  '    doCmd(cmd) {',
  '      this.lastCmd = cmd;',
  '      send({ payload: { command: cmd, timestamp: new Date().toISOString() } });',
  '    },',
  '    doEmerg() {',
  '      this.lastCmd = \'🚨 EMERGÊNCIA\';',
  '      send({ payload: { command: \'EMERGENCY\', priority: \'HIGH\', timestamp: new Date().toISOString() } });',
  '    }',
  '  }',
  '}',
  '<\/script>',
  '<style>',
  '.cmd-c{background:linear-gradient(160deg,#1a1a2e,#16213e);border-left:4px solid #a78bfa;border-radius:12px;padding:14px 20px;color:#fff}',
  '.cmd-c .c-title{font-size:13px;font-weight:600;opacity:.8;margin-bottom:14px;display:flex;align-items:center;gap:6px}',
  '.cmd-feedback{font-size:11px;opacity:.7;font-weight:400}',
  '.cmd-row{display:flex;gap:16px;justify-content:center}',
  '.cmd-btn{flex:1;max-width:320px;display:flex;flex-direction:column;align-items:center;gap:4px;',
  '  padding:14px 10px;border:none;border-radius:12px;cursor:pointer;transition:all .15s;',
  '  box-shadow:0 4px 14px rgba(0,0,0,.35)}',
  '.cmd-btn:active{transform:scale(.96);box-shadow:0 2px 6px rgba(0,0,0,.4)}',
  '.cmd-start{background:linear-gradient(135deg,#2f9e44,#40c057)}',
  '.cmd-start:hover{background:linear-gradient(135deg,#40c057,#51cf66)}',
  '.cmd-stop{background:linear-gradient(135deg,#e67700,#f76707)}',
  '.cmd-stop:hover{background:linear-gradient(135deg,#f76707,#ff8c00)}',
  '.cmd-emerg{background:linear-gradient(135deg,#c92a2a,#e03131);animation:emerg-pulse 2.5s ease-in-out infinite}',
  '.cmd-emerg:hover{background:linear-gradient(135deg,#e03131,#fa5252);animation:none}',
  '@keyframes emerg-pulse{0%,100%{box-shadow:0 4px 14px rgba(201,42,42,.4)}50%{box-shadow:0 4px 22px rgba(250,82,82,.7)}}',
  '.cmd-label{font-size:15px;font-weight:800;color:#fff;letter-spacing:.06em}',
  '.cmd-sub{font-size:10px;color:rgba(255,255,255,.7);letter-spacing:.03em}',
  '</style>',
].join('\n');

f.push({
  id: 'tmpl_cmd', type: 'ui-template', z: 'flow_mock',
  group: 'grp_cmd', name: 'Card Comandos', order: 1,
  width: 12, height: 3, templateScope: 'local',
  storeOutMessages: false, passthru: false, className: '',
  format: CMD_TPL,
  x: 880, y: 320, wires: [['fn_cmd']]
});

// ══════════════════════════════════════════════════════════════════════════════
// 4. Function node — formata payload para MQTT
// ══════════════════════════════════════════════════════════════════════════════
f.push({
  id: 'fn_cmd', type: 'function', z: 'flow_mock',
  name: 'Formatar Comando',
  func: [
    "msg.topic   = 'perseverance/commands';",
    "msg.payload = JSON.stringify(msg.payload);",
    "return msg;"
  ].join('\n'),
  outputs: 1, timeout: 0,
  x: 1080, y: 320, wires: [['mqtt_out_cmd']]
});

// ══════════════════════════════════════════════════════════════════════════════
// 5. MQTT out — publica em perseverance/commands
// ══════════════════════════════════════════════════════════════════════════════
f.push({
  id: 'mqtt_out_cmd', type: 'mqtt out', z: 'flow_mock',
  name: 'Pub Comandos', topic: 'perseverance/commands', qos: '1', retain: false,
  respTopic: '', contentType: '', userProps: '', correl: '', expiry: '',
  broker: 'aaf1a9af4ea2ff0d',
  x: 1280, y: 320, wires: []
});

// ══════════════════════════════════════════════════════════════════════════════
// 6. Comment node para identificação da seção
// ══════════════════════════════════════════════════════════════════════════════
f.push({
  id: 'cmt_cmd', type: 'comment', z: 'flow_mock',
  name: '🕹️  Dashboard · Centro de Comandos — Start / Stop / Emergência',
  info: '', x: 60, y: 300, wires: []
});

fs.writeFileSync(FLOWS_FILE, JSON.stringify(f, null, 4), 'utf8');
console.log('flows.json saved —', f.length, 'nodes');

// ══════════════════════════════════════════════════════════════════════════════
// Deploy
// ══════════════════════════════════════════════════════════════════════════════
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
  const buf = Buffer.from(JSON.stringify(f), 'utf8');
  const post = await request({
    hostname: 'localhost', port: 1880, path: '/flows', method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Node-RED-Deployment-Type': 'full',
      'If-Match': get.headers['etag'],
      'Content-Length': buf.length
    }
  }, buf);
  console.log('Deploy:', post.status, post.status === 204 ? 'OK ✓' : post.body.slice(0, 200));
})().catch(err => { console.error('ERRO:', err.message); process.exit(1); });

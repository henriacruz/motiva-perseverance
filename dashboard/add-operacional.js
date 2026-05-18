'use strict';
const fs   = require('fs');
const http = require('http');
const path = require('path');
const FLOWS_FILE = path.join(__dirname, 'flows', 'flows.json');

let flows = JSON.parse(fs.readFileSync(FLOWS_FILE, 'utf8'));

// ══════════════════════════════════════════════════════════════════════════════
// 1. fn_status — add cutting field
// ══════════════════════════════════════════════════════════════════════════════
const fnStatus = flows.find(n => n.id === 'fn_status');
fnStatus.func = [
  "var modes   = ['MANUAL', 'SEMI-AUTO'];",
  "var alertas = [",
  "    'Nenhum alerta', 'Nenhum alerta', 'Nenhum alerta',",
  "    'Bateria baixa!', 'Obstáculo frontal < 30 cm'",
  "];",
  "msg.payload = {",
  "    mode:      modes[Math.round(Math.random())],",
  "    battery:   Math.round(Math.random() * 60 + 40),",
  "    alert:     alertas[Math.floor(Math.random() * alertas.length)],",
  "    connected: Math.random() > 0.15,",
  "    cutting:   Math.random() > 0.2",
  "};",
  "return msg;"
].join('\n');

// ══════════════════════════════════════════════════════════════════════════════
// 2. tmpl_status — add Corte row (after conn-row, before batt-wrap)
// ══════════════════════════════════════════════════════════════════════════════
const tmplStatus = flows.find(n => n.id === 'tmpl_status');

const CORTE_ROW = [
  '      <div class="conn-row"',
  '        :style="{borderColor:msg.payload.cutting?\'#ffd43b\':\'rgba(255,255,255,.2)\',',
  '                 background:msg.payload.cutting?\'rgba(255,212,59,.08)\':\'rgba(255,255,255,.04)\'}"',
  '      >',
  '        <v-icon :size="15" :color="msg.payload.cutting?\'#ffd43b\':\'rgba(255,255,255,.35)\'"',
  '          :icon="msg.payload.cutting?\'mdi-scissors-cutting\':\'mdi-scissors-cutting\'"></v-icon>',
  '        <span :style="{color:msg.payload.cutting?\'#ffd43b\':\'rgba(255,255,255,.35)\',fontWeight:600,fontSize:\'12px\'}">',
  '          Corte: {{ msg.payload.cutting ? \'Ativo\' : \'Inativo\' }}',
  '        </span>',
  '        <span style="margin-left:auto;font-size:10px;opacity:.4">lâminas</span>',
  '      </div>',
].join('\n');

tmplStatus.format = tmplStatus.format.replace(
  '      <div class="batt-wrap">',
  CORTE_ROW + '\n      <div class="batt-wrap">'
);

// ══════════════════════════════════════════════════════════════════════════════
// 3. fn_telem — add velocity and area
// ══════════════════════════════════════════════════════════════════════════════
const fnTelem = flows.find(n => n.id === 'fn_telem');
// Insert velocity/area vars before msg.payload assignment
fnTelem.func = fnTelem.func.replace(
  'var v = parseFloat',
  [
    '// Velocidade e área roçada (largura de corte 1.5 m)',
    'var vel  = parseFloat((Math.random() * 1.5 + 0.5).toFixed(1));',
    'var area = parseFloat(flow.get(\'area\') || 0);',
    'area = parseFloat((area + vel * 2 * 1.5).toFixed(1));',
    'flow.set(\'area\', area);',
    '',
    'var v = parseFloat',
  ].join('\n')
);
fnTelem.func = fnTelem.func.replace(
  '    voltage: v,',
  [
    '    velocity: vel,',
    '    area:     Math.round(area),',
    '    voltage: v,',
  ].join('\n')
);

// ══════════════════════════════════════════════════════════════════════════════
// 4. New group grp_oper (w=12, order=6) + push Dist→7, Map→8
// ══════════════════════════════════════════════════════════════════════════════
flows = flows.filter(n => n.id !== 'grp_oper' && n.id !== 'tmpl_oper');

const grpDist = flows.find(n => n.id === 'grp_dist');
if (grpDist) grpDist.order = 7;
const grpMap = flows.find(n => n.id === 'grp_map');
if (grpMap) grpMap.order = 8;

flows.push({
  id: 'grp_oper', type: 'ui-group', name: 'Operação',
  page: 'mp_page1', width: 12, height: 'auto', order: 6, showTitle: false
});

// ══════════════════════════════════════════════════════════════════════════════
// 5. tmpl_oper template
// ══════════════════════════════════════════════════════════════════════════════
const OPER_TPL = [
  '<template>',
  '  <div class="oper-c">',
  '    <div class="c-title"><v-icon>mdi-chart-timeline-variant</v-icon> Opera&ccedil;&atilde;o</div>',
  '    <div v-if="msg && msg.payload" class="oper-row">',
  '',
  '      <div class="oper-item">',
  '        <v-icon :size="32" color="#74c0fc">mdi-speedometer</v-icon>',
  '        <div class="oper-val" style="color:#74c0fc">',
  '          {{ msg.payload.velocity }}<span class="oper-unit"> m/s</span>',
  '        </div>',
  '        <div class="oper-lbl">Velocidade</div>',
  '      </div>',
  '',
  '      <div class="oper-sep"></div>',
  '',
  '      <div class="oper-item">',
  '        <v-icon :size="32" color="#69db7c">mdi-grass</v-icon>',
  '        <div class="oper-val" style="color:#69db7c">',
  '          {{ msg.payload.area.toLocaleString(\'pt-BR\') }}<span class="oper-unit"> m&sup2;</span>',
  '        </div>',
  '        <div class="oper-lbl">&Aacute;rea Ro&ccedil;ada</div>',
  '      </div>',
  '',
  '      <div class="oper-sep"></div>',
  '',
  '      <div class="oper-item">',
  '        <v-icon :size="32" :color="msg.payload.power>100?\'#ff6b6b\':\'#ffd43b\'">mdi-lightning-bolt</v-icon>',
  '        <div class="oper-val" :style="{color:msg.payload.power>100?\'#ff6b6b\':\'#ffd43b\'}">',
  '          {{ msg.payload.power }}<span class="oper-unit"> W</span>',
  '        </div>',
  '        <div class="oper-lbl">Consumo</div>',
  '      </div>',
  '',
  '    </div>',
  '    <div v-else class="c-wait">&#x23F3; Aguardando...</div>',
  '  </div>',
  '</template>',
  '<style>',
  '.oper-c{background:linear-gradient(160deg,#12122a,#1a1a2e);border-left:4px solid #a78bfa;border-radius:12px;padding:14px 20px;color:#fff}',
  '.oper-c .c-title{font-size:13px;font-weight:600;opacity:.8;margin-bottom:12px;display:flex;align-items:center;gap:6px}',
  '.oper-row{display:flex;justify-content:space-around;align-items:center}',
  '.oper-item{text-align:center;flex:1;padding:4px 0}',
  '.oper-sep{width:1px;height:60px;background:rgba(255,255,255,.1)}',
  '.oper-val{font-size:28px;font-weight:700;margin:6px 0 2px;line-height:1}',
  '.oper-unit{font-size:13px;opacity:.7;font-weight:400}',
  '.oper-lbl{font-size:10px;opacity:.55;text-transform:uppercase;letter-spacing:.06em}',
  '.oper-c .c-wait{opacity:.5;font-size:13px;text-align:center;margin-top:10px}',
  '</style>',
].join('\n');

flows.push({
  id: 'tmpl_oper', type: 'ui-template', z: 'flow_mock',
  group: 'grp_oper', name: 'Card Operação', order: 1,
  width: 12, height: 4, templateScope: 'local',
  storeOutMessages: true, passthru: false, className: '',
  format: OPER_TPL,
  x: 880, y: 1120, wires: [[]]
});

// ══════════════════════════════════════════════════════════════════════════════
// 6. Wire mqtt_in_telem → tmpl_oper
// ══════════════════════════════════════════════════════════════════════════════
const inTelem = flows.find(n => n.id === 'mqtt_in_telem');
if (inTelem) {
  const w = inTelem.wires[0] || [];
  if (!w.includes('tmpl_oper')) w.push('tmpl_oper');
  inTelem.wires = [w];
}

fs.writeFileSync(FLOWS_FILE, JSON.stringify(flows, null, 4), 'utf8');
console.log('flows.json saved —', flows.length, 'nodes');

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
  console.log('Deploy:', post.status, post.status === 204 ? 'OK ✓' : post.body.slice(0, 200));
})().catch(err => { console.error('ERRO:', err.message); process.exit(1); });

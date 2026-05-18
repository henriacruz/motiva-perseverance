'use strict';
const fs   = require('fs');
const http = require('http');
const path = require('path');
const FLOWS_FILE = path.join(__dirname, '..', 'flows', 'flows.json');

let f = JSON.parse(fs.readFileSync(FLOWS_FILE, 'utf8'));

// ══════════════════════════════════════════════════════════════════════════════
// 1. fn_status — acumular uptime, alertas e alertas críticos em flow context
//    (fn_telem lerá estes valores e os incluirá no payload do card de KPIs)
// ══════════════════════════════════════════════════════════════════════════════
f.find(n => n.id === 'fn_status').func = [
  "var modes   = ['MANUAL', 'SEMI-AUTO'];",
  "var alertas = [",
  "    'Nenhum alerta', 'Nenhum alerta', 'Nenhum alerta',",
  "    'Bateria baixa!', 'Obstáculo frontal < 30 cm'",
  "];",
  "var alerta    = alertas[Math.floor(Math.random() * alertas.length)];",
  "var connected = Math.random() > 0.15;",
  "",
  "// Acumular métricas de disponibilidade e alertas no flow context",
  "var totalTicks    = (flow.get('totalTicks')    || 0) + 1;",
  "var upTicks       = (flow.get('upTicks')       || 0) + (connected ? 1 : 0);",
  "var alertCount    = (flow.get('alertCount')    || 0) + (alerta !== 'Nenhum alerta' ? 1 : 0);",
  "var criticalCount = (flow.get('criticalCount') || 0) +",
  "    (alerta === 'Bateria baixa!' || alerta === 'Obstáculo frontal < 30 cm' ? 1 : 0);",
  "flow.set('totalTicks',    totalTicks);",
  "flow.set('upTicks',       upTicks);",
  "flow.set('alertCount',    alertCount);",
  "flow.set('criticalCount', criticalCount);",
  "",
  "msg.payload = {",
  "    mode:      modes[Math.round(Math.random())],",
  "    battery:   Math.round(Math.random() * 60 + 40),",
  "    alert:     alerta,",
  "    connected: connected,",
  "    cutting:   Math.random() > 0.2",
  "};",
  "return msg;"
].join('\n');

// ══════════════════════════════════════════════════════════════════════════════
// 2. fn_telem — ler métricas do flow context e incluir no payload
// ══════════════════════════════════════════════════════════════════════════════
const fnTelem = f.find(n => n.id === 'fn_telem');
fnTelem.func = fnTelem.func.replace(
  "var dist = parseFloat(flow.get('distKm') || 0);",
  [
    "// Métricas de disponibilidade e alertas (escritas por fn_status)",
    "var totalTicks    = flow.get('totalTicks')    || 1;",
    "var upTicks       = flow.get('upTicks')       || 1;",
    "var alertCount    = flow.get('alertCount')    || 0;",
    "var criticalCount = flow.get('criticalCount') || 0;",
    "var uptime        = parseFloat((upTicks / totalTicks * 100).toFixed(1));",
    "",
    "var dist = parseFloat(flow.get('distKm') || 0);"
  ].join('\n')
);
fnTelem.func = fnTelem.func.replace(
  "    custo_m2:   parseFloat(((45 + (v * i / 1000) * 0.85) / Math.max(1, vel * 1.5 * 3600)).toFixed(5)),",
  [
    "    custo_m2:   parseFloat(((45 + (v * i / 1000) * 0.85) / Math.max(1, vel * 1.5 * 3600)).toFixed(5)),",
    "    uptime:         uptime,",
    "    alert_count:    alertCount,",
    "    critical_count: criticalCount,"
  ].join('\n')
);

// ══════════════════════════════════════════════════════════════════════════════
// 3. tmpl_oper — grid 3×2 → 3×3 com os 3 novos KPIs
// ══════════════════════════════════════════════════════════════════════════════
const tmplOper = f.find(n => n.id === 'tmpl_oper');
tmplOper.height = 7;

const NEW_KPIS = [
  '',
  '      <div class="oper-divider"></div>',
  '',
  '      <div class="oper-item">',
  '        <v-icon :size="28" :color="msg.payload.uptime>=95?\'#69db7c\':msg.payload.uptime>=80?\'#ffd43b\':\'#ff6b6b\'">mdi-clock-check-outline</v-icon>',
  '        <div class="oper-val" :style="{color:msg.payload.uptime>=95?\'#69db7c\':msg.payload.uptime>=80?\'#ffd43b\':\'#ff6b6b\'}">',
  '          {{ msg.payload.uptime }}<span class="oper-unit"> %</span>',
  '        </div>',
  '        <div class="oper-lbl">Disponibilidade</div>',
  '      </div>',
  '',
  '      <div class="oper-item">',
  '        <v-icon :size="28" :color="msg.payload.alert_count>0?\'#ffd43b\':\'rgba(255,255,255,.4)\'">mdi-bell-alert</v-icon>',
  '        <div class="oper-val" :style="{color:msg.payload.alert_count>0?\'#ffd43b\':\'rgba(255,255,255,.4)\'}">',
  '          {{ msg.payload.alert_count }}',
  '        </div>',
  '        <div class="oper-lbl">Alertas Gerados</div>',
  '      </div>',
  '',
  '      <div class="oper-item">',
  '        <v-icon :size="28" :color="msg.payload.critical_count>0?\'#ff6b6b\':\'rgba(255,255,255,.4)\'">mdi-alert-octagon</v-icon>',
  '        <div class="oper-val" :style="{color:msg.payload.critical_count>0?\'#ff6b6b\':\'rgba(255,255,255,.4)\'}">',
  '          {{ msg.payload.critical_count }}',
  '        </div>',
  '        <div class="oper-lbl">Alertas Cr&iacute;ticos</div>',
  '      </div>',
].join('\n');

// Inserir os 3 novos itens antes do </div> que fecha o oper-grid
tmplOper.format = tmplOper.format.replace(
  '\n    </div>\n    <div v-else class="c-wait">',
  NEW_KPIS + '\n\n    </div>\n    <div v-else class="c-wait">'
);

// Adicionar CSS do segundo divisor (já existe o seletor, só garantir)
if (!tmplOper.format.includes('oper-divider')) {
  tmplOper.format = tmplOper.format.replace(
    '.oper-lbl{',
    '.oper-divider{grid-column:1/-1;height:1px;background:rgba(255,255,255,.08);margin:2px 0}\n.oper-lbl{'
  );
}

fs.writeFileSync(FLOWS_FILE, JSON.stringify(f, null, 4), 'utf8');
console.log('flows.json saved — uptime/alerts no payload:', fnTelem.func.includes('uptime'));

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

'use strict';
const fs   = require('fs');
const http = require('http');
const path = require('path');
const FLOWS_FILE = path.join(__dirname, 'flows', 'flows.json');

let f = JSON.parse(fs.readFileSync(FLOWS_FILE, 'utf8'));

// ══════════════════════════════════════════════════════════════════════════════
// 1. Remove orphan ui-markdown link nodes (links já estão no header template)
// ══════════════════════════════════════════════════════════════════════════════
const ORPHANS = new Set(['eafb290ca2da6f5b','ab68aa8bcb722f90','75225c7702f750af','e5fb195a811315f4']);
f = f.filter(n => !ORPHANS.has(n.id));

// ══════════════════════════════════════════════════════════════════════════════
// 2. Linha 1 uniforme — todos os 4 cards com w3 (3+3+3+3 = 12)
// ══════════════════════════════════════════════════════════════════════════════
f.find(n => n.id === 'grp_dist').width   = 3;
f.find(n => n.id === 'grp_energy').width = 3;

// ══════════════════════════════════════════════════════════════════════════════
// 3. fn_telem — acrescentar rodovia / endereço / cidade / estado
// ══════════════════════════════════════════════════════════════════════════════
const fnTelem = f.find(n => n.id === 'fn_telem');
fnTelem.func = fnTelem.func.replace(
  "    power:   parseFloat((v * i).toFixed(2))\n};",
  [
    "    power:   parseFloat((v * i).toFixed(2)),",
    "    rodovia:  'SP-330 — Anhanguera',",
    "    endereco: 'Rod. Anhanguera, km ' + (70 + parseFloat((idx * 2.4 / route.length).toFixed(1))),",
    "    cidade:   'Jundiaí',",
    "    estado:   'São Paulo'",
    "};"
  ].join('\n')
);

// ══════════════════════════════════════════════════════════════════════════════
// 4. tmpl_gps — card enriquecido com rodovia / endereço / cidade / estado
// ══════════════════════════════════════════════════════════════════════════════
const tmplGps = f.find(n => n.id === 'tmpl_gps');
tmplGps.format = [
  '<template>',
  '  <div class="gps-c">',
  '    <div class="c-title"><v-icon>mdi-map-marker-radius</v-icon> GPS &mdash; NEO-6M</div>',
  '    <div v-if="msg && msg.payload">',
  '',
  '      <div class="gps-coords">',
  '        <div class="gps-ci">',
  '          <v-icon color="#74c0fc" :size="22">mdi-latitude</v-icon>',
  '          <div><div class="c-val">{{ msg.payload.lat }}°</div><div class="c-lbl">Latitude</div></div>',
  '        </div>',
  '        <div class="gps-sep"></div>',
  '        <div class="gps-ci">',
  '          <v-icon color="#74c0fc" :size="22">mdi-longitude</v-icon>',
  '          <div><div class="c-val">{{ msg.payload.lon }}°</div><div class="c-lbl">Longitude</div></div>',
  '        </div>',
  '      </div>',
  '',
  '      <div class="gps-grid">',
  '        <div class="gps-item gps-full">',
  '          <v-icon color="#ffd43b" :size="13">mdi-road</v-icon>',
  '          <span class="gi-lbl">Rodovia</span>',
  '          <span class="gi-val">{{ msg.payload.rodovia }}</span>',
  '        </div>',
  '        <div class="gps-item gps-full">',
  '          <v-icon color="#a9e34b" :size="13">mdi-map-marker</v-icon>',
  '          <span class="gi-lbl">Endereço</span>',
  '          <span class="gi-val">{{ msg.payload.endereco }}</span>',
  '        </div>',
  '        <div class="gps-item">',
  '          <v-icon color="#74c0fc" :size="13">mdi-city</v-icon>',
  '          <span class="gi-lbl">Cidade</span>',
  '          <span class="gi-val">{{ msg.payload.cidade }}</span>',
  '        </div>',
  '        <div class="gps-item">',
  '          <v-icon color="#da77f2" :size="13">mdi-map</v-icon>',
  '          <span class="gi-lbl">Estado</span>',
  '          <span class="gi-val">{{ msg.payload.estado }}</span>',
  '        </div>',
  '      </div>',
  '',
  '    </div>',
  '    <div v-else class="c-wait">&#x23F3; Aguardando GPS...</div>',
  '  </div>',
  '</template>',
  '<style>',
  '.gps-c{background:linear-gradient(160deg,#1e3a5f,#0d2137);border-left:4px solid #74c0fc;border-radius:12px;padding:16px;color:#fff}',
  '.gps-c .c-title{font-size:13px;font-weight:600;opacity:.8;margin-bottom:14px;display:flex;align-items:center;gap:6px}',
  '.gps-coords{display:flex;align-items:center;margin-bottom:10px;background:rgba(116,192,252,.07);border-radius:8px;padding:8px 10px}',
  '.gps-ci{display:flex;align-items:center;gap:8px;flex:1}',
  '.gps-sep{width:1px;height:34px;background:rgba(255,255,255,.12);margin:0 10px}',
  '.gps-c .c-val{font-size:15px;font-weight:700;font-variant-numeric:tabular-nums}',
  '.gps-c .c-lbl{font-size:10px;opacity:.55;text-transform:uppercase;letter-spacing:.06em}',
  '.gps-grid{display:grid;grid-template-columns:1fr 1fr;gap:5px}',
  '.gps-item{display:flex;align-items:center;gap:5px;background:rgba(255,255,255,.04);border-radius:6px;padding:5px 8px;min-width:0}',
  '.gps-full{grid-column:1/-1}',
  '.gi-lbl{font-size:10px;opacity:.5;text-transform:uppercase;white-space:nowrap;flex-shrink:0}',
  '.gi-val{font-size:12px;font-weight:600;margin-left:auto;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
  '.gps-c .c-wait{opacity:.5;font-size:13px;text-align:center;margin-top:20px}',
  '</style>',
].join('\n');

// ══════════════════════════════════════════════════════════════════════════════
// 5. Comment nodes — identificação visual por seção
// ══════════════════════════════════════════════════════════════════════════════
const CMT_IDS = new Set(['cmt_config','cmt_mock','cmt_sub','cmt_hdr','cmt_row1','cmt_oper','cmt_mapa','cmt_bot']);
f = f.filter(n => !CMT_IDS.has(n.id));

const cmts = [
  { id:'cmt_config', name:'⚙️  Configuração — ui-base, page, theme, MQTT broker, Telegram bot', x:60,  y:40   },
  { id:'cmt_mock',   name:'🎲  Mock / Simulação — inject + function + mqtt out',                 x:60,  y:220  },
  { id:'cmt_sub',    name:'📥  Subscriptions MQTT → Dashboard templates',                        x:60,  y:500  },
  { id:'cmt_hdr',    name:'🖥️  Dashboard · Header',                                              x:60,  y:680  },
  { id:'cmt_row1',   name:'📊  Dashboard · Linha 1 — GPS / IMU / Distâncias / Energia / Sistema', x:60,  y:840  },
  { id:'cmt_oper',   name:'⚙️  Dashboard · Operação — Velocidade / Área / Consumo',              x:60,  y:1100 },
  { id:'cmt_mapa',   name:'🗺️  Dashboard · Mapa GPS — iframe + WebSocket + HTTP endpoint',       x:60,  y:1160 },
  { id:'cmt_bot',    name:'🤖  Bot Telegram — receiver / switch / sender',                       x:60,  y:1420 },
].map(c => ({ type:'comment', z:'flow_mock', info:'', wires:[], ...c }));

f.push(...cmts);

// ══════════════════════════════════════════════════════════════════════════════
// 6. Reordenar o array por seção
// ══════════════════════════════════════════════════════════════════════════════
const SECTION_ORDER = [
  'flow_mock',
  // Configuração
  'cmt_config',
  'fb026497e3258b13',  // ui-base
  'mp_page1',          // ui-page
  'theme_enki',        // ui-theme
  '8f5450163a94428d',  // global-config
  'aaf1a9af4ea2ff0d',  // mqtt-broker HiveMQ
  '86082f33536f26e2',  // telegram-bot
  // Mock / Simulação
  'cmt_mock',
  'inj_telem', 'fn_telem', 'mqtt_out_telem',
  'inj_status', 'fn_status', 'mqtt_out_status',
  // Subscriptions
  'cmt_sub',
  'mqtt_in_telem', 'mqtt_in_status',
  '8f78fd64448fc181',  // mqtt in perseverance/sensors
  '1f7fb05304f97bdd',  // debug test mqtt
  // Dashboard — Header
  'cmt_hdr',
  '0dcc96db669d0d91',  // grp Header
  '66241cfc1efbbddc',  // tmpl Header
  // Dashboard — Linha 1
  'cmt_row1',
  'grp_gps',    'tmpl_gps',
  'grp_imu',    'tmpl_imu',
  'grp_dist',   'tmpl_dist',
  'grp_energy', 'tmpl_energy',
  'grp_status', 'tmpl_status',
  // Dashboard — Operação
  'cmt_oper',
  'grp_oper', 'tmpl_oper',
  // Dashboard — Mapa
  'cmt_mapa',
  'grp_map',    'tmpl_map',
  'ws_config_map', 'ws_out_map',
  'http_in_map', 'fn_map_html', 'http_resp_map',
  // Bot Telegram
  'cmt_bot',
  'feea8bb349925d59',  // comment existente "Sessão Bot Telegram"
  '7bd842c7024ea6cc',  // telegram receiver
  '168c7b498d13e021',  // Get Desired Bot Function
  'fa059dbe92a0beb7',  // telegram event
  '6dafc7738f3e477d',  // switch
  '35506e545c3917a4',  // Responder Ajuda
  '2992c1913f7c724c',  // telegram sender
  '6ba5c4156a1e57bb',  // Capt Chat ID
];

const posMap = new Map(SECTION_ORDER.map((id, i) => [id, i]));
const known   = SECTION_ORDER.map(id => f.find(n => n.id === id)).filter(Boolean);
const unknown = f.filter(n => !posMap.has(n.id));
const result  = [...known, ...unknown];

fs.writeFileSync(FLOWS_FILE, JSON.stringify(result, null, 4), 'utf8');
console.log('flows.json saved —', result.length, 'nodes');

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
  const get = await request({ hostname:'localhost', port:1880, path:'/flows', method:'GET' });
  const buf = Buffer.from(JSON.stringify(result), 'utf8');
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

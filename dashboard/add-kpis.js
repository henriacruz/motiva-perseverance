'use strict';
const fs   = require('fs');
const http = require('http');
const path = require('path');
const FLOWS_FILE = path.join(__dirname, 'flows', 'flows.json');

let f = JSON.parse(fs.readFileSync(FLOWS_FILE, 'utf8'));

// ══════════════════════════════════════════════════════════════════════════════
// 1. grp_oper — renomear seção
// ══════════════════════════════════════════════════════════════════════════════
f.find(n => n.id === 'grp_oper').name = 'Operação - Principais KPIs';

// ══════════════════════════════════════════════════════════════════════════════
// 2. fn_telem — adicionar dist_km, eficiencia, custo_m2
//    Inserir bloco de cálculo logo após o cálculo da área
// ══════════════════════════════════════════════════════════════════════════════
const fnTelem = f.find(n => n.id === 'fn_telem');
fnTelem.func = fnTelem.func.replace(
  "flow.set('area', area);\n\nvar v",
  [
    "flow.set('area', area);",
    "",
    "// Distância percorrida (vel m/s * 2 s / 1000 = km por tick)",
    "var dist = parseFloat(flow.get('distKm') || 0);",
    "dist = parseFloat((dist + vel * 2 / 1000).toFixed(3));",
    "flow.set('distKm', dist);",
    "",
    "var v"
  ].join('\n')
);

// Adicionar campos calculados depois de power, antes de rodovia
fnTelem.func = fnTelem.func.replace(
  "    power:   parseFloat((v * i).toFixed(2)),",
  [
    "    power:      parseFloat((v * i).toFixed(2)),",
    "    dist_km:    parseFloat(dist.toFixed(2)),",
    "    // eficiência: largura de corte 1.5 m × vel m/s × 3600 s",
    "    eficiencia: Math.round(vel * 1.5 * 3600),",
    "    // custo: tarifa elétrica R$0,85/kWh + mão-de-obra/manutenção R$45/h",
    "    custo_m2:   parseFloat(((45 + (v * i / 1000) * 0.85) / Math.max(1, vel * 1.5 * 3600)).toFixed(5)),"
  ].join('\n')
);

// ══════════════════════════════════════════════════════════════════════════════
// 3. tmpl_oper — layout 3×2 com os 6 KPIs
// ══════════════════════════════════════════════════════════════════════════════
const tmplOper = f.find(n => n.id === 'tmpl_oper');
tmplOper.height = 5;

tmplOper.format = [
  '<template>',
  '  <div class="oper-c">',
  '    <div class="c-title">',
  '      <v-icon size="14">mdi-chart-timeline-variant</v-icon> Opera&ccedil;&atilde;o &mdash; Principais KPIs',
  '    </div>',
  '    <div v-if="msg && msg.payload" class="oper-grid">',
  '',
  '      <div class="oper-item">',
  '        <v-icon :size="28" color="#74c0fc">mdi-speedometer</v-icon>',
  '        <div class="oper-val" style="color:#74c0fc">{{ msg.payload.velocity }}<span class="oper-unit"> m/s</span></div>',
  '        <div class="oper-lbl">Velocidade</div>',
  '      </div>',
  '',
  '      <div class="oper-item">',
  '        <v-icon :size="28" color="#69db7c">mdi-grass</v-icon>',
  '        <div class="oper-val" style="color:#69db7c">{{ msg.payload.area.toLocaleString(\'pt-BR\') }}<span class="oper-unit"> m&sup2;</span></div>',
  '        <div class="oper-lbl">&Aacute;rea Ro&ccedil;ada</div>',
  '      </div>',
  '',
  '      <div class="oper-item">',
  '        <v-icon :size="28" :color="msg.payload.power>100?\'#ff6b6b\':\'#ffd43b\'">mdi-lightning-bolt</v-icon>',
  '        <div class="oper-val" :style="{color:msg.payload.power>100?\'#ff6b6b\':\'#ffd43b\'}">{{ msg.payload.power }}<span class="oper-unit"> W</span></div>',
  '        <div class="oper-lbl">Consumo</div>',
  '      </div>',
  '',
  '      <div class="oper-divider"></div>',
  '',
  '      <div class="oper-item">',
  '        <v-icon :size="28" color="#ffa94d">mdi-map-marker-distance</v-icon>',
  '        <div class="oper-val" style="color:#ffa94d">{{ msg.payload.dist_km }}<span class="oper-unit"> km</span></div>',
  '        <div class="oper-lbl">Dist&acirc;ncia Percorrida</div>',
  '      </div>',
  '',
  '      <div class="oper-item">',
  '        <v-icon :size="28" color="#a9e34b">mdi-chart-areaspline</v-icon>',
  '        <div class="oper-val" style="color:#a9e34b">{{ msg.payload.eficiencia.toLocaleString(\'pt-BR\') }}<span class="oper-unit"> m&sup2;/h</span></div>',
  '        <div class="oper-lbl">Efici&ecirc;ncia Operacional</div>',
  '      </div>',
  '',
  '      <div class="oper-item">',
  '        <v-icon :size="28" color="#da77f2">mdi-currency-brl</v-icon>',
  '        <div class="oper-val" style="color:#da77f2">R$&nbsp;{{ msg.payload.custo_m2 }}<span class="oper-unit">/m&sup2;</span></div>',
  '        <div class="oper-lbl">Custo Estimado</div>',
  '      </div>',
  '',
  '    </div>',
  '    <div v-else class="c-wait">&#x23F3; Aguardando...</div>',
  '  </div>',
  '</template>',
  '<style>',
  '.oper-c{background:linear-gradient(160deg,#12122a,#1a1a2e);border-left:4px solid #a78bfa;border-radius:12px;padding:14px 20px;color:#fff}',
  '.oper-c .c-title{font-size:13px;font-weight:600;opacity:.8;margin-bottom:14px;display:flex;align-items:center;gap:6px}',
  '.oper-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:0}',
  '.oper-item{text-align:center;padding:10px 6px}',
  '.oper-divider{grid-column:1/-1;height:1px;background:rgba(255,255,255,.08);margin:2px 0}',
  '.oper-val{font-size:26px;font-weight:700;margin:6px 0 2px;line-height:1;font-variant-numeric:tabular-nums}',
  '.oper-unit{font-size:12px;opacity:.7;font-weight:400}',
  '.oper-lbl{font-size:10px;opacity:.55;text-transform:uppercase;letter-spacing:.05em}',
  '.oper-c .c-wait{opacity:.5;font-size:13px;text-align:center;margin-top:10px}',
  '</style>',
].join('\n');

// ══════════════════════════════════════════════════════════════════════════════
// Deploy
// ══════════════════════════════════════════════════════════════════════════════
fs.writeFileSync(FLOWS_FILE, JSON.stringify(f, null, 4), 'utf8');
console.log('flows.json saved');

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

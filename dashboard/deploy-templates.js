'use strict';
const http = require('http');
const fs   = require('fs');
const path = require('path');

const FLOWS_FILE = path.join(__dirname, 'flows', 'flows.json');
const NR_HOST = 'localhost';
const NR_PORT = 1880;

// ─── Template: GPS ────────────────────────────────────────────────────────────
const GPS_TPL = `<template>
  <div class="gps-c">
    <div class="c-title"><v-icon>mdi-map-marker-radius</v-icon> GPS &mdash; NEO-6M</div>
    <div v-if="msg && msg.payload">
      <div class="c-row">
        <v-icon color="#74c0fc" :size="30">mdi-latitude</v-icon>
        <div>
          <div class="c-val">{{ msg.payload.lat }}°</div>
          <div class="c-lbl">Latitude</div>
        </div>
      </div>
      <div class="c-row">
        <v-icon color="#74c0fc" :size="30">mdi-longitude</v-icon>
        <div>
          <div class="c-val">{{ msg.payload.lon }}°</div>
          <div class="c-lbl">Longitude</div>
        </div>
      </div>
    </div>
    <div v-else class="c-wait">&#x23F3; Aguardando GPS...</div>
  </div>
</template>
<style>
.gps-c{background:linear-gradient(160deg,#1e3a5f,#0d2137);border-left:4px solid #74c0fc;border-radius:12px;padding:16px;color:#fff;min-height:130px}
.gps-c .c-title{font-size:13px;font-weight:600;opacity:.8;margin-bottom:14px;display:flex;align-items:center;gap:6px}
.gps-c .c-row{display:flex;align-items:center;gap:12px;margin-bottom:10px}
.gps-c .c-val{font-size:20px;font-weight:700}
.gps-c .c-lbl{font-size:10px;opacity:.55;text-transform:uppercase;letter-spacing:.06em}
.gps-c .c-wait{opacity:.5;font-size:13px;text-align:center;margin-top:20px}
</style>`;

// ─── Template: IMU ────────────────────────────────────────────────────────────
const IMU_TPL = `<template>
  <div class="imu-c">
    <div class="c-title"><v-icon>mdi-rotate-3d-variant</v-icon> IMU &mdash; MPU-6050</div>
    <div v-if="msg && msg.payload" class="imu-row">
      <div class="imu-item">
        <v-icon :size="26">mdi-axis-x-rotate-clockwise</v-icon>
        <div class="imu-val" :style="{color:Math.abs(parseFloat(msg.payload.roll))>20?'#ff6b6b':'#69db7c'}">
          {{ msg.payload.roll }}°
        </div>
        <div class="imu-lbl">Roll</div>
      </div>
      <div class="imu-sep"></div>
      <div class="imu-item">
        <v-icon :size="26">mdi-axis-y-rotate-clockwise</v-icon>
        <div class="imu-val" :style="{color:Math.abs(parseFloat(msg.payload.pitch))>20?'#ff6b6b':'#69db7c'}">
          {{ msg.payload.pitch }}°
        </div>
        <div class="imu-lbl">Pitch</div>
      </div>
      <div class="imu-sep"></div>
      <div class="imu-item">
        <v-icon :size="26">mdi-compass</v-icon>
        <div class="imu-val" style="color:#74c0fc">{{ msg.payload.yaw }}°</div>
        <div class="imu-lbl">Yaw</div>
      </div>
    </div>
    <div v-else class="c-wait">&#x23F3; Aguardando IMU...</div>
  </div>
</template>
<style>
.imu-c{background:linear-gradient(160deg,#1a1a2e,#16213e);border-left:4px solid #a78bfa;border-radius:12px;padding:16px;color:#fff;min-height:130px}
.imu-c .c-title{font-size:13px;font-weight:600;opacity:.8;margin-bottom:14px;display:flex;align-items:center;gap:6px}
.imu-row{display:flex;justify-content:space-around;align-items:center;padding-top:4px}
.imu-item{text-align:center;flex:1}
.imu-sep{width:1px;height:60px;background:rgba(255,255,255,.1)}
.imu-val{font-size:24px;font-weight:700;margin:6px 0 2px}
.imu-lbl{font-size:10px;opacity:.55;text-transform:uppercase;letter-spacing:.06em}
.imu-c .c-wait{opacity:.5;font-size:13px;text-align:center;margin-top:20px}
</style>`;

// ─── Template: Distances ──────────────────────────────────────────────────────
const DIST_TPL = `<template>
  <div class="dist-c">
    <div class="c-title"><v-icon>mdi-radar</v-icon> Dist&acirc;ncias &mdash; HC-SR04</div>
    <div v-if="msg && msg.payload" class="dist-grid">
      <div></div>
      <div :class="['dist-cell', dc(msg.payload.d_front)]">
        <v-icon :size="20">mdi-arrow-up-bold</v-icon>
        <div class="dc-val">{{ msg.payload.d_front }}<span class="dc-unit"> cm</span></div>
        <div class="dc-lbl">Frontal</div>
      </div>
      <div></div>
      <div :class="['dist-cell', dc(msg.payload.d_left)]">
        <v-icon :size="20">mdi-arrow-left-bold</v-icon>
        <div class="dc-val">{{ msg.payload.d_left }}<span class="dc-unit"> cm</span></div>
        <div class="dc-lbl">Esq.</div>
      </div>
      <div class="rover-center">&#x1F916;</div>
      <div :class="['dist-cell', dc(msg.payload.d_right)]">
        <v-icon :size="20">mdi-arrow-right-bold</v-icon>
        <div class="dc-val">{{ msg.payload.d_right }}<span class="dc-unit"> cm</span></div>
        <div class="dc-lbl">Dir.</div>
      </div>
      <div></div>
      <div :class="['dist-cell', dc(msg.payload.d_rear)]">
        <v-icon :size="20">mdi-arrow-down-bold</v-icon>
        <div class="dc-val">{{ msg.payload.d_rear }}<span class="dc-unit"> cm</span></div>
        <div class="dc-lbl">Traseiro</div>
      </div>
      <div></div>
    </div>
    <div v-else class="c-wait">&#x23F3; Aguardando sensores...</div>
  </div>
</template>
<script setup>
function dc(v) { return v < 30 ? 'dc-danger' : v < 80 ? 'dc-warn' : 'dc-ok'; }
</script>
<style>
.dist-c{background:linear-gradient(160deg,#0d2137,#1a1a2e);border-left:4px solid #69db7c;border-radius:12px;padding:16px;color:#fff}
.dist-c .c-title{font-size:13px;font-weight:600;opacity:.8;margin-bottom:14px;display:flex;align-items:center;gap:6px}
.dist-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;max-width:400px;margin:0 auto}
.dist-cell{text-align:center;padding:10px 6px;border-radius:10px;display:flex;flex-direction:column;align-items:center;gap:3px}
.dc-ok{background:rgba(105,219,124,.15);color:#69db7c}
.dc-warn{background:rgba(255,212,59,.15);color:#ffd43b}
.dc-danger{background:rgba(255,107,107,.2);color:#ff6b6b}
.dc-val{font-size:18px;font-weight:700}
.dc-unit{font-size:11px;opacity:.7}
.dc-lbl{font-size:10px;opacity:.65;text-transform:uppercase;letter-spacing:.05em}
.rover-center{display:flex;align-items:center;justify-content:center;font-size:32px}
.dist-c .c-wait{opacity:.5;font-size:13px;text-align:center;margin-top:20px}
</style>`;

// ─── Template: Energy ─────────────────────────────────────────────────────────
const ENERGY_TPL = `<template>
  <div class="energy-c">
    <div class="c-title"><v-icon>mdi-lightning-bolt-circle</v-icon> Energia &mdash; INA219</div>
    <div v-if="msg && msg.payload">
      <div class="e-row">
        <v-icon :size="30" :color="parseFloat(msg.payload.voltage)<11.1?'#ff6b6b':'#69db7c'">mdi-car-battery</v-icon>
        <div>
          <div class="e-val">{{ msg.payload.voltage }}<span class="e-unit"> V</span></div>
          <div class="e-lbl">Tens&atilde;o</div>
        </div>
      </div>
      <div class="e-row">
        <v-icon :size="30" :color="parseFloat(msg.payload.current)>7?'#ff6b6b':'#ffd43b'">mdi-current-dc</v-icon>
        <div>
          <div class="e-val">{{ msg.payload.current }}<span class="e-unit"> A</span></div>
          <div class="e-lbl">Corrente</div>
        </div>
      </div>
      <div class="e-row">
        <v-icon :size="30" :color="parseFloat(msg.payload.power)>100?'#ff6b6b':'#a78bfa'">mdi-flash</v-icon>
        <div>
          <div class="e-val">{{ msg.payload.power }}<span class="e-unit"> W</span></div>
          <div class="e-lbl">Pot&ecirc;ncia</div>
        </div>
      </div>
    </div>
    <div v-else class="c-wait">&#x23F3; Aguardando INA219...</div>
  </div>
</template>
<style>
.energy-c{background:linear-gradient(160deg,#1c1a0e,#2d2a0f);border-left:4px solid #ffd43b;border-radius:12px;padding:16px;color:#fff;min-height:130px}
.energy-c .c-title{font-size:13px;font-weight:600;opacity:.8;margin-bottom:14px;display:flex;align-items:center;gap:6px}
.e-row{display:flex;align-items:center;gap:12px;margin-bottom:10px}
.e-val{font-size:20px;font-weight:700}
.e-unit{font-size:13px;opacity:.7}
.e-lbl{font-size:10px;opacity:.55;text-transform:uppercase;letter-spacing:.06em}
.energy-c .c-wait{opacity:.5;font-size:13px;text-align:center;margin-top:20px}
</style>`;

// ─── Template: Status ─────────────────────────────────────────────────────────
const STATUS_TPL = `<template>
  <div class="status-c">
    <div class="c-title"><v-icon>mdi-robot</v-icon> Sistema &mdash; Status</div>
    <div v-if="msg && msg.payload">
      <div class="mode-badge"
        :style="{background:msg.payload.mode==='MANUAL'?'rgba(116,192,252,.2)':'rgba(167,139,250,.2)',
                 borderColor:msg.payload.mode==='MANUAL'?'#74c0fc':'#a78bfa'}">
        <v-icon :size="16" :icon="msg.payload.mode==='MANUAL'?'mdi-gamepad-variant':'mdi-robot-outline'"></v-icon>
        {{ msg.payload.mode }}
      </div>
      <div class="batt-wrap">
        <div class="batt-head">
          <v-icon :size="18"
            :color="msg.payload.battery<20?'#ff6b6b':msg.payload.battery<50?'#ffd43b':'#69db7c'">
            mdi-battery
          </v-icon>
          <span style="font-size:13px">Bateria</span>
          <span class="batt-pct">{{ msg.payload.battery }}%</span>
        </div>
        <div class="batt-bg">
          <div class="batt-fill"
            :style="{width:msg.payload.battery+'%',
                     background:msg.payload.battery<20?'#ff6b6b':msg.payload.battery<50?'#ffd43b':'#69db7c'}">
          </div>
        </div>
      </div>
      <div class="alert-box"
        :style="{borderColor:msg.payload.alert!=='Nenhum alerta'?'#ff6b6b':'#69db7c',
                 background:msg.payload.alert!=='Nenhum alerta'?'rgba(255,107,107,.1)':'rgba(105,219,124,.1)'}">
        <v-icon :size="16"
          :color="msg.payload.alert!=='Nenhum alerta'?'#ff6b6b':'#69db7c'"
          :icon="msg.payload.alert!=='Nenhum alerta'?'mdi-alert':'mdi-check-circle'">
        </v-icon>
        {{ msg.payload.alert }}
      </div>
    </div>
    <div v-else class="c-wait">&#x23F3; Aguardando status...</div>
  </div>
</template>
<style>
.status-c{background:linear-gradient(160deg,#1a1a2e,#0d2137);border-left:4px solid #a78bfa;border-radius:12px;padding:16px;color:#fff;min-height:130px}
.status-c .c-title{font-size:13px;font-weight:600;opacity:.8;margin-bottom:14px;display:flex;align-items:center;gap:6px}
.mode-badge{display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:20px;border:1px solid;font-size:13px;font-weight:600;margin-bottom:12px}
.batt-wrap{margin-bottom:12px}
.batt-head{display:flex;align-items:center;gap:6px;margin-bottom:6px}
.batt-pct{margin-left:auto;font-weight:700;font-size:13px}
.batt-bg{background:rgba(255,255,255,.1);border-radius:6px;height:10px;overflow:hidden}
.batt-fill{height:100%;border-radius:6px;transition:width .5s ease,background .3s}
.alert-box{padding:8px 10px;border-radius:8px;border:1px solid;font-size:12px;display:flex;align-items:center;gap:6px}
.status-c .c-wait{opacity:.5;font-size:13px;text-align:center;margin-top:20px}
</style>`;

// ─── New nodes to inject ───────────────────────────────────────────────────────
const NEW_NODES = [
  {
    id: 'grp_status', type: 'ui-group', name: 'Sistema',
    page: 'mp_page1', width: 6, height: 'auto', order: 6, showTitle: false
  },
  {
    id: 'tmpl_gps', type: 'ui-template', z: 'flow_mock',
    group: 'grp_gps', name: 'Card GPS', order: 1, width: 6, height: 5,
    format: GPS_TPL, storeOutMessages: false, passthru: false,
    templateScope: 'local', className: '', x: 880, y: 220, wires: [[]]
  },
  {
    id: 'tmpl_imu', type: 'ui-template', z: 'flow_mock',
    group: 'grp_imu', name: 'Card IMU', order: 1, width: 6, height: 5,
    format: IMU_TPL, storeOutMessages: false, passthru: false,
    templateScope: 'local', className: '', x: 880, y: 340, wires: [[]]
  },
  {
    id: 'tmpl_dist', type: 'ui-template', z: 'flow_mock',
    group: 'grp_dist', name: 'Card Distâncias', order: 1, width: 12, height: 7,
    format: DIST_TPL, storeOutMessages: false, passthru: false,
    templateScope: 'local', className: '', x: 880, y: 510, wires: [[]]
  },
  {
    id: 'tmpl_energy', type: 'ui-template', z: 'flow_mock',
    group: 'grp_energy', name: 'Card Energia', order: 1, width: 6, height: 5,
    format: ENERGY_TPL, storeOutMessages: false, passthru: false,
    templateScope: 'local', className: '', x: 880, y: 730, wires: [[]]
  },
  {
    id: 'tmpl_status', type: 'ui-template', z: 'flow_mock',
    group: 'grp_status', name: 'Card Status', order: 1, width: 6, height: 5,
    format: STATUS_TPL, storeOutMessages: false, passthru: false,
    templateScope: 'local', className: '', x: 880, y: 900, wires: [[]]
  }
];

// ─── IDs to remove (old change nodes + old gauge/text widgets) ─────────────────
const REMOVE_IDS = new Set([
  'chg_lat','chg_lon','chg_roll','chg_pitch','chg_yaw',
  'chg_d_front','chg_d_rear','chg_d_left','chg_d_right',
  'chg_volt','chg_curr','chg_pwr','chg_mode','chg_batt','chg_alert',
  'w_txt_lat','w_txt_lon','w_g_roll','w_g_pitch','w_g_yaw',
  'w_g_d_front','w_g_d_rear','w_g_d_left','w_g_d_right',
  'w_g_volt','w_g_curr','w_g_pwr','w_txt_mode','w_g_batt','w_txt_alert',
  // idempotent: remove if re-running
  'grp_status','tmpl_gps','tmpl_imu','tmpl_dist','tmpl_energy','tmpl_status'
]);

// ─── Transform flows.json ─────────────────────────────────────────────────────
let flows = JSON.parse(fs.readFileSync(FLOWS_FILE, 'utf8'));
flows = flows.filter(n => !REMOVE_IDS.has(n.id));

// Redirect mqtt_in wires → templates
const inTelem = flows.find(n => n.id === 'mqtt_in_telem');
if (inTelem) inTelem.wires = [['tmpl_gps','tmpl_imu','tmpl_dist','tmpl_energy']];

const inStatus = flows.find(n => n.id === 'mqtt_in_status');
if (inStatus) inStatus.wires = [['tmpl_status']];

// Hide group titles (templates carry their own headers)
['grp_gps','grp_imu','grp_dist','grp_energy'].forEach(id => {
  const g = flows.find(n => n.id === id);
  if (g) g.showTitle = false;
});

flows.push(...NEW_NODES);
fs.writeFileSync(FLOWS_FILE, JSON.stringify(flows, null, 4), 'utf8');
console.log(`flows.json atualizado: ${flows.length} nós`);

// ─── Deploy to Node-RED ───────────────────────────────────────────────────────
function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, res => {
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
  const get = await request({ hostname: NR_HOST, port: NR_PORT, path: '/flows', method: 'GET' });
  if (get.status !== 200) throw new Error('GET /flows falhou: ' + get.status);

  const existing = JSON.parse(get.body);
  const newIds   = new Set(flows.map(n => n.id));
  const merged   = [...existing.filter(n => !newIds.has(n.id)), ...flows];

  const bodyBuf = Buffer.from(JSON.stringify(merged), 'utf8');
  const post = await request({
    hostname: NR_HOST, port: NR_PORT, path: '/flows', method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Node-RED-Deployment-Type': 'full',
      'If-Match': get.headers['etag'],
      'Content-Length': bodyBuf.length
    }
  }, bodyBuf);

  console.log('Deploy:', post.status, post.status === 204 ? 'OK ✓' : post.body.slice(0, 120));
})().catch(err => { console.error('ERRO:', err.message); process.exit(1); });

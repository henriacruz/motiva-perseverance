'use strict';
const http = require('http');
const fs   = require('fs');
const path = require('path');

const FLOWS_FILE = path.join(__dirname, 'flows', 'flows.json');

const MAP_TPL = `<template>
  <div class="map-c">
    <div class="c-title">
      <v-icon>mdi-map-marker-radius</v-icon> Mapa &mdash; Posi&ccedil;&atilde;o GPS
    </div>
    <div class="map-wrap"></div>
    <div v-if="msg && msg.payload" class="map-coords">
      &#x1F4CD; {{ msg.payload.lat }}, {{ msg.payload.lon }}
    </div>
  </div>
</template>
<script>
export default {
  data() { return { _map: null, _marker: null, _trail: [], _poly: null }; },
  mounted() { this.$nextTick(() => this._initMap()); },
  watch: {
    msg(v) { if (v && v.payload) this._move(v.payload); }
  },
  methods: {
    _initMap() {
      const el = this.$el.querySelector('.map-wrap');
      if (!el || this._map) return;
      const go = () => {
        this._map = L.map(el, { zoomControl: true, attributionControl: false })
          .setView([-23.5505, -46.6333], 15);
        L.tileLayer(
          'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
          { maxZoom: 19 }
        ).addTo(this._map);
        const icon = L.divIcon({
          html: '&#x1F916;', className: 'rv-icon',
          iconSize: [32, 32], iconAnchor: [16, 16]
        });
        this._marker = L.marker([-23.5505, -46.6333], { icon }).addTo(this._map);
        this._poly = L.polyline([], { color: '#74c0fc', weight: 2, opacity: 0.7 })
          .addTo(this._map);
      };
      if (window.L) { go(); return; }
      if (!document.getElementById('lft-css')) {
        const lnk = document.createElement('link');
        lnk.id = 'lft-css'; lnk.rel = 'stylesheet';
        lnk.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(lnk);
      }
      const s = document.createElement('script');
      s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      s.onload = go;
      document.head.appendChild(s);
    },
    _move(p) {
      if (!this._map) return;
      const ll = [parseFloat(p.lat), parseFloat(p.lon)];
      this._marker.setLatLng(ll);
      this._trail.push(ll);
      if (this._trail.length > 50) this._trail.shift();
      this._poly.setLatLngs(this._trail);
      if (this._trail.length === 1) this._map.setView(ll, 15);
    }
  }
}
</script>
<style>
.map-c { background: linear-gradient(160deg,#0d2137,#1a1a2e);
         border-left: 4px solid #74c0fc; border-radius: 12px;
         padding: 16px; color: #fff; }
.map-c .c-title { font-size:13px; font-weight:600; opacity:.8;
                  margin-bottom:10px; display:flex; align-items:center; gap:6px; }
.map-wrap { height: 340px; border-radius: 10px; overflow: hidden; }
.map-coords { font-size: 11px; opacity: .55; margin-top: 6px; text-align: center; }
.rv-icon { font-size: 22px; line-height: 32px; text-align: center; }
</style>`;

// ─── Transform flows.json ──────────────────────────────────────────────────────
let flows = JSON.parse(fs.readFileSync(FLOWS_FILE, 'utf8'));

// Idempotent: remove existing map nodes if re-running
flows = flows.filter(n => n.id !== 'grp_map' && n.id !== 'tmpl_map');

// Update mqtt_in_telem wires → add tmpl_map
const inTelem = flows.find(n => n.id === 'mqtt_in_telem');
if (inTelem) {
  const existing = inTelem.wires[0] || [];
  if (!existing.includes('tmpl_map')) existing.push('tmpl_map');
  inTelem.wires = [existing];
}

// Add new nodes
flows.push(
  {
    id: 'grp_map', type: 'ui-group', name: 'Mapa — Posição GPS',
    page: 'mp_page1', width: 12, height: 'auto', order: 7, showTitle: false
  },
  {
    id: 'tmpl_map', type: 'ui-template', z: 'flow_mock',
    group: 'grp_map', name: 'Card Mapa', order: 1,
    width: 12, height: 10, templateScope: 'local',
    storeOutMessages: true, passthru: false, className: '',
    format: MAP_TPL,
    x: 880, y: 1060, wires: [[]]
  }
);

fs.writeFileSync(FLOWS_FILE, JSON.stringify(flows, null, 4), 'utf8');
console.log(`flows.json atualizado: ${flows.length} nós`);

// ─── Deploy to Node-RED ────────────────────────────────────────────────────────
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
  if (get.status !== 200) throw new Error('GET /flows falhou: ' + get.status);

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

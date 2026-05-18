'use strict';
const http = require('http');
const fs   = require('fs');
const path = require('path');

const FLOWS_FILE = path.join(__dirname, '..', 'flows', 'flows.json');

// ─── Standalone map page served at GET /rover-map ─────────────────────────────
const MAP_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{background:#0d2137;overflow:hidden}
    #map{width:100vw;height:100vh}
    .leaflet-container{background:#1a1a2e}
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    var map = L.map('map',{zoomControl:true,attributionControl:false})
               .setView([-23.5505,-46.6333],15);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
                {maxZoom:19}).addTo(map);
    var icon = L.divIcon({html:'\\u{1F916}',className:'rv-ic',iconSize:[28,28],iconAnchor:[14,14]});
    var marker = L.marker([-23.5505,-46.6333],{icon:icon}).addTo(map);
    var trail=[], poly=L.polyline([],{color:'#74c0fc',weight:2,opacity:.8}).addTo(map);

    function connect(){
      var ws=new WebSocket('ws://'+location.host+'/ws/rover-map');
      ws.onmessage=function(e){
        var p; try{p=JSON.parse(e.data);}catch(err){return;}
        if(p.lat==null||p.lon==null)return;
        var ll=[parseFloat(p.lat),parseFloat(p.lon)];
        if(isNaN(ll[0])||isNaN(ll[1]))return;
        marker.setLatLng(ll);
        trail.push(ll);
        if(trail.length>50)trail.shift();
        poly.setLatLngs(trail);
        if(trail.length===1)map.setView(ll,15);
      };
      ws.onclose=function(){setTimeout(connect,3000);};
    }
    connect();
  </script>
</body>
</html>`;

// Function node body — embeds MAP_HTML as a safe JSON string
const FN_MAP_BODY = `msg.payload = ${JSON.stringify(MAP_HTML)};
msg.headers = { 'content-type': 'text/html; charset=utf-8' };
return msg;`;

// ─── Simplified iframe template (no <script> block needed) ────────────────────
const MAP_TPL_IFRAME = `<template>
  <div class="map-c">
    <div class="c-title">
      <v-icon>mdi-map-marker-radius</v-icon> Mapa &mdash; Posi&ccedil;&atilde;o GPS
    </div>
    <iframe src="/rover-map" class="map-iframe" allowfullscreen></iframe>
    <div v-if="msg && msg.payload" class="map-coords">
      &#x1F4CD; {{ msg.payload.lat }}, {{ msg.payload.lon }}
    </div>
  </div>
</template>
<style>
.map-c { background: linear-gradient(160deg,#0d2137,#1a1a2e);
         border-left: 4px solid #74c0fc; border-radius: 12px;
         padding: 16px; color: #fff; }
.map-c .c-title { font-size:13px; font-weight:600; opacity:.8;
                  margin-bottom:10px; display:flex; align-items:center; gap:6px; }
.map-iframe { width: 100%; height: 340px; border: none; border-radius: 10px; display: block; }
.map-coords { font-size: 11px; opacity:.55; margin-top: 6px; text-align: center; }
</style>`;

// ─── Transform flows.json ──────────────────────────────────────────────────────
let flows = JSON.parse(fs.readFileSync(FLOWS_FILE, 'utf8'));

// Idempotent cleanup
const REMOVE = new Set(['ws_config_map','ws_out_map','http_in_map','fn_map_html','http_resp_map']);
flows = flows.filter(n => !REMOVE.has(n.id));

// Update tmpl_map → iframe approach (no script block)
const tmpl = flows.find(n => n.id === 'tmpl_map');
if (tmpl) {
  tmpl.format = MAP_TPL_IFRAME;
  console.log('tmpl_map updated to iframe approach');
}

// Update mqtt_in_telem wires → add ws_out_map
const inTelem = flows.find(n => n.id === 'mqtt_in_telem');
if (inTelem) {
  const w = inTelem.wires[0] || [];
  if (!w.includes('ws_out_map')) w.push('ws_out_map');
  inTelem.wires = [w];
  console.log('mqtt_in_telem wires updated');
}

// Add new nodes
flows.push(
  // WebSocket server config
  { id: 'ws_config_map', type: 'websocket-listener', path: '/ws/rover-map', wholemsg: 'false' },

  // WebSocket out — sends telemetry payload to browser map page
  { id: 'ws_out_map', type: 'websocket out', z: 'flow_mock', name: 'WS Mapa',
    server: 'ws_config_map', client: '', x: 1100, y: 220, wires: [] },

  // HTTP endpoint: GET /rover-map → serves map.html
  { id: 'http_in_map', type: 'http in', z: 'flow_mock', name: 'GET /rover-map',
    url: '/rover-map', method: 'get', upload: false, swaggerDoc: '',
    x: 200, y: 1180, wires: [['fn_map_html']] },

  { id: 'fn_map_html', type: 'function', z: 'flow_mock', name: 'HTML Mapa',
    func: FN_MAP_BODY, outputs: 1, timeout: 0,
    x: 420, y: 1180, wires: [['http_resp_map']] },

  { id: 'http_resp_map', type: 'http response', z: 'flow_mock', name: 'Resp Mapa',
    statusCode: '200', headers: {}, x: 620, y: 1180, wires: [] }
);

fs.writeFileSync(FLOWS_FILE, JSON.stringify(flows, null, 4), 'utf8');
console.log(`flows.json updated: ${flows.length} nodes`);

// ─── Deploy ────────────────────────────────────────────────────────────────────
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
  if (get.status !== 200) throw new Error('GET /flows failed: ' + get.status);
  const buf = Buffer.from(JSON.stringify(flows), 'utf8');
  const post = await request({
    hostname: 'localhost', port: 1880, path: '/flows', method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8',
               'Node-RED-Deployment-Type': 'full',
               'If-Match': get.headers['etag'],
               'Content-Length': buf.length }
  }, buf);
  console.log('Deploy:', post.status, post.status === 204 ? 'OK ✓' : post.body.slice(0, 200));
})().catch(err => { console.error('ERRO:', err.message); process.exit(1); });

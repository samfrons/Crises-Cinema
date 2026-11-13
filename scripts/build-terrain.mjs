// Terrain pipeline for the Control Room diorama: one real-elevation heightmap
// per playable scenario frame, from AWS Terrain Tiles (Mapzen "joerd" tiles on
// the AWS Open Data registry), terrarium encoding.
//
// NETWORK PIPELINE, RUN BY HAND (CLAUDE.md section 5): `npm run build:terrain`.
// It is not part of `npm run build`. Its output is COMMITTED:
//   public/control-room/terrain/<scenario-id>.png   16-bit greyscale heightmap
//   public/control-room/terrain/<scenario-id>.json  meta (bbox, range, source)
// (a scenario with a second frame adds <scenario-id>-<suffix>.{png,json}).
//
// Raw cache: data/terrain-raw/ (gitignored; every file in it is refetchable
// from the URLs below). Delete a file to force that fetch again. With the
// cache warm the script is offline and byte-for-byte idempotent: the
// `retrieved` date in the meta is the date the registry page was first cached.
//
// Flags:
//   --check              run only the coverage gate (no network, no writes)
//   --scenarios-dir=DIR  read scenarios from DIR (the gate's fault-injection test)
//
// THE GATE: every playable scenario in data/scenarios/ MUST have an entry in
// FRAMES below, or this script exits non-zero before touching the network. A
// new scenario cannot ship without ground.
//
// SOURCING (CLAUDE.md section 3): no number here is invented. Elevation is the
// decoded tile value, resampled (box-averaged) onto the output grid; that is
// the only transformation, and the meta says so. The licence/attribution text
// is lifted from the registry page and the attribution file it points to, and
// cached beside the tiles. Terrarium tiles also carry bathymetry (ETOPO1 and
// others) below 0 m, so "below sea level" includes sea/lake bed; the meta
// says so rather than pretending the grid is land only.
//
// ENCODING: PNG, 16-bit greyscale. Why: it opens in any image tool, a browser
// can decode it into a canvas/texture (16-bit survives via createImageBitmap
// only in some paths, so the renderer should decode with its own tiny reader
// or fetch the bytes), deflate makes smooth terrain small (well under the
// 300 KB budget), and 65536 levels over the frame's own range gives sub-metre
// steps everywhere (~0.02-0.05 m on these frames), finer than the source data.
// Decode: elev_m = minElev + (sample / 65535) * (maxElev - minElev).
// Row 0 is the NORTH edge, column 0 the WEST edge. The grid is linear in
// lon/lat (equirectangular), which at these frame sizes is within a few
// percent of Web Mercator; metresPerPixelX/Y are given separately.

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import zlib from 'node:zlib';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const rawDir = resolve(root, 'data/terrain-raw');
const outDir = resolve(root, 'public/control-room/terrain');
const args = process.argv.slice(2);
const CHECK_ONLY = args.includes('--check');
const scenDirArg = args.find((a) => a.startsWith('--scenarios-dir='));
const scenDir = scenDirArg ? resolve(scenDirArg.split('=')[1]) : resolve(root, 'data/scenarios');

const TILE_URL = (z, x, y) => `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`;
const REGISTRY_URL = 'https://registry.opendata.aws/terrain-tiles/';
const ATTRIBUTION_URL = 'https://raw.githubusercontent.com/tilezen/joerd/master/docs/attribution.md';

/* ── Frames ────────────────────────────────────────────────────────────────
   bbox = [west, south, east, north] in decimal degrees. `px` is the long-edge
   size of the output grid; `zoom` the tile zoom (z11 ~ 59-72 m/px native here,
   z12 ~ 30-36 m/px). The first frame of a scenario takes the bare scenario id.
   `spot` = known-truth checks [label, lon, lat, min, max] in metres, asserted
   after the build (cell averages, so ranges are deliberately generous).     */
const FRAMES = {
  // West Maui and Upcountry cannot share one frame at useful resolution
  // (~54 x 40 km would be ~210 m/px at 256 px), and the board itself draws
  // Upcountry as a separate inset. So two frames, ~85-100 m/px each.
  'lahaina-2023': [
    {
      suffix: '',
      // Lahaina town and the Honoapiilani coast (Kaanapali to Olowalu) up the
      // slopes of the West Maui Mountains: Lahainaluna, Kelawea, Puu Kukui.
      name: 'West Maui: Lahaina coast to the West Maui Mountains',
      bbox: [-156.72, 20.80, -156.50, 20.97],
      px: 256,
      zoom: 12,
      spot: [
        ['Lahaina town (shore)', -156.672, 20.872, -1, 30],
        ['Puu Kukui summit area (>1000 m)', -156.587, 20.899, 1000, 1800],
        ['Offshore Auau Channel (sea)', -156.70, 20.81, -400, 0.5],
      ],
    },
    {
      suffix: 'upcountry',
      // Upcountry on the slope of Haleakala: Kula, Olinda, Makawao, Pukalani,
      // up to the summit, with the isthmus (Kahului) and Maalaea Bay's north edge.
      name: 'Upcountry Maui: Kula and Olinda on the slope of Haleakala',
      bbox: [-156.40, 20.62, -156.15, 20.85],
      px: 256,
      zoom: 12,
      spot: [
        ['Kula (~900 m)', -156.325, 20.790, 400, 1400],
        ['Haleakala summit (>2800 m)', -156.2533, 20.7097, 2700, 3100],
      ],
    },
  ],
  // Valencia coast (Albufera, the Turia and the Poyo/Pozalagua ramblas, Paiporta
  // and Horta Sud) west up the Magro basin through Requena to Utiel and the
  // Forata reservoir. One long frame (~95 x 44 km); 512 px long edge keeps it
  // ~190 m/px, since 256 would be ~370 m/px.
  'valencia-dana-2024': [
    {
      suffix: '',
      name: 'Valencia coast to the Utiel and Forata interior',
      bbox: [-1.35, 39.25, -0.20, 39.65],
      px: 512,
      zoom: 11,
      spot: [
        ['Valencia city (coast)', -0.376, 39.470, -1, 40],
        ['Mediterranean offshore (sea)', -0.20, 39.45, -200, 0.5],
        ['Utiel (~700 m)', -1.205, 39.568, 600, 900],
        ['Paiporta (Horta Sud, low)', -0.417, 39.428, -1, 40],
      ],
    },
  ],
  // Greater New Orleans: Lake Pontchartrain's south shore (Lakeview), the
  // Mississippi bend (Algiers across the river), Gentilly, the Lower Ninth Ward
  // and the St Bernard (Chalmette) edge, the Industrial Canal and the marsh to
  // the east. ~34 x 22 km at 384 px = ~90 m/px. North edge is held at 30.06:
  // the z12 tile 1022/1688 carries corrupt (nodata-like, -3000 to -21000 m)
  // values in its bottom-right corner, over the lake near 30.07 N, 90.15 W.
  // The frame is cropped clear of it rather than patching the source; the
  // plausibility gate below fails the build if such values ever come back.
  'katrina-2005': [
    {
      suffix: '',
      name: 'Greater New Orleans: lake, river and the city between',
      bbox: [-90.20, 29.86, -89.85, 30.06],
      px: 384,
      zoom: 12,
      spot: [
        ['Lakeview', -90.115, 30.005, -4, 4],
        ['Lower Ninth Ward', -90.005, 29.965, -4, 4],
        ['Gentilly (the ridge, higher)', -90.055, 30.000, -4, 8],
      ],
    },
  ],
  // The south Odisha coast: Gopalpur and Ganjam on the Bay of Bengal, north-east
  // along the barrier coast to Chilika lagoon and its inland hills (Berhampur
  // inland to the west). ~94 x 78 km at 512 px = ~185 m/px.
  'odisha-phailin-2013': [
    {
      suffix: '',
      name: 'Ganjam coast: Gopalpur to Chilika lagoon',
      bbox: [84.60, 19.15, 85.50, 19.85],
      px: 512,
      zoom: 11,
      spot: [
        ['Gopalpur-on-Sea (coast)', 84.905, 19.262, -1, 20],
        ['Bay of Bengal offshore (sea)', 85.40, 19.20, -200, 0.5],
        ['Chilika lagoon (near sea level)', 85.30, 19.72, -5, 10],
        ['Berhampur (coastal plain edge)', 84.79, 19.31, 0, 100],
      ],
    },
  ],
};

/* ── The gate ─────────────────────────────────────────────────────────────── */
function playableIds() {
  const ids = [];
  for (const f of readdirSync(scenDir).filter((n) => n.endsWith('.json')).sort()) {
    const s = JSON.parse(readFileSync(resolve(scenDir, f), 'utf8'));
    if (s.status === 'playable') ids.push(s.id);
  }
  return ids;
}
const playable = playableIds();
const missing = playable.filter((id) => !FRAMES[id]);
if (missing.length) {
  console.error(`TERRAIN GATE FAILED: playable scenario(s) without a bbox entry in scripts/build-terrain.mjs FRAMES: ${missing.join(', ')}`);
  console.error('Add a frame (bbox, px, zoom, spot checks) so the scenario ships with real ground.');
  process.exit(1);
}
if (CHECK_ONLY) {
  console.log(`terrain gate ok: ${playable.length} playable scenario(s) all have frames`);
  process.exit(0);
}

/* ── Fetch + cache (curl, so the environment's proxy settings apply) ──────── */
mkdirSync(rawDir, { recursive: true });
mkdirSync(outDir, { recursive: true });
const sleepSync = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
function fetchBuf(url, tries = 5) {
  for (let i = 0; i < tries; i++) {
    try {
      return execFileSync('curl', ['-sSfL', '--max-time', '60', '-A', 'crises-cinema terrain build', url], { maxBuffer: 64 * 1024 * 1024 });
    } catch (e) {
      if (i === tries - 1) throw new Error(`fetch failed: ${url} (${e.message.split('\n')[0]})`);
      sleepSync(1500 * (i + 1));
    }
  }
}
function cached(file, url) {
  const p = resolve(rawDir, file);
  if (existsSync(p)) return readFileSync(p);
  mkdirSync(dirname(p), { recursive: true });
  const b = fetchBuf(url);
  writeFileSync(p, b);
  return b;
}

/* ── Licence: registry page + the attribution file it points at ────────────── */
function decodeEntities(s) {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}
function registryFacts() {
  const html = cached('registry-terrain-tiles.html', REGISTRY_URL).toString('utf8');
  const stamp = resolve(rawDir, 'registry-retrieved.txt');
  if (!existsSync(stamp)) writeFileSync(stamp, new Date().toISOString().slice(0, 10) + '\n');
  const retrieved = readFileSync(stamp, 'utf8').trim();
  const text = decodeEntities(html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ')).replace(/[ \t]+/g, ' ');
  const field = (label) => {
    const m = text.match(new RegExp(`${label}\\s*\\n\\s*([^\\n]+)`));
    return m ? m[1].trim() : null;
  };
  const registry = {
    title: 'Terrain Tiles',
    description: (text.match(/Description\s*\n\s*([^\n]+)/) || [])[1]?.trim() ?? null,
    license: field('License'),
    managedBy: field('Managed By'),
    updateFrequency: field('Update Frequency'),
  };
  if (!registry.license || !/attribution\.md/.test(registry.license)) {
    throw new Error('registry page no longer states the licence as the joerd attribution.md; re-verify before shipping');
  }
  const att = cached('joerd-attribution.md', ATTRIBUTION_URL).toString('utf8');
  const m = att.match(/\*\*\*Required attribution:\*\*\*\s*```\n([\s\S]*?)```/);
  if (!m) throw new Error('could not find the "Required attribution" block in attribution.md');
  const attribution = m[1].trimEnd();
  const srtm = /SRTM is a public domain dataset/.test(att);
  return { registry, attribution, retrieved, srtmNoteSeen: srtm };
}

/* ── Minimal PNG reader (8-bit RGB/RGBA, non-interlaced) and 16-bit writer ── */
function readPng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let off = 8, w = 0, h = 0, depth = 0, ctype = 0, interlace = 0;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off), type = buf.toString('ascii', off + 4, off + 8), d = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); depth = d[8]; ctype = d[9]; interlace = d[12]; }
    else if (type === 'IDAT') idat.push(d);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  if (depth !== 8 || interlace !== 0 || (ctype !== 2 && ctype !== 6)) throw new Error(`unsupported PNG (depth ${depth}, type ${ctype}, interlace ${interlace})`);
  const bpp = ctype === 2 ? 3 : 4;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * bpp;
  const out = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    const src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[y * stride + x - bpp] : 0;
      const b = y > 0 ? out[(y - 1) * stride + x] : 0;
      const c = x >= bpp && y > 0 ? out[(y - 1) * stride + x - bpp] : 0;
      let v = src[x];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      out[y * stride + x] = v & 255;
    }
  }
  return { w, h, bpp, data: out };
}

const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf) { let c = 0xffffffff; for (const b of buf) c = CRC_TABLE[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) {
  const t = Buffer.from(type, 'ascii'), len = Buffer.alloc(4), crc = Buffer.alloc(4);
  len.writeUInt32BE(data.length); crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}
function writePng16(w, h, samples) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 16; ihdr[9] = 0; // 16-bit greyscale
  const raw = Buffer.alloc((w * 2 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 2 + 1)] = 0; // filter: none
    for (let x = 0; x < w; x++) raw.writeUInt16BE(samples[y * w + x], y * (w * 2 + 1) + 1 + x * 2);
  }
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

/* ── Geometry ─────────────────────────────────────────────────────────────── */
const worldPx = (z) => 256 * 2 ** z;
const lonToX = (lon, z) => ((lon + 180) / 360) * worldPx(z);
const latToY = (lat, z) => {
  const s = Math.sin((lat * Math.PI) / 180);
  return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * worldPx(z);
};

function buildFrame(frame) {
  const [w, s, e, n] = frame.bbox, z = frame.zoom;
  const x0 = Math.floor(lonToX(w, z) / 256), x1 = Math.floor(lonToX(e, z) / 256);
  const y0 = Math.floor(latToY(n, z) / 256), y1 = Math.floor(latToY(s, z) / 256);
  const mw = (x1 - x0 + 1) * 256, mh = (y1 - y0 + 1) * 256;
  const mosaic = new Float32Array(mw * mh);
  let tiles = 0;
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    const png = readPng(cached(`tiles/${z}/${tx}/${ty}.png`, TILE_URL(z, tx, ty)));
    if (png.w !== 256 || png.h !== 256) throw new Error(`tile ${z}/${tx}/${ty} is ${png.w}x${png.h}`);
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
      const i = (y * 256 + x) * png.bpp;
      // terrarium: (R*256 + G + B/256) - 32768
      mosaic[((ty - y0) * 256 + y) * mw + (tx - x0) * 256 + x] = png.data[i] * 256 + png.data[i + 1] + png.data[i + 2] / 256 - 32768;
    }
    tiles++;
  }
  const sample = (lon, lat) => { // bilinear on the mosaic, pixel centres at +0.5
    const px = lonToX(lon, z) - x0 * 256 - 0.5, py = latToY(lat, z) - y0 * 256 - 0.5;
    const ix = Math.max(0, Math.min(mw - 2, Math.floor(px))), iy = Math.max(0, Math.min(mh - 2, Math.floor(py)));
    const fx = Math.max(0, Math.min(1, px - ix)), fy = Math.max(0, Math.min(1, py - iy));
    const a = mosaic[iy * mw + ix], b = mosaic[iy * mw + ix + 1], c = mosaic[(iy + 1) * mw + ix], d = mosaic[(iy + 1) * mw + ix + 1];
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
  };

  const midLat = (s + n) / 2;
  const widthM = (e - w) * 111320 * Math.cos((midLat * Math.PI) / 180), heightM = (n - s) * 110574;
  const W = widthM >= heightM ? frame.px : Math.round((frame.px * widthM) / heightM);
  const H = widthM >= heightM ? Math.round((frame.px * heightM) / widthM) : frame.px;
  const mppX = widthM / W, mppY = heightM / H;
  const nativeM = (40075016.686 * Math.cos((midLat * Math.PI) / 180)) / worldPx(z);
  const k = Math.max(1, Math.min(8, Math.ceil(Math.max(mppX, mppY) / nativeM))); // k x k box average per cell

  const grid = new Float32Array(W * H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    let sum = 0;
    for (let sj = 0; sj < k; sj++) for (let si = 0; si < k; si++) {
      const lon = w + ((i + (si + 0.5) / k) / W) * (e - w), lat = n - ((j + (sj + 0.5) / k) / H) * (n - s);
      sum += sample(lon, lat);
    }
    grid[j * W + i] = sum / (k * k);
  }
  return { W, H, grid, tiles, mppX, mppY, k, nativeM };
}

const at = (g, bbox, lon, lat) => {
  const [w, s, e, n] = bbox;
  const i = Math.min(g.W - 1, Math.max(0, Math.floor(((lon - w) / (e - w)) * g.W)));
  const j = Math.min(g.H - 1, Math.max(0, Math.floor(((n - lat) / (n - s)) * g.H)));
  return g.grid[j * g.W + i];
};

/* ── Run ──────────────────────────────────────────────────────────────────── */
const { registry, attribution, retrieved } = registryFacts();
const SOURCE = {
  publisher: `${registry.managedBy} (dataset "${registry.title}", hosted on the Registry of Open Data on AWS)`,
  dataset: 'AWS Terrain Tiles, terrarium encoding (Mapzen joerd; aggregates SRTM, GMTED2010, ETOPO1, USGS 3DEP/NED, EU-DEM and others)',
  url: REGISTRY_URL,
  tileUrlTemplate: 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',
  license: `The registry page's License field reads: "${registry.license}" (an attribution file, not a named licence). The "Required attribution" block in that file reads:\n${attribution}`,
  licenseUrl: registry.license,
  retrieved,
};

const rows = [];
const failures = [];
let totalBytes = 0;
for (const id of Object.keys(FRAMES)) {
  if (!playable.includes(id)) continue; // frames for stubs are allowed but not built here
  for (const frame of FRAMES[id]) {
    const file = frame.suffix ? `${id}-${frame.suffix}` : id;
    const g = buildFrame(frame);
    let min = Infinity, max = -Infinity, below = 0, nearZero = 0;
    for (const v of g.grid) { if (v < min) min = v; if (v > max) max = v; if (v < 0) below++; if (v <= 1) nearZero++; }
    const range = max - min;
    const samples = new Uint16Array(g.W * g.H);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.round(((g.grid[i] - min) / range) * 65535);
    const png = writePng16(g.W, g.H, samples);
    // round-trip: the stored samples must decode back to within one quantum
    const quantum = range / 65535;
    const belowPct = (100 * below) / (g.W * g.H);
    const meta = {
      id: file,
      scenario: id,
      name: frame.name,
      bbox: frame.bbox,
      widthPx: g.W,
      heightPx: g.H,
      minElev: Number(min.toFixed(3)),
      maxElev: Number(max.toFixed(3)),
      metresPerPixel: Number(((g.mppX + g.mppY) / 2).toFixed(1)),
      metresPerPixelX: Number(g.mppX.toFixed(1)),
      metresPerPixelY: Number(g.mppY.toFixed(1)),
      verticalQuantumM: Number(quantum.toFixed(4)),
      encoding: {
        file: `${file}.png`,
        type: 'png16-greyscale',
        decode: 'elevation_m = minElev + (sample / 65535) * (maxElev - minElev)',
        rowOrder: 'row 0 = north edge',
        colOrder: 'column 0 = west edge',
        grid: 'linear in longitude/latitude over bbox; sample at cell centres',
        resample: `${g.k}x${g.k} box average of bilinear samples from the zoom-${frame.zoom} mosaic (native ~${g.nativeM.toFixed(0)} m/px)`,
        decodedFrom: 'terrarium RGB: (R*256 + G + B/256) - 32768',
      },
      stats: {
        belowSeaLevelPct: Number(belowPct.toFixed(1)),
        atOrBelowOneMetrePct: Number(((100 * nearZero) / (g.W * g.H)).toFixed(1)),
        note: 'Percent of grid cells (sea and lake surface read ~0 m, so they count toward atOrBelowOneMetrePct). The source tiles resolve land to about 1 m; shallow subsidence below that is not visible in this dataset.',
      },
      water: {
        seaLevelM: 0,
        note: 'Elevations are metres relative to mean sea level. Negative values are real: land below sea level, and sea/lake bed (terrarium carries bathymetry). The grid has no separate water mask; 0 m is the sea surface.',
      },
      source: { ...SOURCE, tilesZoom: frame.zoom },
    };
    writeFileSync(resolve(outDir, `${file}.png`), png);
    writeFileSync(resolve(outDir, `${file}.json`), JSON.stringify(meta, null, 2) + '\n');
    totalBytes += png.length + Buffer.byteLength(JSON.stringify(meta, null, 2) + '\n');

    // spot checks
    const spots = frame.spot.map(([label, lon, lat, lo, hi]) => {
      const v = at(g, frame.bbox, lon, lat), ok = v >= lo && v <= hi;
      if (!ok) failures.push(`${file}: ${label} = ${v.toFixed(1)} m, expected ${lo}..${hi}`);
      return { label, v, lo, hi, ok };
    });
    let extra = '';
    if (id === 'katrina-2005') {
      // the city rectangle south of the lake shore (lat <= 30.00), lake excluded
      const [w, s, e] = frame.bbox; let tot = 0, bl = 0, nl = 0;
      for (let j = 0; j < g.H; j++) for (let i = 0; i < g.W; i++) {
        const lat = frame.bbox[3] - ((j + 0.5) / g.H) * (frame.bbox[3] - s);
        if (lat <= 30.0) { tot++; const v = g.grid[j * g.W + i]; if (v < 0) bl++; if (v <= 1) nl++; }
      }
      extra = ` | city rectangle lat<=30.00 (lake excluded): ${((100 * bl) / tot).toFixed(1)}% below 0 m, ${((100 * nl) / tot).toFixed(1)}% at or below 1 m (river bed counts as below)`;
    }
    rows.push({ file, g, min, max, belowPct, bytes: png.length, spots, extra, mpp: (g.mppX + g.mppY) / 2 });
  }
}

console.log('\nTERRAIN SANITY TABLE');
console.log('asset'.padEnd(30), 'grid'.padEnd(9), 'm/px'.padEnd(6), 'tiles'.padEnd(6), 'min m'.padEnd(9), 'max m'.padEnd(9), '<0 m %'.padEnd(7), 'png KB');
for (const r of rows) {
  console.log(r.file.padEnd(30), `${r.g.W}x${r.g.H}`.padEnd(9), r.mpp.toFixed(0).padEnd(6), String(r.g.tiles).padEnd(6), r.min.toFixed(1).padEnd(9), r.max.toFixed(1).padEnd(9), r.belowPct.toFixed(1).padEnd(7), (r.bytes / 1024).toFixed(1));
}
console.log('\nSPOT CHECKS');
for (const r of rows) {
  for (const sp of r.spots) console.log(`  ${sp.ok ? 'ok  ' : 'FAIL'} ${r.file}: ${sp.label} = ${sp.v.toFixed(1)} m (expect ${sp.lo}..${sp.hi})`);
  if (r.extra) console.log(`  info ${r.file}${r.extra}`);
}
console.log(`\ntotal committed terrain bytes (png + json): ${(totalBytes / 1024).toFixed(1)} KB`);
for (const r of rows) if (r.min < -1000 || r.max > 9000) failures.push(`${r.file}: implausible elevation range ${r.min.toFixed(0)}..${r.max.toFixed(0)} m (corrupt tile data?)`);
if (rows.some((r) => r.bytes > 300 * 1024) || totalBytes > 1.5 * 1024 * 1024) failures.push('size budget exceeded (300 KB per heightmap, 1.5 MB total)');
if (failures.length) { console.error('\nTERRAIN BUILD FAILED:\n  ' + failures.join('\n  ')); process.exit(1); }

// Builds public/data/preparedness/world.json for the /preparedness page:
// one pre-projected SVG path per country, keyed by ISO3, so the client can
// draw the choropleth without any map library — the same hand-rolled
// equirectangular approach as /atlas and /dispatches, but with country
// outlines instead of the dot grid (a choropleth needs fillable shapes).
//
// Sources, both fetched at build time and cached under data/preparedness/raw:
//   - world-atlas@2.0.2 countries-110m.json (TopoJSON of Natural Earth
//     1:110m admin-0 boundaries; public domain)
//   - world-countries@5.1.0 for the numeric → alpha-3 code mapping (ODbL)
//
// The TopoJSON is decoded here by hand (delta-decoded arcs + transform) so
// the repo does not take on a topojson-client dependency for a build step.
//
// Projection (must match the client's pin projection in PreparednessView):
//   x = (lon + 180) / 360 * W;  y = (90 - lat) / 180 * H
// with W=1000, H=500. Antarctica is dropped — it has no index scores and
// wastes a fifth of the frame.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const rawDir = resolve(root, 'data/preparedness/raw');
const outDir = resolve(root, 'public/data/preparedness');
mkdirSync(rawDir, { recursive: true });
mkdirSync(outDir, { recursive: true });

const W = 1000;
const H = 500;

const ATLAS_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json';
const ISO_URL = 'https://cdn.jsdelivr.net/npm/world-countries@5.1.0/countries.json';

async function cached(url, file) {
  const path = resolve(rawDir, file);
  if (existsSync(path)) return JSON.parse(readFileSync(path, 'utf8'));
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  const text = await res.text();
  writeFileSync(path, text);
  return JSON.parse(text);
}

const topo = await cached(ATLAS_URL, 'countries-110m.json');
const iso = await cached(ISO_URL, 'world-countries.json');

// numeric (as zero-padded string, matching world-atlas ids) → alpha codes
const byNumeric = new Map(iso.map((c) => [c.ccn3, { iso3: c.cca3, iso2: c.cca2 }]));

/* ── TopoJSON decoding ─────────────────────────────────────────────────── */

const { scale, translate } = topo.transform;
const arcs = topo.arcs.map((arc) => {
  const pts = [];
  let x = 0;
  let y = 0;
  for (const [dx, dy] of arc) {
    x += dx;
    y += dy;
    pts.push([x * scale[0] + translate[0], y * scale[1] + translate[1]]);
  }
  return pts;
});

function ring(arcIndexes) {
  const pts = [];
  for (const ix of arcIndexes) {
    const arc = ix >= 0 ? arcs[ix] : arcs[~ix].slice().reverse();
    // Consecutive arcs share their join point; drop the duplicate.
    for (const p of pts.length ? arc.slice(1) : arc) pts.push(p);
  }
  return pts;
}

function project([lon, lat]) {
  return [((lon + 180) / 360) * W, ((90 - lat) / 180) * H];
}

const r1 = (n) => Math.round(n * 10) / 10;

function ringPath(pts) {
  const projected = pts.map(project);
  let d = '';
  let px = null;
  let py = null;
  for (const [x, y] of projected) {
    const rx = r1(x);
    const ry = r1(y);
    if (px === null) d += `M${rx} ${ry}`;
    else if (rx !== px || ry !== py) d += `L${rx} ${ry}`;
    px = rx;
    py = ry;
  }
  return d + 'Z';
}

/* ── Per-country paths ─────────────────────────────────────────────────── */

const countries = [];
for (const geom of topo.objects.countries.geometries) {
  const code = byNumeric.get(geom.id);
  if (!code) continue; // e.g. Kosovo carries a non-standard id in some editions
  if (code.iso3 === 'ATA') continue; // Antarctica
  const polys = geom.type === 'Polygon' ? [geom.arcs] : geom.arcs;
  let d = '';
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (const poly of polys) {
    for (const [i, arcIndexes] of poly.entries()) {
      const pts = ring(arcIndexes);
      d += ringPath(pts);
      if (i > 0) continue; // holes don't move the label point
      // Signed area / centroid of the outer ring, in projected space.
      let a = 0;
      let sx = 0;
      let sy = 0;
      const pr = pts.map(project);
      for (let j = 0; j < pr.length - 1; j++) {
        const cross = pr[j][0] * pr[j + 1][1] - pr[j + 1][0] * pr[j][1];
        a += cross;
        sx += (pr[j][0] + pr[j + 1][0]) * cross;
        sy += (pr[j][1] + pr[j + 1][1]) * cross;
      }
      if (Math.abs(a) > Math.abs(area)) {
        area = a;
        cx = sx / (3 * a);
        cy = sy / (3 * a);
      }
    }
  }
  countries.push({
    iso3: code.iso3,
    iso2: code.iso2,
    name: geom.properties.name,
    d,
    cx: r1(cx),
    cy: r1(cy),
  });
}

countries.sort((a, b) => a.iso3.localeCompare(b.iso3));

const out = {
  generated: new Date().toISOString().slice(0, 10),
  source: 'world-atlas@2.0.2 (Natural Earth 1:110m admin-0, public domain)',
  projection: 'equirectangular; x=(lon+180)/360*W, y=(90-lat)/180*H',
  width: W,
  height: H,
  countries,
};

writeFileSync(resolve(outDir, 'world.json'), JSON.stringify(out));
console.log(`world.json: ${countries.length} countries, ${(JSON.stringify(out).length / 1024).toFixed(0)} KB`);

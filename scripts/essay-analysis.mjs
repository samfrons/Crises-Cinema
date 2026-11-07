// Quantitative pattern analysis for the /preparedness essay.
// Reads only committed repo data. Run: node analyze.mjs > results.txt
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execSync } from "node:child_process";

const REPO = "/home/user/Crises-Cinema";
const DATA_REL = "public/data/preparedness";
const SCEN_REL = "src/data/scenarios.json";
const P = (rel) => path.join(REPO, rel);
const readJson = (rel) => JSON.parse(fs.readFileSync(P(rel), "utf8"));
const sha = (rel) => crypto.createHash("sha256").update(fs.readFileSync(P(rel))).digest("hex").slice(0, 16);

const out = [];
const log = (s = "") => out.push(s);
const H1 = (t) => { log(""); log("=".repeat(78)); log(t); log("=".repeat(78)); };
const H2 = (t) => { log(""); log("-- " + t + " " + "-".repeat(Math.max(0, 74 - t.length))); };

// ---------- formatting ----------
const num = (x) => (typeof x === "number" && Number.isFinite(x) ? x : null);
const fmtInt = (n) => (n === null ? "n/a" : Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ","));
const fmtPct = (x, d = 1) => (x === null ? "n/a" : (100 * x).toFixed(d) + "%");
const fmtR = (r) => (r === null ? "n/a" : (r >= 0 ? "+" : "") + r.toFixed(3));
const fmtBn = (x) => (x === null ? "n/a" : (x / 1e9).toFixed(2) + " bn");
const pad = (s, n) => String(s).padEnd(n);
const padL = (s, n) => String(s).padStart(n);

// ---------- statistics ----------
// Average (mid) ranks, 1-based, ties share the mean rank.
function ranks(arr) {
  const idx = arr.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
  const r = new Array(arr.length);
  let i = 0;
  while (i < idx.length) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) r[idx[k][1]] = avg;
    i = j + 1;
  }
  return r;
}
function pearson(x, y) {
  const n = x.length;
  if (n < 3) return null;
  const mx = x.reduce((a, b) => a + b, 0) / n;
  const my = y.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx, dy = y[i] - my;
    sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
  }
  if (sxx === 0 || syy === 0) return null; // constant input: undefined, not zero
  return sxy / Math.sqrt(sxx * syy);
}
// Spearman = Pearson on average ranks (handles ties).
const spearman = (x, y) => (x.length < 3 ? null : pearson(ranks(x), ranks(y)));
// Approximate 95% CI via Fisher z (Spearman ~ Pearson on ranks; approximate).
function fisherCI(r, n) {
  if (r === null || n <= 3 || Math.abs(r) >= 1) return null;
  const z = Math.atanh(r), se = 1 / Math.sqrt(n - 3);
  return [Math.tanh(z - 1.96 * se), Math.tanh(z + 1.96 * se)];
}
// Keep only keys where both values are numeric (never substitute zeros).
function pairsFor(keys, getX, getY) {
  const ks = [], x = [], y = [];
  for (const k of keys) {
    const a = getX(k), b = getY(k);
    if (a !== null && b !== null) { ks.push(k); x.push(a); y.push(b); }
  }
  return { ks, x, y, n: ks.length };
}
const tercile = (rank, n) => (rank <= n / 3 ? "bottom" : rank > (2 * n) / 3 ? "top" : "mid");

// ---------- load inputs ----------
const emdatJ = readJson(`${DATA_REL}/emdat.json`);
const idmcJ = readJson(`${DATA_REL}/idmc.json`);
const fundJ = readJson(`${DATA_REL}/funding.json`);
const informJ = readJson(`${DATA_REL}/inform.json`);
const ndgainJ = readJson(`${DATA_REL}/ndgain.json`);
const sparJ = readJson(`${DATA_REL}/spar.json`);
const worldJ = readJson(`${DATA_REL}/world.json`);
const scenJ = readJson(SCEN_REL);

const EM = emdatJ.countries, ID = idmcJ.countries, IN = informJ.countries, ND = ndgainJ.countries, SP = sparJ.countries;
const NAME = Object.fromEntries((worldJ.countries || []).map((c) => [c.iso3, c.name]));
const nm = (iso) => (NAME[iso] ? `${NAME[iso]} (${iso})` : iso);

const HAZ = emdatJ.hazards || ["earthquake", "flood", "storm", "wildfire", "drought"];
const TOTAL_DEATHS = "Total deaths (period)";
const LACK = "Lack of Coping Capacity";

// ---------- header and provenance ----------
let head = "unknown", dirty = "unknown";
try { head = execSync("git rev-parse --short HEAD", { cwd: REPO }).toString().trim(); } catch {}
try { dirty = execSync(`git status --porcelain -- ${DATA_REL} ${SCEN_REL}`, { cwd: REPO }).toString().trim() || "clean (matches HEAD)"; } catch {}

log("ESSAY QUANTITATIVE ANALYSIS: /preparedness (Crises-Cinema)");
log(`Repo HEAD: ${head} | data/scenario files vs HEAD: ${dirty}`);
log("");
log("INPUTS (file, sha256[:16], fields used):");
log(`  ${DATA_REL}/funding.json  ${sha(`${DATA_REL}/funding.json`)}  appeals[].{year,requiredUsd,fundedUsd,coverage}`);
log(`  ${DATA_REL}/emdat.json    ${sha(`${DATA_REL}/emdat.json`)}  countries[ISO].score (deaths per 100k, 2000-2025), .components["${TOTAL_DEATHS}"], .byHazard`);
log(`  ${DATA_REL}/idmc.json     ${sha(`${DATA_REL}/idmc.json`)}  countries[ISO].score (total new disaster displacements, 2008-2025), .byHazard`);
log(`  ${DATA_REL}/inform.json   ${sha(`${DATA_REL}/inform.json`)}  countries[ISO].components["${LACK}"] (0-10)`);
log(`  ${DATA_REL}/ndgain.json   ${sha(`${DATA_REL}/ndgain.json`)}  countries[ISO].score (0-100, higher = better)`);
log(`  ${DATA_REL}/spar.json     ${sha(`${DATA_REL}/spar.json`)}  countries[ISO].score (0-100, higher = better)`);
log(`  ${DATA_REL}/world.json    ${sha(`${DATA_REL}/world.json`)}  countries[].{iso3,name} (display names only)`);
log(`  ${SCEN_REL}  ${sha(SCEN_REL)}  playable[].{clock.timezone,scoring.impact.time,scoring.historical_first_public_alert,outcome.deaths,sources}`);
log("Country keys are ISO3. Layer country sets differ; every statistic reports its own N.");

// =====================================================================
H1("1. FUNDING: UN OCHA FTS appeals, 2010-2026 (funding.json appeals[])");
// =====================================================================
const appeals = (fundJ.appeals || []).slice().sort((a, b) => a.year - b.year);
log(`Rows in appeals[]: ${appeals.length}. 2026 is a partial year (source retrieved 2026-09-01).`);
log("Gap = requiredUsd - fundedUsd (negative = over-funded). Coverage recomputed as funded/required; stated 'coverage' compared.");
log("");
log(pad("Year", 6) + padL("Required", 12) + padL("Funded", 12) + padL("Gap", 12) + padL("Cover(calc)", 13) + padL("Stated", 9) + "  Flag");
let sumReq = 0, sumFund = 0, netGap = 0, grossShort = 0, nUsed = 0, nSkip = 0, coverMismatch = 0, overYears = 0;
const fRows = [];
for (const a of appeals) {
  const req = num(a.requiredUsd), fund = num(a.fundedUsd), stated = num(a.coverage);
  if (req === null || fund === null || req <= 0) {
    nSkip++;
    log(pad(a.year, 6) + "  SKIPPED: requiredUsd or fundedUsd missing/invalid");
    continue;
  }
  const cov = fund / req, gap = req - fund;
  let flag = "";
  if (stated !== null && Math.abs(stated - cov) > 0.01) { coverMismatch++; flag = "stated!=calc"; }
  nUsed++;
  sumReq += req; sumFund += fund; netGap += gap;
  if (gap > 0) grossShort += gap; else overYears++;
  fRows.push({ year: a.year, req, fund, cov, gap });
  log(pad(a.year, 6) + padL(fmtBn(req), 12) + padL(fmtBn(fund), 12) + padL(fmtBn(gap), 12) + padL(fmtPct(cov), 13) + padL(stated === null ? "n/a" : stated.toFixed(2), 9) + "  " + flag);
}
log("");
H2("Totals and cumulative gap");
log(`N years used: ${nUsed} (skipped: ${nSkip}). Years with coverage > 100% (over-funded): ${overYears}.`);
log(`Total required (sum over used years): ${fmtBn(sumReq)}`);
log(`Total funded  (sum over used years): ${fmtBn(sumFund)}`);
log(`Overall coverage (total funded / total required): ${fmtPct(sumFund / sumReq)}`);
log(`Cumulative NET gap (sum of required - funded, over-funded years offset deficit years): ${fmtBn(netGap)}`);
log(`Cumulative GROSS shortfall (sum of positive gaps only, no offset): ${fmtBn(grossShort)}`);
log(`Stated-vs-recomputed coverage disagreements (>0.01): ${coverMismatch} of ${nUsed}`);
log("Caveat: funding is donor/agency self-reported; double counting can inflate funded totals (see funding.json source.limitations).");

H2("Trend tests (N = years used)");
const yrs = fRows.map((r) => r.year), covs = fRows.map((r) => r.cov), reqs = fRows.map((r) => r.req);
const rYear = pearson(yrs, covs), sYear = spearman(yrs, covs);
const rReq = pearson(reqs, covs), sReq = spearman(reqs, covs);
log(`Year vs coverage:        Pearson ${fmtR(rYear)} | Spearman ${fmtR(sYear)} | N=${fRows.length}`);
log(`requiredUsd vs coverage: Pearson ${fmtR(rReq)} | Spearman ${fmtR(sReq)} | N=${fRows.length}`);
const f2025 = fRows.filter((r) => r.year <= 2025);
const rYear25 = pearson(f2025.map((r) => r.year), f2025.map((r) => r.cov));
const rReq25 = pearson(f2025.map((r) => r.req), f2025.map((r) => r.cov));
log(`Sensitivity, 2010-2025 only (drops partial 2026): year vs coverage Pearson ${fmtR(rYear25)} | requiredUsd vs coverage Pearson ${fmtR(rReq25)} | N=${f2025.length}`);
log(`Interpretation: ${rReq !== null && rReq < -0.5 ? "coverage falls as requirements rise (strong negative association, n=" + fRows.length + ")" : "no strong negative association between requirements and coverage"}. Association only; 17 points, one trend.`);

// =====================================================================
H1("2. CONCENTRATION: share of recorded deaths (EM-DAT) and displacements (IDMC)");
// =====================================================================
H2("EM-DAT deaths, 2000-2025 (emdat.json countries[].components)");
const emRows = Object.keys(EM)
  .map((iso) => [iso, num(EM[iso]?.components?.[TOTAL_DEATHS])])
  .filter((r) => r[1] !== null);
const emTotal = emRows.reduce((a, r) => a + r[1], 0);
const emSkipped = Object.keys(EM).length - emRows.length;
const emSorted = emRows.slice().sort((a, b) => b[1] - a[1]);
log(`Countries with a numeric total: N=${emRows.length} (skipped ${emSkipped}, no zero substitution). Global total: ${fmtInt(emTotal)} deaths.`);
const top5e = emSorted.slice(0, 5).reduce((a, r) => a + r[1], 0);
const top10e = emSorted.slice(0, 10).reduce((a, r) => a + r[1], 0);
log(`Top 5 share:  ${fmtPct(top5e / emTotal)} (${fmtInt(top5e)} deaths)`);
log(`Top 10 share: ${fmtPct(top10e / emTotal)} (${fmtInt(top10e)} deaths)`);
log("Top 10 (rank, country, deaths, share):");
emSorted.slice(0, 10).forEach((r, i) => log(`  ${padL(i + 1, 2)}. ${pad(nm(r[0]), 30)} ${padL(fmtInt(r[1]), 10)}  ${padL(fmtPct(r[1] / emTotal), 7)}`));
log("Note: EM-DAT country list includes small territories (e.g. Reunion, Guadeloupe); counts are as the file attributes them.");

H2("IDMC new disaster displacements, 2008-2025 (idmc.json countries[].score = total)");
const idRows = Object.keys(ID).map((iso) => [iso, num(ID[iso]?.score)]).filter((r) => r[1] !== null);
const idTotal = idRows.reduce((a, r) => a + r[1], 0);
const idSorted = idRows.slice().sort((a, b) => b[1] - a[1]);
log(`Countries with a numeric score: N=${idRows.length} (skipped ${Object.keys(ID).length - idRows.length}). Global total: ${fmtInt(idTotal)} displacements.`);
const top5i = idSorted.slice(0, 5).reduce((a, r) => a + r[1], 0);
const top10i = idSorted.slice(0, 10).reduce((a, r) => a + r[1], 0);
log(`Top 5 share:  ${fmtPct(top5i / idTotal)} (${fmtInt(top5i)})`);
log(`Top 10 share: ${fmtPct(top10i / idTotal)} (${fmtInt(top10i)})`);
log("Top 10 (rank, country, displacements, share):");
idSorted.slice(0, 10).forEach((r, i) => log(`  ${padL(i + 1, 2)}. ${pad(nm(r[0]), 30)} ${padL(fmtInt(r[1]), 12)}  ${padL(fmtPct(r[1] / idTotal), 7)}`));
log("Caveat: IDMC figures are flows (new displacements), can be double-counted across events, and are modeled estimates.");

// =====================================================================
H1("3. SCORES vs OUTCOMES (Spearman rank correlation)");
// =====================================================================
// Outcome = EM-DAT score = deaths per 100k over 2000-2025 (checked: implied population
// = total deaths / score * 1e5 gives plausible populations, e.g. AFG ~41M, CHN ~1.41bn).
const outcome = (iso) => num(EM[iso]?.score);
const outcomeKeys = Object.keys(EM);
log(`Outcome variable: EM-DAT score (deaths per 100k population, cumulative 2000-2025). N with numeric outcome: ${outcomeKeys.filter((k) => outcome(k) !== null).length} of ${outcomeKeys.length}.`);
log("Expected sign: INFORM 'Lack of Coping Capacity' higher=worse -> positive rho expected; ND-GAIN and SPAR higher=better -> negative rho expected.");
log("");
const tests = [
  { label: "(a) INFORM Lack of Coping Capacity (0-10, higher=worse)", src: IN, get: (iso) => num(IN[iso]?.components?.[LACK]), file: "inform.json", expect: "+", layerKeys: Object.keys(IN) },
  { label: "(b) ND-GAIN overall score (0-100, higher=better)", src: ND, get: (iso) => num(ND[iso]?.score), file: "ndgain.json", expect: "-", layerKeys: Object.keys(ND) },
  { label: "(c) WHO SPAR overall score (0-100, higher=better)", src: SP, get: (iso) => num(SP[iso]?.score), file: "spar.json", expect: "-", layerKeys: Object.keys(SP) },
];
const testResults = {};
for (const t of tests) {
  const allN = t.layerKeys.filter((k) => t.get(k) !== null).length;
  const p = pairsFor(t.layerKeys, t.get, outcome);
  const rho = spearman(p.x, p.y);
  const ci = fisherCI(rho, p.n);
  testResults[t.file] = p;
  H2(t.label);
  log(`  Layer ${t.file}: numeric values for ${allN} of ${t.layerKeys.length} countries.`);
  log(`  Overlap with EM-DAT outcome (both numeric): N=${p.n}`);
  log(`  Spearman rho = ${fmtR(rho)}   approx 95% CI [${ci ? fmtR(ci[0]) + ", " + fmtR(ci[1]) : "n/a"}]   expected sign: ${t.expect}`);
  if (rho !== null) {
    const consistent = (t.expect === "+" && rho > 0) || (t.expect === "-" && rho < 0);
    log(`  Direction ${consistent ? "matches" : "does NOT match"} the expected sign. |rho| ${Math.abs(rho) < 0.1 ? "< 0.1: negligible" : Math.abs(rho) < 0.3 ? "0.1-0.3: weak" : "> 0.3: moderate or stronger"}.`);
  }
}
log("");
log("Notes: EM-DAT outcome is cumulative 2000-2025 deaths while scores are 2024-2025 snapshots, so the design cannot establish ordering or cause.");
log("Scores are not independent of outcomes: post-disaster recovery and reporting feed back into capacity and recorded deaths.");

// ---- tercile analysis: prepared-by-score vs bad-outcome ----
const tercileTests = [
  { label: "SPAR", file: "spar.json", get: (iso) => num(SP[iso]?.score) },
  { label: "ND-GAIN", file: "ndgain.json", get: (iso) => num(ND[iso]?.score) },
];
for (const t of tercileTests) {
  H2(`Tercile check: ${t.label} "prepared" (top third of score) vs outcome (top third of deaths/100k)`);
  const p = pairsFor(Object.keys(EM), t.get, outcome);
  const N = p.n;
  if (N < 9) { log(`  N=${N}: too few overlapping countries for tercile analysis. Not computed.`); continue; }
  const rPrep = ranks(p.x); // higher = more prepared
  const rDeath = ranks(p.y); // higher = worse outcome
  const counts = {};
  const groups = { bad: [], good: [] };
  p.ks.forEach((iso, i) => {
    const tp = tercile(rPrep[i], N), td = tercile(rDeath[i], N);
    counts[tp + "|" + td] = (counts[tp + "|" + td] || 0) + 1;
    const pctP = rPrep[i] / N, pctD = rDeath[i] / N;
    if (tp === "top" && td === "top") {
      groups.bad.push({ iso, prep: p.x[i], death: p.y[i], rP: rPrep[i], rD: rDeath[i], mis: pctP + pctD - 1 });
    }
    if (tp === "bottom" && td === "bottom") {
      groups.good.push({ iso, prep: p.x[i], death: p.y[i], rP: rPrep[i], rD: rDeath[i], mis: (1 - pctP) + (1 - pctD) - 1 });
    }
  });
  log(`  N=${N} overlapping countries (${t.label} x EM-DAT). Tercile cut = rank thirds.`);
  log(`  Contingency (rows: ${t.label} prepared tercile; cols: deaths/100k tercile). Counts:`);
  log("                     deaths: low   mid   high");
  for (const tp of ["top", "mid", "bottom"]) {
    const label = tp === "top" ? "most prepared  " : tp === "mid" ? "middle         " : "least prepared ";
    const row = ["bottom", "mid", "top"].map((td) => padL(counts[tp + "|" + td] || 0, 6)).join("");
    log(`    ${label}${row}`);
  }
  // Mismatch = sum of two "mismatch-facing" percentiles minus 1; range about 0.33 to 1.
  const sortMis = (arr) => arr.slice().sort((a, b) => b.mis - a.mis);
  log(`  Group A: scored MOST prepared AND top-third deaths/100k: n=${groups.bad.length}`);
  log(`  Group B: scored LEAST prepared AND bottom-third deaths/100k: n=${groups.good.length}`);
  log(`  Ranked by mismatch = (prep-side pct) + (outcome-side pct) - 1, largest first. Top 10 each:`);
  log("    Group A (prepared by score, bad outcome):");
  sortMis(groups.bad).slice(0, 10).forEach((g, i) => log(`      ${padL(i + 1, 2)}. ${pad(nm(g.iso), 30)} ${t.label}=${g.prep.toFixed(1).padStart(5)} (rank ${g.rP}/${N})  deaths/100k=${padL(g.death.toFixed(2), 8)} (rank ${g.rD}/${N})  mis=${g.mis.toFixed(3)}`));
  log("    Group B (scored unprepared, good outcome):");
  sortMis(groups.good).slice(0, 10).forEach((g, i) => log(`      ${padL(i + 1, 2)}. ${pad(nm(g.iso), 30)} ${t.label}=${g.prep.toFixed(1).padStart(5)} (rank ${g.rP}/${N})  deaths/100k=${padL(g.death.toFixed(2), 8)} (rank ${g.rD}/${N})  mis=${g.mis.toFixed(3)}`));
  if (groups.bad.length < 5 || groups.good.length < 5) log("  Caution: a group under 5 countries; its list is illustrative, not a finding.");
  // Confound test: how much of each group's deaths sit OUTSIDE the five listed hazards (e.g. heat)?
  const residShare = (isos) => {
    let tot = 0, res = 0, n = 0;
    for (const iso of isos) {
      const bh = EM[iso]?.byHazard, tt = num(EM[iso]?.components?.[TOTAL_DEATHS]);
      if (tt === null || !bh || typeof bh !== "object" || !HAZ.some((h) => num(bh[h]) !== null)) continue;
      tot += tt; res += tt - HAZ.reduce((a, h) => a + (num(bh[h]) || 0), 0); n++;
    }
    return { n, s: tot > 0 ? res / tot : null };
  };
  const rA = residShare(groups.bad.map((g) => g.iso)), rB = residShare(groups.good.map((g) => g.iso)), rAll = residShare(p.ks);
  log(`  Residual share of deaths OUTSIDE the five listed hazards (confound check): Group A ${fmtPct(rA.s)} (N=${rA.n}); Group B ${fmtPct(rB.s)} (N=${rB.n}); all overlap ${fmtPct(rAll.s)} (N=${rAll.n}).`);
}
log("");
log("Caveat for ND-GAIN: its Readiness half tracks GDP per capita (source limitations), so 'prepared' partly means 'rich'.");

// =====================================================================
H1("4. HAZARD PROFILE (emdat.byHazard deaths; idmc.byHazard displacements)");
// =====================================================================
function hazardSums(layer, label) {
  const sums = {}, ns = {};
  const seenKeys = new Set();
  let withObj = 0, explicitZero = 0, absent = 0;
  for (const iso of Object.keys(layer)) {
    const bh = layer[iso]?.byHazard;
    if (!bh || typeof bh !== "object") continue;
    withObj++;
    Object.keys(bh).forEach((k) => seenKeys.add(k));
    for (const h of HAZ) {
      const x = num(bh[h]);
      if (x === null) { absent++; continue; }
      if (x === 0) explicitZero++;
      sums[h] = (sums[h] || 0) + x;
      ns[h] = (ns[h] || 0) + 1;
    }
  }
  log(`${label}: countries with byHazard = ${withObj}. Keys seen: ${[...seenKeys].sort().join(", ")}.`);
  log(`  Missing hazard keys (treated as not recorded, not zero): ${absent}. Explicit zeros: ${explicitZero}.`);
  return { sums, ns };
}

H2("EM-DAT deaths by hazard, 2000-2025");
const emHz = hazardSums(EM, "emdat.byHazard");
const emHzTotal = Object.values(emHz.sums).reduce((a, b) => a + b, 0);
// Residual: total deaths minus sum of the five hazard keys, only where both are numeric.
let resDeaths = 0, resN = 0, resTotalBoth = 0;
for (const iso of Object.keys(EM)) {
  const tot = num(EM[iso]?.components?.[TOTAL_DEATHS]);
  const bh = EM[iso]?.byHazard;
  if (tot === null || !bh || typeof bh !== "object") continue;
  const s = HAZ.reduce((a, h) => a + (num(bh[h]) || 0), 0);
  // Only count if at least one hazard key present (otherwise the sum is not a real figure).
  if (!HAZ.some((h) => num(bh[h]) !== null)) continue;
  resDeaths += tot - s; resTotalBoth += tot; resN++;
}
log(`Sum over five hazards: ${fmtInt(emHzTotal)} deaths. Residual (total - five hazards) across N=${resN} countries: ${fmtInt(resDeaths)} (${fmtPct(resDeaths / resTotalBoth)} of those countries' totals).`);
log("Residual = deaths in the country total not attributed to the five listed hazards. The mirror does not label them, so their type is unknown here. Not allocated to any hazard.");
log("Ranking (deaths; share of the five-hazard sum; share of all deaths incl. residual):");
Object.entries(emHz.sums).sort((a, b) => b[1] - a[1]).forEach(([h, v], i) =>
  log(`  ${i + 1}. ${pad(h, 11)} ${padL(fmtInt(v), 11)}  ${padL(fmtPct(v / emHzTotal), 7)} of five-hazard sum  ${padL(fmtPct(v / (emHzTotal + resDeaths)), 7)} of all deaths  (N=${emHz.ns[h]})`));

H2("IDMC displacements by hazard, 2008-2025");
const idHz = hazardSums(ID, "idmc.byHazard");
const idHzTotal = Object.values(idHz.sums).reduce((a, b) => a + b, 0);
log(`Sum over five hazards: ${fmtInt(idHzTotal)}. Global idmc score total: ${fmtInt(idTotal)} (residual ${fmtInt(idTotal - idHzTotal)} not attributed to the five hazards).`);
Object.entries(idHz.sums).sort((a, b) => b[1] - a[1]).forEach(([h, v], i) =>
  log(`  ${i + 1}. ${pad(h, 11)} ${padL(fmtInt(v), 12)}  ${padL(fmtPct(v / idHzTotal), 7)} of five-hazard sum  (N=${idHz.ns[h]})`));

H2("Deaths per displacement by hazard (matched countries only)");
const both = Object.keys(EM).filter((iso) => EM[iso]?.byHazard && ID[iso]?.byHazard);
log(`Countries with byHazard in both layers: N=${both.length}. Ratio = sum(deaths) / sum(displacements), over countries where BOTH values for that hazard are present.`);
log("Period mismatch: EM-DAT deaths 2000-2025 vs IDMC displacements 2008-2025. Aggregate ratios are dominated by a few large countries.");
const ratioRows = [];
for (const h of HAZ) {
  let d = 0, dis = 0, n = 0;
  for (const iso of both) {
    const de = num(EM[iso].byHazard[h]), di = num(ID[iso].byHazard[h]);
    if (de === null || di === null) continue;
    d += de; dis += di; n++;
  }
  ratioRows.push({ h, d, dis, n });
}
log(pad("Hazard", 12) + padL("N", 5) + padL("Deaths", 12) + padL("Displaced", 15) + padL("Deaths per 1,000 displaced", 28));
ratioRows.sort((a, b) => (b.dis > 0 ? b.d / b.dis : -1) - (a.dis > 0 ? a.d / a.dis : -1)).forEach((r) => {
  const ratio = r.dis > 0 ? ((r.d / r.dis) * 1000).toFixed(2) : "n/a (no displacement)";
  log(pad(r.h, 12) + padL(r.n, 5) + padL(fmtInt(r.d), 12) + padL(fmtInt(r.dis), 15) + padL(ratio, 28));
});
log("Reading: high deaths-per-displacement = lethal per person displaced (disruptive but less lethal hazards show low values). Rough contrast only.");

// =====================================================================
H1("5. WARNING LATENCY: playable scenarios (src/data/scenarios.json)");
// =====================================================================
const toMin = (hhmm) => { const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || ""); return m ? (+m[1]) * 60 + (+m[2]) : null; };
const fmtMin = (m) => (m === null ? "n/a" : (m >= 0 ? "+" : "-") + Math.floor(Math.abs(m) / 60) + "h" + String(Math.abs(m) % 60).padStart(2, "0") + "m (" + (m >= 0 ? "+" : "") + m + " min)");
const scen = scenJ.playable || [];
log(`Playable scenarios: N=${scen.length}. Sign: positive = alert AFTER impact; negative = alert BEFORE impact.`);
log(`Source fields: scoring.impact.time, scoring.historical_first_public_alert, clock.timezone, outcome.deaths.{min,max}.`);
log("");
log(pad("scenario", 20) + pad("hazard", 14) + pad("tz", 18) + pad("impact", 8) + pad("alert", 8) + "alert - impact");
const rowsLat = [];
for (const s of scen) {
  const imp = toMin(s.scoring?.impact?.time), alr = toMin(s.scoring?.historical_first_public_alert);
  const lat = imp !== null && alr !== null ? alr - imp : null;
  rowsLat.push({ s, lat });
  log(pad(s.id, 20) + pad(s.hazard, 14) + pad(s.clock?.timezone || "n/a", 18) + pad(s.scoring?.impact?.time || "n/a", 8) + pad(s.scoring?.historical_first_public_alert || "n/a", 8) + fmtMin(lat));
}
log("");
log("Death toll (outcome.deaths) and notes:");
for (const { s } of rowsLat) {
  const d = s.outcome?.deaths;
  const dmin = num(d?.min), dmax = num(d?.max);
  log(`  ${pad(s.id, 20)} deaths min=${dmin ?? "n/a"} max=${dmax ?? "n/a"} contested=${d?.contested ?? "n/a"} (N=${dmin !== null ? 1 : 0})`);
  if (s.scoring?.impact?.window_minutes) {
    const imp = toMin(s.scoring.impact.time), alr = toMin(s.scoring.historical_first_public_alert);
    const end = imp + s.scoring.impact.window_minutes;
    log(`    impact window ${s.scoring.impact.window_minutes} min (ends ${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}); alert vs window end: ${alr - end >= 0 ? "+" : ""}${alr - end} min`);
  }
}
// Alternative alert in the Valencia source note (not the scenario's defined field).
const valAemet = (scenJ.playable || []).flatMap((s) => (s.sources || []).filter((x) => x.id === "aemet-2024").map((x) => x.label))[0] || "";
const aemetM = /red-level warning of (\d{2}:\d{2})/.exec(valAemet);
if (aemetM) {
  const v = scen.find((s) => s.id === "valencia-dana-2024");
  const lat = toMin(aemetM[1]) - toMin(v.scoring.impact.time);
  log("");
  log(`Alternative, NOT the scenario's defined field: AEMET red-level warning per sources[aemet-2024].label = ${aemetM[1]} CET -> ${fmtMin(lat)} vs impact.`);
  log("  The scenario field (20:11) is the ES-Alert mobile broadcast; the earlier AEMET warning is a different alert type. Both are real and the essay should name which it means.");
}
log("");
log("N=" + scen.length + ": too few scenarios for any correlation or average. Reported as descriptive only; no statistic computed across them.");
log("Caveat: the two impact times mark different things (Lahaina: first homes ignite; Valencia: flood-wave arrival), so the latencies are not like-for-like.");

// =====================================================================
H1("DATA QUALITY NOTES (counted by the script)");
// =====================================================================
const emMissingScore = Object.keys(EM).filter((k) => outcome(k) === null).length;
const emTotalAll = Object.keys(EM).length;
log(`- EM-DAT: ${emMissingScore} of ${emTotalAll} countries have no numeric score (per-100k rate); they are excluded from rate analyses, included in death-share totals.`);
const byHzMismatch = Object.keys(EM).filter((k) => {
  const t = num(EM[k]?.components?.[TOTAL_DEATHS]);
  const bh = EM[k]?.byHazard;
  if (t === null || !bh) return false;
  return HAZ.reduce((a, h) => a + (num(bh[h]) || 0), 0) !== t;
}).length;
log(`- EM-DAT byHazard does not sum to the country total in ${byHzMismatch} countries (residual = deaths under hazard types outside the five listed; unlabelled in this mirror).`);
const idMismatch = Object.keys(ID).filter((k) => {
  const s = num(ID[k]?.score), bh = ID[k]?.byHazard;
  if (s === null || !bh) return false;
  return HAZ.reduce((a, h) => a + (num(bh[h]) || 0), 0) !== s;
}).length;
log(`- IDMC score differs from the sum of byHazard in ${idMismatch} countries. Score is used as the total; byHazard only for hazard breakdowns.`);
log(`- Funding: ${coverMismatch} stated-coverage values disagree with recomputed funded/required; 2026 is a partial year.`);
log(`- Layer year ranges differ: EM-DAT 2000-2025, IDMC 2008-2025, INFORM 2025, ND-GAIN 2024 (two-year lag), SPAR 2025, funding 2010-2026.`);
log("- SPAR and ND-GAIN are self-reported or proxy-composite; the essay's thesis rests on their meaning, not only the correlations.");

console.log(out.join("\n"));

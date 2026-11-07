# Essay research dossier: /preparedness ("The Last Mile")

Evidence base for the six essay sections in `src/app/preparedness/page.tsx`. Not prose; the
owner writes that. Compiled 2026-11-07 from two inputs:

- **Repo analysis**: statistics computed only from committed data (`public/data/preparedness/*.json`,
  `src/data/scenarios.json`), at commit fb7f82e; those files are byte-identical at bc0ebf9. The script
  is committed as `scripts/essay-analysis.mjs`; rerun it with `node scripts/essay-analysis.mjs` to
  reproduce every R-grade number.
- **Corpus research**: inquiry reports, papers and agency documents fetched on the web.

Dataset limitations already documented in `SOURCES.md` (FTS double counting, ND-GAIN tracks GDP,
SPAR self-reported, IDMC flows not stocks, EM-DAT under-records small events) are cited here, not
repeated.

**Grades.** **R** = computed from the repo's own data (association only). **A** = primary document
fetched and its text checked. **B** = primary exists, reached via press/agency summary. **C** =
secondary only. *Not verified* = could not be opened; it goes in the "do not use yet" list.

Note on mapping: the corpus file guessed the section letters before the headings were read. Its
"coordination" material (the repeated inquiry paragraph) belongs to b, d and f below, not c.

---

## Executive summary (ranked by insight × verifiability)

1. Three inquiries across 18 years (Katrina 2006, Fukushima NAIIC 2012, Lahaina 2024) write the same paragraph: the information existed, it did not move between agencies, and no one owned the whole picture. **A** · b, d, f
2. Lahaina's investigators list the last mile as numbered findings: residents never got the text (F36), one siren worked in the burn zone (F37), people stayed for want of an official order (F39), fire and police "never connected" (F41). **A** · b
3. Katrina had "adequate warning 56 hours before landfall" and a mandatory order 19 hours before it; the toll is now 1,392 (NHC update), not the 1,800 still quoted. **A** · b
4. UN appeal coverage fell from 124% (2010) to 62% (2025) as requirements rose (Pearson −0.95 with year, N=17), for a cumulative gross shortfall of $94.35 bn. **R** · e. The 2025 level conflicts with OCHA's own figure; see e.1
5. In 2025 the humanitarian system received $12 bn against its global appeal, "the lowest in a decade"; insured losses from two Los Angeles fires were estimated at $28–35 bn, more than twice that. **A/B, estimates** · e
6. Across 177 countries, twelve preparedness indices were "not meaningfully associated" with infection or fatality rates, while trust and low corruption were (Lancet 2022). Ledesma 2023 (BMJ Glob Health) finds a modest link with excess mortality and must sit beside this. **A** · c
7. In the site's own data, no index (INFORM coping, ND-GAIN, SPAR) tracks deaths/100k in the expected direction (N≈185). But the "prepared yet deadly" countries lose 45–80% of their recorded deaths outside the five labeled hazards, so the paradox there is largely a confound. **R** · c
8. Bangladesh cyclone deaths fell roughly a hundredfold (about 500,000 in 1970, 138,958 in 1991, 4,234 in 2007). Peer review credits warnings, shelters and volunteers, and admits there is no precise evidence on which of them did it. **A** · a, b
9. Earthquakes kill 17.2 people per 1,000 they displace; floods kill 0.64. The deadliest hazard is the one where the building does the killing. **R** · d
10. Turkey 2023: more than 53,000 dead, 118 defendants sentenced by early 2025, and permission to investigate "just three public officials". **A (HRW)** · d
11. Calling disasters "manmade" is now routine in official language; legal liability is not. Ahrtal (135 dead): the manslaughter investigation was discontinued in April 2024. **B** · d, f
12. Since 2000, heat adaptation in Europe avoided about 44% of the counterfactual heat deaths, and 47,690 people still died in summer 2023. Real progress, nowhere near Bangladesh-style elimination. **A** · b, c
13. WMO 2025: disaster mortality is "nearly six times lower" in countries with comprehensive multi-hazard warning systems. This is a cross-country association that wealth confounds. **A (press release)** · a
14. In the site's two playable scenarios the first public alert came after impact: Lahaina +46 min, Valencia +71 min. N=2, and the two impact times mark different things. **R** · b
15. UNEP 2025: developing countries need 12–14 times the adaptation finance they receive; the Loss and Damage Fund has $768 m pledged, about 0.2% of one year's need. The second figure is a rhetorical pairing only. **A / B–C** · e

---

## a. The architecture: "The machine we built for this"

**a.1 Warning systems are spreading, and their mortality dividend is an association**
- CLAIM: 119 countries now report a multi-hazard early warning system, more than double the number a decade ago, and mortality is far lower where those systems are comprehensive.
- EVIDENCE: 119 countries (60%), "record high", +113% in 10 years. Average comprehensiveness score +45% since 2015. Mortality "nearly six times lower" with more comprehensive MHEWS. Coverage: Asia-Pacific 72%, Americas/Caribbean 51%, SIDS 43%. Fewer than one-third of countries have risk-knowledge capability.
- SOURCE: WMO/UNDRR, *Global Status of MHEWS 2025*, WMO press release 12 Nov 2025. **A for the press release**; the full report was not read.
- CAVEAT: cross-country association. Richer countries have both more capability and lower mortality. Write "associated with", never "cuts". The site cannot test this itself: Sendai Target G is stubbed (`SOURCES.md`).

**a.2 The positive control: Bangladesh**
- CLAIM: Bangladesh cut cyclone mortality roughly a hundredfold in four decades with an apparatus of megaphones, concrete and volunteers.
- EVIDENCE: deaths 500,300 (1970) / 138,958 (1991) / 4,234 (Sidr, 2007). From 1991 to 2007 that is a ~33-fold drop, from the paper's own table. The paper credits early warning, shelters, evacuation plans, embankments, reforestation and the Cyclone Preparedness Programme (Bangladesh Red Crescent, launched 1970). In 1991, roughly 22% of people who did not reach a concrete or brick structure died; everyone who sheltered in one survived.
- SOURCES: Haque et al., *Bull WHO* 2012;90(2):150–156, PMC3302549 (**A**). Bern et al., *Bull WHO* 1993;71(1):73–78, PMC2393441 (**A**).
- CAVEAT: the 1970 baseline varies (UN 2007: 300,000–400,000), so write "roughly a hundredfold". The same paper says there is "currently no scientific evidence on the precise effect" of shelters, embankments or awareness programmes. Residual behaviour, verbatim: "people in coastal areas often still believe in a wait-and-see approach". The 2020 Amphan figure is not verified.

**a.3 Odisha: the forecast was good both times; the institution changed**
- CLAIM: Odisha had a usable forecast in 1999 and in 2013; what changed in between was the disaster authority and the shelter system.
- EVIDENCE: 1999: 9,887 dead (Government of India enumeration; estimates run to 30,000), and 44,500 people housed in 23 shelters. Phailin 2013: more than 500,000 moved to shelters, "a handful of direct fatalities", credited to NDMA and IMD.
- SOURCES: Al Jazeera (fetched; **B/C**). Death counts from encyclopedic summaries (**C**).
- CAVEAT: Phailin's toll is 21, 38 or 45 depending on source, so write "dozens". The institutional-cause claim is the common account, but no primary OSDMA document was fetched (**B**).

**a.4 The pre-institution case: Indian Ocean 2004**
- CLAIM: in 2004 the physics allowed about two hours of warning, and no channel existed to use them.
- EVIDENCE: PTWC received the signals at 00:58:53 UTC. Its 01:14 bulletin said there was no Pacific threat. Sri Lanka was hit around 03:23 UTC. PTWC's first sign of a destructive tsunami was newswire casualty reports around 03:30.
- SOURCE: Wikipedia timeline citing NOAA (**C**). Death toll not verified.
- CAVEAT: this is a detection/infrastructure gap, not a last-mile failure. It is the "before the machine" case.

*Scaffold claims in section a with no support in either input* (eleven clusters, a 72-hour emergency fund, Early Warnings for All by end-2027, the 2005 Humanitarian Response Review following Darfur): see "do not use yet".

---

## b. The last mile: "Where the graveyard is"

**b.1 Katrina: warned, then waited**
- CLAIM: New Orleans had 56 hours of adequate warning and used the last 19 for its mandatory evacuation order.
- EVIDENCE, verbatim: "Despite adequate warning 56 hours before landfall, Governor Blanco and Mayor Nagin delayed ordering a mandatory evacuation in New Orleans until 19 hours before landfall." Also: Katrina "had been predicted in theory for many years, and forecast with startling accuracy for five days". Toll: 1,392 = 520 direct + 565 indirect + 307 undetermined; NHC: "nearly 1400 combined direct and indirect fatalities".
- SOURCES: US House Select Bipartisan Committee, *A Failure of Initiative*, H. Rpt 109-377 (2006), **A**. NHC Tropical Cyclone Report, updated, **A**.
- CAVEAT: write "about 1,400 (NHC revision; originally reported as over 1,800)". The 37 unused hours are arithmetic from the report's two figures.

**b.2 Lahaina: the last mile as numbered findings**
- CLAIM: Lahaina's investigators set out the last mile in numbered findings: no text, no siren, no order, no unified command.
- EVIDENCE, verbatim. F36: "Many residents did NOT receive a text notification from the county regarding the high winds and high fire danger." F37: "Only one (1) siren from the All-Hazard Outdoor Warning Siren System was operable within the burn perimeter". F38: the system "had not been utilized for warning of WUI fires prior to August 8, 2023." F39: "many refused because there did not appear to be official notification that danger was imminent." F41: "The MFD and MPD never connected to establish a unified command." F75: "The alert systems in place did not adequately inform residents of inherent dangers." Deaths: 102.
- SOURCE: FSRI, Lahaina findings and recommendations (Hawaii AG), **A**: https://ag.hawaii.gov/wp-content/uploads/2024/09/FSRI_Lahaina_Report_Findings_and_Recommendations_09102024.pdf
- PAIRS WITH (R): the playable scenario's first public alert is 16:16 HST against impact (first homes ignite) at 15:30, so **+46 min**. Death toll 102, flagged `contested` in `scenarios.json`.
- CAVEAT: the Red Flag Warning of 7 August is not verified (it rests on a Wikipedia-derived source). Do not date the "known days ahead" claim to it.

**b.3 Camp Fire: minutes, measured**
- CLAIM: even a working alert chain takes time the fire did not give: 14 minutes to turn warnings into orders, then a phone tree most residents had not joined.
- EVIDENCE: the IC's warning request at 07:32 named the wrong side of Pentz ("west of Pentz" instead of "east"). Verbatim: "Fourteen minutes elapsed between the initial request and the time the warnings were upgraded to orders ... at 07:46." First CodeRED batch 07:57. "less than 40% of Paradise residents had signed up"; of 14,737 numbers called, 33% answered. Also: "the rapid fire spread outpaced the information flow". 85 dead.
- SOURCE: NIST TN 2252 (July 2023), **A**.
- CAVEAT: the 06:15 ignition time does not appear in the text. Do not state it.

**b.4 Valencia: twelve and a half hours**
- CLAIM: Valencia's red warning came at breakfast and the phone alert after dark.
- EVIDENCE: AEMET orange at 06:42 and red at 07:36 (some sources say 07:31) on 29 Oct 2024. ES-Alert at 20:11 (other reports give 20:12 or 20:28); a draft ES-Alert reportedly existed at 18:37. That is about 12.5 hours from red to phones.
- SOURCES: Maldita, El Independiente, Wikipedia, **C**. The primary source (the Catarroja instructing court) was not fetched.
- PAIRS WITH (R): scenario impact (flood-wave arrival) 19:00 CET, alert 20:11, so **+71 min**; +11 min after the 60-minute impact window closes. `scenarios.json` sources[aemet-2024] carries the 07:36 red warning (−684 min against impact). The essay must say which alert it means.
- CAVEAT: the death tolls disagree. The corpus has 234 (province) / 242 total (possibly 247 later); `scenarios.json` has 227–229, flagged contested. Reconcile before printing.

**b.5 Ahrtal: a mixed case, not the clean one the scaffold describes**
- CLAIM: the Ahr forecasts rose for hours without a district evacuation order; what failed, in the inquiry's phrase, was the "defizitäres Lagebild" (deficient situation picture).
- EVIDENCE: state forecasts for the Altenahr gauge went 2.37 m (09:22), 5.19 m (11:03), 4.06 m (c.16:00), then 7.07 m; the gauge rose about 7 m in 6 h and peaked near 10 m. Press reports put the first loudspeaker warnings around 20:00. 135 dead in the Ahr region (136 in Rhineland-Palatinate).
- SOURCES: search snippets of the LfU report, plus press. **C/B; forecast numbers and warning time not verified.** UA final report: Landtag RLP Drucksache 18/10000, https://dokumente.landtag.rlp.de/landtag/drucksachen/10000-18.pdf (2,141 pp, 88 MB, not read).
- CAVEAT: the scaffold's "EFAS warned days ahead and the forecast was essentially right" and "no siren left standing" have no support in either input. The forecasts were rising but uncertain, and the same report reportedly calls the scale "so gut wie unvorhersehbar" (as good as unforeseeable).

**b.6 Derna: 72 hours to zero evacuation (estimate-grade)**
- CLAIM: Libya's met centre warned about 72 hours ahead, and no evacuation followed.
- EVIDENCE: WMO via press: warnings issued some 72 hours ahead and emailed to authorities, but "not clear whether (the warnings) were effectively disseminated". Taalas: "we could have avoided most of the human casualties". A curfew was reported instead of an evacuation. Two dams failed.
- SOURCE: press quotes of WMO, **B/C**; wmo.int returned 404.
- CAVEAT: 11,300 dead (~10,100 missing) is an early OCHA/Red Crescent estimate that was never firmly confirmed. Always print it as "an estimate, dated".

**b.7 Heat: the dividend that shows up as a counterfactual**
- CLAIM: Europe built heat-health warning systems after 2003 and they worked, in the sense that tens of thousands still die each summer, just fewer than would have.
- EVIDENCE: 2003: "More than 70,000 additional deaths occurred in Europe during the summer 2003." 2022: 61,672 heat deaths (95% CI 37,643–86,807); Italy 18,010, Spain 11,324, Germany 8,173. 2023: 47,690 (28,853–66,525); the burden "would have been +80.0% higher in absence of present-century adaptation", i.e. about 44% of counterfactual deaths avoided (1 − 1/1.8).
- SOURCES: Robine et al., *C R Biol* 2008;331:171–8 (**A**). Ballester et al., *Nat Med* 2023;29:1857–66 (**A**). Gallo et al., *Nat Med* 2024;30:3101–5 (**A**).
- CAVEAT: the 2003 and 2022–23 series cover different country sets and are not directly comparable. "No equivalent decline" is only half true. The ~44% is our arithmetic from the paper's +80%.

**b.8 Boundary cases (print them; they make the thesis credible)**
- **Tōhoku 2011, A (JMA)**: the first warning came about 3 minutes after the quake, so latency was fine. The *content* was wrong. Verbatim: "The magnitude of Mj 7.9 that was promptly estimated and used in the initial tsunami warning was an underestimation"; underestimated heights "possibly contributed to delays in evacuation". Around 20,000 dead and missing. A forecast error, not a last-mile failure.
- **Pakistan 2022, A (PDNA)**: "more than 1,700" dead, 33 million affected, damage US$14.9 bn, losses US$15.2 bn, needs US$16.3 bn. The PDNA does not frame it as a warning failure. Exposure and drainage.
- **Indian Ocean 2004**: see a.4. No network to fail.

---

## c. Scores against reality: "The index that ranked us first"

**c.1 The literature: the paradox is real in early data, softer in later data**
- CLAIM: the countries the GHS Index ranked in its top five finished in the bottom eight of an OECD COVID ranking.
- EVIDENCE, verbatim: "countries ranked in the top five of the GHS index, occupy the bottom eight positions of the commutative ranking" (US, UK, Netherlands, Canada; Australia the exception). rs = −0.41, p = 0.013.
- SOURCE: Abbey et al., *PLoS ONE* 2020, https://doi.org/10.1371/journal.pone.0239398, PMC7540886, **A**.
- CAVEAT: the coefficient's sign depends on the ranking convention (lower = better), which is easy to misprint. Quote the top-five sentence, not the rs. OECD sample only. Raw reported deaths.

- CLAIM: preparedness scores did not predict detection time or mortality early in the pandemic; the age structure did.
- EVIDENCE: GHSI and JEE correlate with each other at r = 0.82, but with mortality per million only at r = 0.31 / 0.37 (positive: higher score, higher mortality). In regression neither was significant (negative binomial to 1 Jul 2020: GHSI IRR 1.01, P = 0.891; JEE IRR 0.99, P = 0.419). Share of population aged 65+ was the strongest predictor (IRR 1.10).
- SOURCE: Haider et al., *Epidemiology & Infection* 2020;148:e210, PMC7506172, **A**. (Not *BMJ Global Health*.)
- CAVEAT: the fetched text has CI inconsistencies between text and tables. Quote P values, not CIs.

- CLAIM: across 177 countries, preparedness indices were not meaningfully associated with infection or fatality rates; trust was.
- EVIDENCE, verbatim: "Pandemic-preparedness indices, which aim to measure health security capacity, were not meaningfully associated with standardised infection rates or IFRs. Measures of trust in the government and interpersonal trust, as well as less government corruption, had larger, statistically significant associations with lower standardised infection rates." Age profile explains 46.7% of IFR variation; "44.4% ... of cross-national variation in IFR could not be explained." At Denmark-level trust, infections might have been 12.9% lower (government trust) or 40.3% lower (interpersonal trust). 12 indices tested.
- SOURCE: COVID-19 National Preparedness Collaborators (Bollyky et al.), *Lancet* 2022;399(10334):1489–1512, https://doi.org/10.1016/S0140-6736(22)00172-6, **A (abstract via PubMed)**.
- CAVEAT: funded partly by the Gates Foundation, which also funds GHS Index partner work. Disclose neutrally if relevant.

- **COUNTER-EVIDENCE, same weight:** once COVID excess mortality is standardised for under-reporting and age, a higher GHS Index score is associated with *lower* mortality.
- EVIDENCE: overall β = −0.21 (95% CI −0.35 to −0.08) on excess-mortality comparative ratios, after income adjustment. Prevention, detection, response, international commitments and risk environment each negative (risk environment −0.30, −0.46 to −0.15). The US, ranked highest, is an outlier.
- SOURCE: Ledesma et al., *BMJ Global Health* 2023;8(7):e012203, **A (abstract)**.
- CAVEAT: authors are affiliated with Brown, NTI and the Gates Foundation (NTI co-produces the index). That is no reason to dismiss the paper, and it should be stated. **Required qualifier for any scores-paradox sentence:** "scores predicted poorly in early reported data; with better outcome measures a modest association appears, but trust, corruption and age explain more."

**c.2 The site's own data: the expected sign fails, and a confound explains much of it**
- CLAIM: in the site's own layers, countries that score as better prepared have, if anything, *more* recorded disaster deaths per head.
- EVIDENCE (Spearman vs EM-DAT deaths/100k, 2000–2025): INFORM Lack of Coping Capacity ρ = −0.196 [−0.33, −0.05], N=187 (expected +). ND-GAIN ρ = +0.187 [+0.04, +0.32], N=185 (expected −). SPAR ρ = +0.076 [−0.07, +0.22], N=185 (negligible). ND-GAIN terciles: 32 of 62 "most prepared" countries sit in the top third for deaths. Top mismatches: Germany, Italy, France, Greece, Spain.
- SOURCE: **R** (`emdat.json` score/components/byHazard; `inform.json` components["Lack of Coping Capacity"]; `ndgain.json` score; `spar.json` score).
- **CAVEAT (mandatory, never drop):**
  1. Most of the mismatch is deaths the mirror does not label. "Prepared but deadly" countries record 44.5% (SPAR, N=24) and 79.6% (ND-GAIN, N=29) of their deaths outside the five labeled hazards, against 24% overall and 8–12% for the opposite group. For individual countries the residual is about 97–99%: Italy 69,974 of 70,950; Spain 41,590 of 42,068; France 37,537 of 37,874; Germany 30,225 of 30,641; Russia 57,514 of 58,317. Haiti, Indonesia and Turkey are 0–1.5%. The residual's type is **unlabeled in the mirror**. That it is mostly extreme heat is a strong inference (it fits b.7's national totals), and it is **not verified** from the repo's data.
  2. Snapshots against history: scores are 2024–25, deaths are cumulative 2000–25. No ordering, no cause.
  3. ND-GAIN readiness tracks GDP (`SOURCES.md`), so "prepared" partly means "rich". SPAR is self-reported and health-only (`SOURCES.md`), with no flood or earthquake dimension at all.
  4. All correlations are weak (|ρ| < 0.2).
- HONEST FRAMING: the defensible line is not "the scores are useless". It is that the scores measure capacity against the hazards they were built for, while rich countries die of the hazard nobody scored (the heat part is an inference to verify). That connects to b.7 and is more interesting than the raw paradox.

**c.3 The scaffold's GHSI sentence**
- "US first, UK second" (GHSI 2019) is not in either input, and "among the worst on deaths per head within 18 months" is not sourced. Abbey's top-five sentence is the safe replacement. See "do not use yet".

---

## d. The verdicts: "There are no natural disasters"

**d.1 The official record says "manmade"**
- CLAIM: Japan's Diet commission did not call Fukushima a natural disaster.
- EVIDENCE, verbatim: "It was a profoundly manmade disaster - that could and should have been foreseen and prevented." "...the result of collusion between the government, the regulators and TEPCO ... the root causes were the organizational and regulatory systems ... rather than issues relating to the competency of any specific individual." "a typical example of 'regulatory capture'". Chairman: "Made in Japan".
- SOURCE: NAIIC (2012), **A**.
- CAVEAT: a parliamentary finding, not a verdict, and it explicitly names systems rather than people. The later TEPCO executive prosecution was not verified. The scaffold has "man-made" (hyphenated); the corpus text has "manmade". Check the original.

**d.2 Buildings kill: the deaths-per-displacement gradient**
- CLAIM: per person displaced, earthquakes are about 27 times deadlier than floods, because in an earthquake the building is the weapon.
- EVIDENCE: deaths per 1,000 displaced: earthquake 17.17 (N=58), drought 5.96, storm 1.16, flood 0.64, wildfire 0.41. Earthquakes are 50.8% of all recorded deaths 2000–2025 (796,370 of 1,569,792) but 9.3% of hazard-attributed displacements.
- SOURCE: **R** (`emdat.json` byHazard, `idmc.json` byHazard, matched countries).
- PAIRS WITH: Bern 1991 (a.2): no one who reached a concrete structure died. Turkey's amnesties (d.3).
- CAVEAT: periods differ (deaths 2000–25, displacement 2008–25), so the 2004 tsunami and Haiti 2010 sit in the numerator with partial displacement records. The ratio is dominated by a few large countries. IDMC counts flows, double-counted across events (`SOURCES.md`). "Building as weapon" is an interpretation; the gradient itself is the data.

**d.3 Turkey 2023: builders convicted, permitters shielded**
- CLAIM: Turkey's 2023 earthquakes killed more than 53,000 people; by early 2025 courts had sentenced 118 defendants, and permission to investigate had been granted for three public officials.
- EVIDENCE: "more than 53,000 people dead", "over 107,000 injured". "1,491 trials underway", "just 118 defendants" sentenced (Feb 2025). 70 indictments of private actors in Kahramanmaraş; "just three public officials". Under Law no. 4483 "prosecutors cannot open investigations of officials on their own initiative." Governments respond by "granting amnesty to contractors and others responsible for unlicensed construction"; "the most recent of such amnesty laws in May 2018."
- SOURCE: Human Rights Watch, 27 Mar 2024 and 6 Feb 2025 (fetched), **A**.
- PAIRS WITH (R): Turkey ranks ninth in EM-DAT deaths 2000–25 (54,764; 99% earthquake).
- CAVEAT: the contractor's 865-year sentence (Hasan Alpargun) is **C**. The 1999 İzmit comparator (~1,800 stalled trials) is **C**, with no like-for-like series, so no trend claim.

**d.4 Reclassification is increasing; liability is not**
- CLAIM: official language now says "manmade" routinely; criminal liability almost never reaches the people who decided.
- EVIDENCE: *Ahrtal*: Koblenz prosecutors discontinued the negligent-homicide investigation of ex-Landrat Pföhler and one crisis-staff member on 18 Apr 2024, finding no "hinreichender Tatverdacht" (sufficient suspicion), an "außergewöhnliche Naturkatastrophe" (exceptional natural disaster), and no near-certainty that earlier calls would have saved lives; more than 20 TB analysed (**B**). The same events produced the Landtag inquiry's "massive Versäumnisse" (massive failures; **B/C**). *Lahaina*: "no single factor"; the devastation "cannot be connected to one specific organization, individual, action or event" (AG News Release 2024-40, **A**). *Derna*: 12 officials convicted on 28 Jul 2024, roughly 9–27 years, 4 acquitted, appealable (**B/C**). *Valencia*: Mazón resigned 3 Nov 2025 and keeps parliamentary immunity (aforamiento); the case was still unresolved in May 2026 (**C**).
- CAVEAT: Derna is the exception (a fragmented-state court, appeal pending). Valencia's current status is **not verified** after May 2026. "Increasing" is about visibility (FSRI's 850 GB database, HRW tracking), not a measured trend.

**d.5 Concentration (context, not thesis)**
- EVIDENCE: 10 countries hold 69.4% of EM-DAT deaths 2000–25; Haiti alone 14.8% (232,884, almost all earthquake). For IDMC displacements, 10 countries hold 75.8%; China and the Philippines together 39.8%. **R**.
- CAVEAT: EM-DAT under-records small and slow-onset events in low-capacity states (`SOURCES.md`), so concentration is partly a reporting artefact.

*Scaffold's "a system in name only" (US Army Corps task force) is not in either input.* See below.

---

## e. The arithmetic: "What a life is priced at"

**e.1 Coverage falls as the bill rises**
- CLAIM: the more the humanitarian system asks for, the smaller the share it receives: from over-funded in 2010 to 62% in 2025.
- EVIDENCE: coverage 124% (2010), 143% (2011), last above 100% in 2016 (110%), then 86% (2017), 68% (2023), 62% (2025), 61% (2026, partial). Year vs coverage: Pearson −0.950, Spearman −0.961, N=17 (−0.943 without 2026). Requirements vs coverage: Pearson −0.866. Totals: $500.24 bn required, $424.51 bn funded; net gap $75.73 bn, **gross shortfall $94.35 bn** (positive gaps only).
- SOURCE: **R** (`funding.json` appeals[].{year,requiredUsd,fundedUsd,coverage}; stated and recomputed coverage agree in 17/17 years).
- CORPUS COUNTERPART: Fletcher (OCHA), 3 Dec 2025: 2025 funding "was only $12 billion, the lowest in a decade"; "the humanitarian community reached 98 million people" (UNOG transcript, **A**). Requirement $45.37 bn (Oct 2025, **B**); the corpus's own FTS plan sum is $45.47 bn, which **matches `funding.json` 2025 exactly**.
- **CAVEAT (material):** `funding.json` puts 2025 funding at **$28.19 bn (62%)**; OCHA's head says **$12 bn**, and a mid-year update said 21% ($9.6 bn) at end-September. The corpus summed FTS plan funding itself, got $16.1 bn, and discarded it because plan funding includes flows booked to other years. The committed series probably inflates funded totals in the same way (`SOURCES.md` already flags double counting; the pre-2017 >100% years are the symptom). **The trend survives; the levels, and TwoNumbers' 2025 bar, need reconciling before the essay prints a 2025 coverage figure.** 17 points is one trend, not a law.

**e.2 Two Los Angeles neighbourhoods against the world's appeal**
- CLAIM: in 2025 the insured damage from two Los Angeles fires was estimated at more than twice what the whole humanitarian system received against its global appeal.
- EVIDENCE: Verisk (22 Jan 2025): insured losses "$28 billion to $35 billion" (Palisades $20–25 bn, Eaton $8–10 bn). That is 2.3–2.9× the $12 bn received, and 60–80% of the $45.4 bn required. UCLA Anderson (3 Mar 2025): "total property and capital losses ... could range between $76 billion and $131 billion", 6–11× the funding received.
- SOURCES: Insurance Journal on Verisk (**A** for the article; Verisk release not read). UCLA Anderson Forecast (**A**, explicitly preliminary). Ratios are our arithmetic.
- CAVEAT (state in the text): insured ≠ economic loss; one metro event vs an annual global appeal for ~190 m targeted people; a stock of insured assets vs a flow of aid to uninsured people; "received" is a floor, because not all aid flows through the GHO; the estimates date from Jan–Mar 2025. Other contemporaneous ranges: Moody's RMS $20–30 bn, CoreLogic $35–45 bn. The UCLA page has internally inconsistent insured figures elsewhere ($45 bn, $59.6 bn, $75 bn). The scaffold's "asked for a comparable sum and received a fraction" is fair: 60–80% is comparable, and 26% (12/45.4) is a fraction. **AccuWeather's ~$250 bn: do not use.**

**e.3 The adaptation gap, and the Loss and Damage Fund**
- CLAIM: developing countries need 12–14 times the adaptation finance they receive, and the flow is shrinking.
- EVIDENCE: need "US$310-365 billion per year by 2035 (in 2023 prices)". Flows fell "from US$28 billion in 2022 to US$26 billion in 2023". Gap "US$284-339 billion per year". The Glasgow doubling goal "will be missed".
- SOURCE: UNEP, *Adaptation Gap Report 2025: Running on Empty* (PDF fetched), **A**.
- PAIRING: FRLD $768 m pledged, $495 m signed, $321–348 m paid in (around COP30). That is about 0.2–0.25% of one year's adaptation need; LA's insured loss is 36–46× the whole pledge. First call: $250 m, with requests of about $3 bn.
- CAVEAT: FRLD figures are **B/C** (no feed; the site's own pipeline could not reach it, per `SOURCES.md`). Loss and damage is a different budget line from adaptation, so the pairing is rhetorical context, not the Fund's own funding gap.

**e.4 Where the drop came from (use with care)**
- US government GHO funding: $11 bn (2024) to $2.5 bn (2025), per the 2026 overview via search summary, **B**. If it holds, it explains much of the 2025 fall. Verify first.

---

## f. Back to the pictures: "What cinema gets wrong"

**f.1 Inquiries find committees, not villains, and say so**
- CLAIM: the inquiries' refusal to name a villain is both the insight (the failure is systemic) and the loophole (no one is liable), and film can show neither.
- EVIDENCE: NAIIC: "rather than issues relating to the competency of any specific individual" (**A**). Lahaina: "no single factor"; "cannot be connected to one specific organization, individual, action or event" (**A**). Lahaina Phase Two: "a siloed command structure that contributed to a lack of communication both to the public and responding agencies" (**A**). Katrina: "primarily a failure of initiative"; "we are still an analog government in a digital age" (**A**). Ahrtal: investigation discontinued (**B**).
- COUNTER: villains do appear when they are builders: Turkey's 118 sentenced (A) and the contractor's 865-year sentence (C). Derna convicted officials (B/C). Write "almost never find a villain in office", not "never".

**f.2 The scientist nobody believes, inverted**
- CLAIM: in the record, the public is not ignoring a lone prophet. People are waiting for an official to tell them, and the official message never arrives.
- EVIDENCE: Lahaina F39, verbatim in b.2 (people refused to leave without "official notification", **A**). Bangladesh "wait-and-see", driven by earlier false warnings and poor shelters (**A**). Tōhoku: small early observed heights "may have misled people" (**A**).

**f.3 The hazard that doesn't photograph**
- CLAIM (inference, flagged): the film catalogue favours the visible hazard, while in the rich countries of the site's own data the leading killer is an unlabeled residual, very probably heat (c.2, b.7).
- CAVEAT: needs the residual's hazard type verified (see below) before it can be stated. Comparing hazard frequency in the film catalogue would mean bringing in `films.json`, which this dossier did not analyse.

---

## Figures the site could build from its own data

1. **Coverage strip, annotated** (exists: `TwoNumbers.tsx`). `funding.json` appeals[].{year, requiredUsd, fundedUsd, coverage}. Add: hatched 2026 (partial); a shaded gross-shortfall total ($94.35 bn) next to the net ($75.73 bn); a note at the pre-2017 >100% years naming double counting. **Blocker:** reconcile the 2025 funded figure with OCHA's $12 bn first (e.1).
2. **Scores vs outcomes scatter, coloured by residual share.** x = `spar.json` score (toggle `ndgain.json` score, `inform.json` components["Lack of Coping Capacity"]); y = `emdat.json` score (deaths/100k, log scale); colour = 1 − Σ byHazard / components["Total deaths (period)"]. It shows the European cluster sitting high on both axes and almost entirely residual-coloured, so the confound is the figure, not a footnote. Label it "deaths outside the five labeled hazards", not "heat".
3. **Deaths per 1,000 displaced, by hazard** (bar). `emdat.json` byHazard and `idmc.json` byHazard, summed over countries with both values: earthquake 17.17, drought 5.96, storm 1.16, flood 0.64, wildfire 0.41. Footnote the period mismatch and show N per bar.
4. **Concentration curve.** Cumulative share of deaths (`emdat.json` components["Total deaths (period)"]) and displacements (`idmc.json` score) against country rank, with the top 10 at 69.4% / 75.8%. Footnote EM-DAT's under-recording.
5. **Two-clock latency strip** (descriptive, N=2). `scenarios.json` playable[].scoring.impact.time, .scoring.historical_first_public_alert, clock.timezone, plus Valencia's sources[aemet-2024] red warning as a second marker. Show both "alert vs impact" (+46 / +71 min) and Valencia's "red warning vs phone" (~12.5 h). Label the two impacts as different events.

---

## Do not use yet (and what it would take)

| Claim | Status | To verify |
|---|---|---|
| Lahaina NWS Red Flag Warning, 7 Aug | Wikipedia-derived | NWS Honolulu product archive |
| Camp Fire 06:15 ignition | not in NIST text | NIST TN 2252 / CAL FIRE report |
| Ahrtal LfU forecast series; first-warning ~20:00; "so gut wie unvorhersehbar"; "massive Versäumnisse" | search/press (B/C) | Würdigung chapter of Drucksache 18/10000 (88 MB PDF) |
| Ahrtal constitutional complaint (Oct 2026) | search summary | beck-aktuell article or court docket |
| Valencia AEMET/ES-Alert times; draft at 18:37; toll 234/242/247 | C | Catarroja court instruction; Generalitat/AEMET records |
| Valencia legal status after May 2026 | stale | a current Spanish source |
| Derna WMO quotes, 72 h; 11,300 dead | press; wmo.int 404 | WMO statement archive; OCHA final sitrep |
| Derna convictions; "premeditated murder" | AP via aggregators; single source | AP/Reuters original |
| Indian Ocean 2004 PTWC timeline and toll | C | NOAA/PTWC primary log |
| UK COVID Inquiry Module 1 quotes ("failed their citizens", "wrong" pandemic) | press (403) | report text, 18 Jul 2024 |
| Phailin "38 deaths", ~1 m evacuated; Odisha institutional cause | World Bank feature not fetched | World Bank page; OSDMA documents |
| Amphan 2020, 26 deaths (Bangladesh) | secondary | Bangladesh MoDMR / peer review |
| GCA "24 hours' notice cuts damage 30%"; $800 m → $3–16 bn | B, not at source | GCA *Adapt Now* (2019) |
| WMO MHEWS full-report detail beyond the press release | not read | full report |
| Abbey rs sign convention | ambiguous | reread the paper's methods |
| Khalifa/Abbey IJID 2021 (vaccination ρ −0.1378); Lowy COVID index | not retrieved | the papers |
| TEPCO executive prosecution; Hawaiian Electric settlement; Maui/ATF cause report | not checked | court records; ATF report |
| Turkey: 865-year sentence; 1999 İzmit ~1,800 stalled trials | C | Anadolu original; a legal study |
| US GHO funding $11 bn → $2.5 bn | B | GHO 2026 text / FTS donor query |
| FRLD pledged/paid figures | B/C, no feed | FRLD board documents |
| LA: AccuWeather ~$250 bn; "16,000 structures" (scaffold) | not found / not in inputs | do not use; CAL FIRE damage inspection for structures |
| EM-DAT residual = heat | inference | OWID extreme-temperature column for the same grapher, or a registered EM-DAT export |
| Scaffold, section a: 11 clusters; 72-hour fund; EW4All end-2027; HRR 2005 after Darfur | not in inputs | OCHA/CERF/WMO primary pages |
| Scaffold, section b: EFAS "days ahead, essentially right"; "no siren left standing" (Ahr) | contradicted/unsupported | EFAS post-event review; UA report |
| Scaffold, section c: GHSI 2019 US 1st, UK 2nd; "worst on deaths per head within 18 months" | not in inputs | GHS Index 2019 report; a mortality dataset |
| Scaffold, section d: US Army Corps "a system in name only" | not in inputs | IPET final report |
| Lede: "ninety minutes between a correct forecast and a message" | unsupported (data: +46/+71 min after impact; ~12.5 h red→phone) | rewrite against b.2/b.4 |
| "14 case studies" (masthead) and the cards | outside this dossier | `caseStudies.ts` owner review |

---

## Intellectual honesty

The thesis is **strongest** where the evidence is primary and repeats: Katrina's 56 hours and Lahaina's numbered findings show warnings existing and not arriving (A); three inquiries in three countries write the same paragraph about information that would not move (A); and the funding arithmetic is unambiguous in direction: coverage collapses as need grows, ρ ≈ −0.96 over 17 years.

It needs **qualification** in five places. Tōhoku was a forecast-content failure and Pakistan 2022 was exposure, so "the last mile" is the commonest graveyard, not the only one. Ledesma 2023 finds the scores do predict, modestly, once mortality is measured properly. The site's own scores-vs-deaths paradox is largely an unlabeled-residual confound. Heat adaptation has avoided about 44% of the deaths that would otherwise have happened, which is real progress and should be credited. And the committed 2025 funding level disagrees with OCHA's own: fix the figure before the essay leans on it.

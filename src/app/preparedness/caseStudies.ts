/* ══════════════════════════════════════════════════════════════════════════
   EDITORIAL DRAFT — for the site owner's review before publication.

   Fourteen events, each written from the public record: what happened, what
   the system got right, where it failed, and what the official inquiry
   concluded. Every "inquiry" field names a real commission, committee, panel
   or evaluation; every "sources" entry names a publisher and a report title.
   URLs are given only where they are stable and certain — where they are not,
   the entry names the institution and the document instead of guessing a link.

   Casualty figures are the ones the naming institution published; several
   (Haiti, Derna, Myanmar) are contested, and the text says so rather than
   picking a side. Check these numbers against the latest revisions before this
   page goes live.
   ══════════════════════════════════════════════════════════════════════════ */

import type { FamilyId } from '@/lib/taxonomy';
import type { HazardKey } from './types';

export interface CaseStudy {
  id: string;
  /** Display name, as the record calls it. */
  title: string;
  /** Short label for the map pin. */
  pin: string;
  year: number;
  place: string;
  lat: number;
  lon: number;
  hazard: HazardKey;
  /** Events with no single geography — COVID-19 — are pinned at the seat of
   *  the institution that was supposed to be watching. */
  global?: boolean;
  toll: string;
  happened: string;
  worked: string;
  failed: string;
  inquiry: string;
  sources: string[];
  /** Which film families to pull cross-links from. */
  families: FamilyId[];
  /** Titles worth surfacing ahead of the family's best-rated. */
  titleMatch?: RegExp;
}

export const CASE_STUDIES: CaseStudy[] = [
  {
    id: 'tsunami-2004',
    title: 'Indian Ocean tsunami',
    pin: 'Indian Ocean tsunami',
    year: 2004,
    place: 'Banda Aceh, Indonesia, and thirteen other countries',
    lat: 5.55,
    lon: 95.32,
    hazard: 'earthquake',
    toll: '≈227,000 dead across 14 countries',
    happened:
      'A magnitude 9.1 rupture off northern Sumatra on 26 December 2004 sent waves across an ocean with no warning system in it. Aceh was struck within half an hour; Sri Lanka and India had roughly two hours, Somalia seven. The waves arrived everywhere as a surprise.',
    worked:
      'Where knowledge was local, it worked. On Simeulue, the oral tradition of smong — the ground shakes, run to the hills — carried a population of about 78,000 through the wave with a handful of deaths. The Moken sea nomads of the Andaman Sea read the receding water the same way. International giving was, in the end, unprecedented.',
    failed:
      'The Pacific Tsunami Warning Center saw the earthquake within minutes and had no mandate, no contact list and no channel to warn the Indian Ocean rim. Countries with two hours of lead time used none of it. The relief that followed was assessed as generous, duplicative, supply-driven and largely deaf to the people it served.',
    inquiry:
      'The Tsunami Evaluation Coalition — a joint evaluation by more than forty agencies, published through ALNAP in 2006 — concluded that the international response was well funded but poorly coordinated and that it too often bypassed and weakened local capacity. Its central recommendation was to strengthen national and local systems rather than the international ones. The Indian Ocean Tsunami Warning and Mitigation System was stood up under UNESCO-IOC in 2006.',
    sources: [
      'Tsunami Evaluation Coalition, “Synthesis Report: Expanded Summary — Joint evaluation of the international response to the Indian Ocean tsunami” (ALNAP, 2006)',
      'UNESCO Intergovernmental Oceanographic Commission, Indian Ocean Tsunami Warning and Mitigation System (IOTWMS) programme documents',
      'US Geological Survey, M 9.1 Sumatra–Andaman Islands earthquake summary',
    ],
    families: ['earth'],
    titleMatch: /tsunami|impossible|wave|deep water/i,
  },
  {
    id: 'katrina-2005',
    title: 'Hurricane Katrina',
    pin: 'Katrina',
    year: 2005,
    place: 'New Orleans and the Gulf Coast, United States',
    lat: 29.95,
    lon: -90.07,
    hazard: 'storm',
    toll: '≈1,390 dead in Louisiana and Mississippi',
    happened:
      'Katrina made landfall on 29 August 2005 as a large Category 3. The storm was survivable; the flood was not. More than fifty breaches in the federal hurricane-protection system put roughly eighty per cent of New Orleans under water, in places for weeks.',
    worked:
      'The National Hurricane Center forecast the track and the surge accurately and days ahead. The Coast Guard, operating on local initiative, rescued around 33,500 people. Neighbours in boats did much of the rest.',
    failed:
      'The evacuation order assumed a car. It was issued late, and roughly a hundred thousand residents — disproportionately poor, elderly and Black — had no way to comply. Federal coordination collapsed for days. The levees and floodwalls failed below their design storm, at design and construction faults, not at the limits of nature.',
    inquiry:
      'The US House bipartisan select committee titled its 2006 report “A Failure of Initiative”. The Interagency Performance Evaluation Task Force, convened by the Army Corps of Engineers itself, found that the hurricane protection works were “a system in name only” — built piecemeal over decades to inconsistent standards. The independent levee investigation team led from UC Berkeley reached the same conclusion, and put the primary cause of the flooding on engineering and institutional failure rather than on the storm.',
    sources: [
      'US House of Representatives, “A Failure of Initiative: Final Report of the Select Bipartisan Committee to Investigate the Preparation for and Response to Hurricane Katrina” (2006)',
      'Interagency Performance Evaluation Task Force (US Army Corps of Engineers), “Performance Evaluation of the New Orleans and Southeast Louisiana Hurricane Protection System” (2006–2009)',
      'Independent Levee Investigation Team (UC Berkeley / National Science Foundation), “Investigation of the Performance of the New Orleans Flood Protection Systems in Hurricane Katrina” (2006)',
    ],
    families: ['earth', 'wreckage'],
    titleMatch: /hurricane|katrina|levee|storm|surge/i,
  },
  {
    id: 'haiti-2010',
    title: 'Haiti earthquake',
    pin: 'Haiti quake',
    year: 2010,
    place: 'Port-au-Prince and Léogâne, Haiti',
    lat: 18.53,
    lon: -72.34,
    hazard: 'earthquake',
    toll: 'Government figures of 220,000–316,000 dead; independent estimates run far lower and the count remains contested',
    happened:
      'A magnitude 7.0 earthquake at 16:53 on 12 January 2010, twenty-five kilometres from a capital city of concrete frames built without a seismic code. The presidential palace, the parliament, the cathedral, the tax office and the UN mission headquarters all came down.',
    worked:
      'Haitians pulled the overwhelming majority of survivors out of the rubble in the first hours, before any foreign team landed. International urban search and rescue, once it arrived, made about 130 live extractions — the largest such operation on record.',
    failed:
      'There was no enforced building code to fail; there was no code. Coordination ran through a cluster system operating in English, in a French- and Creole-speaking country, on a UN base. And the response introduced a second disaster: cholera, absent from Haiti for a century, killing roughly ten thousand people over the following decade.',
    inquiry:
      'The UN Independent Panel of Experts on the Cholera Outbreak in Haiti reported in 2011 that the strain matched South Asian cholera and that sanitation at the Nepalese peacekeepers’ camp on the Meille tributary was inadequate; in 2016 the Secretary-General acknowledged the UN’s involvement and apologised. Separately, the Office of the Special Envoy for Haiti found that of the relief funding disbursed, about one per cent went to the Haitian government and well under one per cent to Haitian firms — the finding that made “build back better” a contested phrase.',
    sources: [
      'Independent Panel of Experts on the Cholera Outbreak in Haiti, report to the UN Secretary-General (2011)',
      'Office of the Special Envoy for Haiti, “Has Aid Changed? Channelling assistance to Haiti before and after the earthquake” (United Nations, 2011)',
      'Disasters Emergency Committee / Groupe URD, real-time evaluations of the Haiti earthquake response (2010–2011)',
    ],
    families: ['earth'],
    titleMatch: /earthquake|quake|aftershock/i,
  },
  {
    id: 'tohoku-2011',
    title: 'Tōhoku earthquake, tsunami and Fukushima Daiichi',
    pin: 'Tōhoku / Fukushima',
    year: 2011,
    place: 'Sanriku coast and Fukushima Prefecture, Japan',
    lat: 37.42,
    lon: 141.03,
    hazard: 'earthquake',
    toll: '≈19,750 dead or missing; about 165,000 evacuated from the nuclear exclusion zone',
    happened:
      'A magnitude 9.0 earthquake on 11 March 2011 generated a tsunami that overtopped seawalls designed for a smaller ocean. At Fukushima Daiichi the wave flooded the emergency generators, causing a station blackout and, over the following days, three core meltdowns and hydrogen explosions.',
    worked:
      'The buildings held. Japan’s seismic code did what it was written to do, and almost all of the deaths were drownings, not collapses. The Japan Meteorological Agency issued a warning within three minutes. In Kamaishi, years of school evacuation drills sent children uphill on their own initiative and pulled adults with them.',
    failed:
      'The design tsunami was set by an assumption, not by the geological record, and the operator had internal estimates it did not act on. The nuclear regulator was housed inside the ministry promoting nuclear power. Evacuating hospitals and care homes inside the exclusion zone killed patients that the radiation did not.',
    inquiry:
      'The Fukushima Nuclear Accident Independent Investigation Commission — the first independent commission in the history of Japan’s Diet — concluded in 2012 that the accident “was a profoundly man-made disaster that could and should have been foreseen and prevented”, and attributed it to collusion between the government, the regulators and TEPCO. The government’s own Investigation Committee (the Hatamura committee) reached compatible findings on the operator’s tsunami assumptions.',
    sources: [
      'National Diet of Japan, Fukushima Nuclear Accident Independent Investigation Commission (NAIIC), official report (2012)',
      'Investigation Committee on the Accident at the Fukushima Nuclear Power Stations of Tokyo Electric Power Company (ICANPS), final report (2012)',
      'International Atomic Energy Agency, “The Fukushima Daiichi Accident” — Report by the Director General (2015)',
    ],
    families: ['atomic', 'earth'],
    titleMatch: /reactor|meltdown|nuclear|radioactive|atomic|chernobyl|fallout|silkwood|china syndrome/i,
  },
  {
    id: 'haiyan-2013',
    title: 'Typhoon Haiyan (Yolanda)',
    pin: 'Haiyan',
    year: 2013,
    place: 'Tacloban and Eastern Visayas, Philippines',
    lat: 11.24,
    lon: 125.0,
    hazard: 'storm',
    toll: '6,300+ dead, 1,000+ missing, 4 million displaced',
    happened:
      'One of the strongest tropical cyclones ever measured at landfall crossed the Visayas on 8 November 2013. In Tacloban the storm surge reached five to six metres and behaved, as survivors kept saying, like a tsunami.',
    worked:
      'PAGASA forecast the track well and the government pre-emptively evacuated hundreds of thousands of people. That is the reason the toll is in the thousands rather than the tens of thousands.',
    failed:
      'The warning used the words “storm surge”, which had no purchase in Waray or Tagalog and which people heard as heavy rain. Some designated evacuation centres — including the Tacloban Astrodome — were inside the surge zone. Local government was itself a casualty: the responders were among the affected, and the response lost its first days to that.',
    inquiry:
      'The Inter-Agency Standing Committee’s Inter-Agency Humanitarian Evaluation of the Typhoon Haiyan response (2014) found a system that mobilised at speed but sidelined national and local structures and communicated poorly with affected people. PAGASA subsequently introduced explicit storm-surge warnings, hazard maps and colour-coded rainfall alerts — a warning failure fixed at the level of vocabulary.',
    sources: [
      'Inter-Agency Standing Committee, “Inter-Agency Humanitarian Evaluation of the Typhoon Haiyan Response” (2014)',
      'Philippine National Disaster Risk Reduction and Management Council, Yolanda situation and final reports (2013–2014)',
      'PAGASA, storm-surge warning system documentation (post-Yolanda revisions)',
    ],
    families: ['earth', 'climate'],
    titleMatch: /typhoon|hurricane|storm|cyclone|surge/i,
  },
  {
    id: 'ebola-2014',
    title: 'West Africa Ebola epidemic',
    pin: 'West Africa Ebola',
    year: 2014,
    place: 'Guinea, Liberia and Sierra Leone',
    lat: 8.56,
    lon: -10.13,
    hazard: 'epidemic',
    toll: '28,600 cases and 11,325 deaths recorded, 2014–2016',
    happened:
      'The index case was a child in Meliandou, Guinea, in December 2013. The outbreak was identified in March 2014, crossed three national borders through the Guinea–Liberia–Sierra Leone forest region, and reached capital cities — the first time Ebola had done so.',
    worked:
      'Nigeria stopped an imported chain of transmission in Lagos using contact-tracing staff and infrastructure built for polio eradication. Communities themselves changed burial practice, which mattered more than any imported intervention. The ring-vaccination trial in Guinea produced the first efficacious Ebola vaccine.',
    failed:
      'WHO declared a Public Health Emergency of International Concern on 8 August 2014, months after its own staff and Médecins Sans Frontières had raised the alarm; MSF had said in June that the outbreak was out of control. Country offices minimised the reports. The three affected states had almost no health workforce to lose, and lost it.',
    inquiry:
      'The Ebola Interim Assessment Panel convened by WHO (the Stocking panel, 2015) concluded that “WHO does not currently possess the capacity or organizational culture to deliver a full emergency public health response.” The Harvard–LSHTM Independent Panel on the Global Response to Ebola, published in The Lancet in 2015, called the delay a failure of global institutions with catastrophic human consequences. Both fed the creation of the WHO Health Emergencies Programme and the Contingency Fund for Emergencies.',
    sources: [
      'WHO Ebola Interim Assessment Panel, report to the Director-General (2015)',
      'Harvard Global Health Institute / London School of Hygiene & Tropical Medicine Independent Panel, “Will Ebola change the game?”, The Lancet (2015)',
      'UN High-level Panel on the Global Response to Health Crises, “Protecting Humanity from Future Health Crises” (2016)',
    ],
    families: ['plague'],
    titleMatch: /outbreak|virus|ebola|contagion|carriers/i,
  },
  {
    id: 'covid-2020',
    title: 'COVID-19',
    pin: 'COVID-19 (global)',
    year: 2020,
    place: 'Global — pinned at WHO headquarters, Geneva',
    lat: 46.23,
    lon: 6.14,
    hazard: 'epidemic',
    global: true,
    toll: '7 million deaths reported to WHO; ≈14.9 million excess deaths estimated for 2020–2021',
    happened:
      'A novel coronavirus reported from Wuhan on 31 December 2019 became a pandemic within ten weeks. Every country had a plan; almost none of the plans described what happened.',
    worked:
      'Genomic sequencing published in January 2020 and licensed vaccines within a year — the fastest vaccine development in history. Some states with recent epidemic memory, rather than high index scores, moved early and held.',
    failed:
      'The countries at the top of the 2019 Global Health Security Index — the United States first, the United Kingdom second — recorded among the worst per-capita death tolls in the world. The International Health Regulations had no enforcement and rewarded silence. February 2020 was lost. COVAX delivered late, and vaccine supply followed purchasing power.',
    inquiry:
      'The Independent Panel for Pandemic Preparedness and Response, co-chaired by Helen Clark and Ellen Johnson Sirleaf, reported in May 2021 under the title “COVID-19: Make it the Last Pandemic”. It called the pandemic “a preventable disaster”, described February 2020 as a lost month, and found the alert system too slow and too deferential. Its findings drove the negotiation of the WHO Pandemic Agreement, adopted in May 2025 — and the index-versus-outcome gap it exposed is the reason this page treats every score below as a hypothesis.',
    sources: [
      'Independent Panel for Pandemic Preparedness and Response, “COVID-19: Make it the Last Pandemic” (2021)',
      'WHO, “Global excess deaths associated with COVID-19, 2020–2021” (2022)',
      'Review Committee on the Functioning of the International Health Regulations (2005) during the COVID-19 Response, report to the World Health Assembly (2021)',
      'Nuclear Threat Initiative / Johns Hopkins Center for Health Security, Global Health Security Index (2019 and 2021 editions)',
    ],
    families: ['plague'],
    titleMatch: /contagion|pandemic|outbreak|virus|flu|andromeda/i,
  },
  {
    id: 'ahrtal-2021',
    title: 'Ahr valley floods',
    pin: 'Ahrtal floods',
    year: 2021,
    place: 'Ahrweiler district, Rhineland-Palatinate, Germany',
    lat: 50.54,
    lon: 7.12,
    hazard: 'flood',
    toll: '189 dead in Germany, 135 of them in the Ahrweiler district; 43 dead in Belgium',
    happened:
      'A stalled low-pressure system dropped up to 150 mm of rain in a day on saturated ground on 14–15 July 2021. The Ahr rose about eight metres and took bridges, gauges and whole streets with it in the dark.',
    worked:
      'The forecast. The European Flood Awareness System flagged an extreme event days in advance and issued explicit warnings to German authorities; the meteorology was, in the assessment that followed, essentially correct.',
    failed:
      'The translation from forecast into evacuation. District-level decisions came late or not at all, sirens had been decommissioned in the post-Cold-War decades, and Germany had no cell-broadcast alerting — it was introduced in 2023, after this. Twelve residents of a care home for people with disabilities in Sinzig drowned because nobody moved them.',
    inquiry:
      'The Landtag of Rhineland-Palatinate ran a committee of inquiry (Untersuchungsausschuss) into the flood and the warning chain; the state prosecutor opened proceedings against the Ahrweiler district administrator over delayed warnings, later discontinued. Independent post-event analysis published in Hydrology and Earth System Sciences put the failure squarely in dissemination rather than in prediction — the flood was forecast, and not warned.',
    sources: [
      'Landtag Rheinland-Pfalz, Untersuchungsausschuss on the July 2021 flood disaster, final report (2024)',
      'Copernicus European Flood Awareness System (EFAS), post-event analysis of the July 2021 floods',
      'Hydrology and Earth System Sciences, post-event review of forecasting and warning in the July 2021 western Europe floods (2022–2023)',
    ],
    families: ['earth', 'climate'],
    titleMatch: /flood|deluge|dam|rain|hard rain/i,
  },
  {
    id: 'pakistan-2022',
    title: 'Pakistan floods',
    pin: 'Pakistan floods',
    year: 2022,
    place: 'Sindh, Balochistan and southern Punjab, Pakistan',
    lat: 27.7,
    lon: 68.86,
    hazard: 'flood',
    toll: '1,739 dead; 33 million people affected; roughly a third of the country under water',
    happened:
      'A monsoon delivering five to eight times normal rainfall in Sindh and Balochistan, on top of accelerated glacier melt, flooded a third of Pakistan between June and September 2022 and left standing water for months.',
    worked:
      'The assessment machinery. A joint government–multilateral needs assessment was produced within weeks and became the evidentiary basis for the loss-and-damage fund agreed at COP27 three months later — the first time a specific disaster produced a specific instrument.',
    failed:
      'Money. The revised UN flash appeal closed far short of its target while the assessed need ran to tens of billions. Anticipatory-action financing existed at pilot scale against a national-scale event, and floodplain settlement and drainage neglect turned rainfall into inundation that lasted into 2023.',
    inquiry:
      'The Government of Pakistan’s Post-Disaster Needs Assessment, prepared with the Asian Development Bank, the European Union, UNDP and the World Bank in October 2022, put damages at about $14.9 billion, economic losses at about $15.2 billion and reconstruction needs at over $16 billion. World Weather Attribution found climate change had likely intensified the rainfall, while identifying vulnerability — infrastructure, proximity, poverty — as the dominant driver of the impact.',
    sources: [
      'Government of Pakistan with ADB, EU, UNDP and the World Bank, “Pakistan Floods 2022: Post-Disaster Needs Assessment” (2022)',
      'World Weather Attribution, “Climate change likely increased extreme monsoon rainfall, flooding highly vulnerable communities in Pakistan” (2022)',
      'UN OCHA, Pakistan Floods Response Plan and revision (2022)',
    ],
    families: ['climate', 'earth'],
    titleMatch: /flood|deluge|monsoon|rain/i,
  },
  {
    id: 'turkiye-2023',
    title: 'Türkiye–Syria earthquakes',
    pin: 'Türkiye–Syria quakes',
    year: 2023,
    place: 'Kahramanmaraş, eleven Turkish provinces, and north-west Syria',
    lat: 37.29,
    lon: 37.04,
    hazard: 'earthquake',
    toll: '53,500+ dead in Türkiye and 8,000+ in Syria',
    happened:
      'A magnitude 7.8 rupture at 04:17 on 6 February 2023, followed nine hours later by a 7.5 on a neighbouring fault. Tens of thousands of buildings collapsed, many of them pancaking floor onto floor in the manner of unconfined concrete frames.',
    worked:
      'Turkish search and rescue and a civilian mobilisation of extraordinary scale; the AHBAP network and ordinary convoys reached towns before the state did. International teams arrived in volume within seventy-two hours.',
    failed:
      'Türkiye has had a modern seismic code since 1998 and a stricter one since 2018. It also had repeated construction amnesties — most recently in 2018 — that legalised, for a fee, millions of buildings that did not comply. Military deployment lagged the first day. In north-west Syria, cross-border aid was funnelled through a single authorised crossing and effectively stopped for the first week.',
    inquiry:
      'The Grand National Assembly of Türkiye established a parliamentary investigation committee, which reported in 2023 on building-stock non-compliance and on the coordination of the first seventy-two hours. The Chamber of Civil Engineers of the Union of Chambers of Turkish Engineers and Architects (TMMOB) attributed the scale of the collapse to unenforced codes and to the amnesty regime; prosecutors detained more than two hundred contractors, developers and officials. The finding, in short: the earthquake was natural and the collapse was policy.',
    sources: [
      'Grand National Assembly of Türkiye, parliamentary investigation committee report on the 6 February 2023 earthquakes (2023)',
      'TMMOB Chamber of Civil Engineers, earthquake damage assessment reports (2023)',
      'UN OCHA, Türkiye and Syria Earthquake Flash Appeals and situation reports (2023)',
    ],
    families: ['earth', 'wreckage'],
    titleMatch: /earthquake|quake|aftershock|tremor/i,
  },
  {
    id: 'derna-2023',
    title: 'Derna dam collapse (Storm Daniel)',
    pin: 'Derna dams',
    year: 2023,
    place: 'Derna, eastern Libya',
    lat: 32.77,
    lon: 22.64,
    hazard: 'flood',
    toll: 'Over 4,300 bodies recovered and thousands more missing; totals from 5,900 to 11,300 have been published and remain contested',
    happened:
      'Storm Daniel crossed the Mediterranean and stalled over the Jebel Akhdar on 10–11 September 2023. The Abu Mansour and Al-Bilad dams above Derna failed in sequence in the night, and the resulting wall of water carried entire city blocks into the sea.',
    worked:
      'Very little. Libya’s National Meteorological Centre did issue warnings, days ahead, and passed them to the authorities.',
    failed:
      'The dams had not been properly maintained since 2002, and a 2022 paper by a hydrologist at Omar Al-Mukhtar University in Derna had warned in print that they would fail catastrophically in a large flood. The warnings that reached residents were contradictory — a curfew told people to stay indoors, in the houses the water took. A decade of rival administrations had left no single authority responsible for the structures.',
    inquiry:
      'Libya’s Attorney-General opened a criminal investigation and ordered the detention of officials from the Derna municipality and the water resources authority; eight were charged over dam maintenance and the failure to evacuate. The World Meteorological Organization’s Secretary-General stated publicly that with a functioning warning and emergency management chain, most of the casualties could have been avoided.',
    sources: [
      'Office of the Attorney-General of Libya, statements on the Derna dam investigation (2023)',
      'World Meteorological Organization, statements and briefings on Storm Daniel and the Derna floods (September 2023)',
      'UN OCHA, Libya Flood Flash Appeal and situation reports (2023)',
    ],
    families: ['wreckage', 'earth'],
    titleMatch: /dam|flood|deluge/i,
  },
  {
    id: 'valencia-2024',
    title: 'Valencia flash floods (DANA)',
    pin: 'Valencia floods',
    year: 2024,
    place: 'Paiporta, Catarroja and the Horta Sud, Valencian Community, Spain',
    lat: 39.42,
    lon: -0.42,
    hazard: 'flood',
    toll: '≈230 dead, the great majority in the Valencian Community',
    happened:
      'An isolated upper-level depression dropped close to a year of rain on parts of the Valencian hinterland on 29 October 2024. The Poyo ravine, dry for most of the year, carried a torrent through towns at the evening rush hour; most of the dead were caught in cars and ground-floor garages.',
    worked:
      'The forecast, again. AEMET raised its red warning at 07:31 that morning, and had signalled the risk the day before. The meteorological chain did its job.',
    failed:
      'The alert. The regional government sent the ES-Alert mass message to mobile phones at 20:11, by which time the ravine had been in flood for hours and many of the victims were already dead. Gauge telemetry on the Poyo went dark during the critical window, and the regional emergency coordination meeting convened late.',
    inquiry:
      'The investigating court No. 3 of Catarroja opened a criminal case into the delay, naming the regional councillor for justice and interior, Salomé Pradas, and her deputy Emilio Argüeso, on suspicion of homicide and injury by gross negligence over the timing of the alert; the case has proceeded through 2025. The Corts Valencianes and the Spanish Congress both opened inquiry committees. The finding taking shape is not that the flood was unforeseen, but that the ninety minutes between knowledge and message were fatal.',
    sources: [
      'Juzgado de Instrucción n.º 3 de Catarroja, proceedings on the DANA of 29 October 2024 (2024–2025)',
      'Agencia Estatal de Meteorología (AEMET), warning chronology for the DANA of 29 October 2024',
      'Confederación Hidrográfica del Júcar, hydrological data and reporting on the Barranco del Poyo (2024)',
    ],
    families: ['earth', 'climate'],
    titleMatch: /flood|flash|deluge|rain/i,
  },
  {
    id: 'la-fires-2025',
    title: 'Palisades and Eaton fires',
    pin: 'Los Angeles fires',
    year: 2025,
    place: 'Pacific Palisades and Altadena, Los Angeles County, United States',
    lat: 34.15,
    lon: -118.29,
    hazard: 'wildfire',
    toll: '30+ dead; ~16,000 structures destroyed; insured losses in the tens of billions of dollars',
    happened:
      'Two wind-driven fires ignited on 7 January 2025 during a Santa Ana event with gusts near a hundred miles an hour, after an exceptionally dry start to the wet season. The Palisades and Eaton fires became the two most destructive fires in Los Angeles County history within a day.',
    worked:
      'The weather service had issued its most severe fire-weather language days ahead and named the danger in unusually blunt terms. Roughly 200,000 people were ordered out, and the great majority got out.',
    failed:
      'Not everyone was told in time. In west Altadena, evacuation orders did not go out until the small hours of 8 January, after the fire was already in the neighbourhood — and almost all of the Eaton fire deaths were in that area. There were no sirens. Hydrants lost pressure as demand outran the local system, and utility equipment is under investigation as an ignition source.',
    inquiry:
      'Los Angeles County commissioned an independent after-action review from the McChrystal Group, whose 2025 report found that alerts to west Altadena were issued hours after those to the east and identified failures in the county’s alert and warning process. State and utility-regulator investigations into the ignition of the Eaton fire continue. This is also the event behind the arithmetic further down this page: the insured losses here are of the same order as a full year of global humanitarian appeals.',
    sources: [
      'County of Los Angeles / McChrystal Group, after-action review of the January 2025 windstorm and wildfires (2025)',
      'CAL FIRE, Palisades and Eaton fire incident records (2025)',
      'California Public Utilities Commission and California Department of Insurance, filings and loss estimates on the January 2025 fires',
    ],
    families: ['climate', 'earth', 'wreckage'],
    titleMatch: /fire|inferno|blaze|burning|towering/i,
  },
  {
    id: 'myanmar-2025',
    title: 'Myanmar earthquake',
    pin: 'Myanmar quake',
    year: 2025,
    place: 'Sagaing, Mandalay and Naypyidaw, Myanmar',
    lat: 21.98,
    lon: 96.08,
    hazard: 'earthquake',
    toll: 'Official figures of about 3,800 dead; independent estimates are higher and verification is obstructed',
    happened:
      'A magnitude 7.7 strike-slip rupture along the Sagaing Fault on 28 March 2025, shallow and running for hundreds of kilometres beside the country’s second city. It struck a state already four years into a civil war, with millions displaced before the ground moved.',
    worked:
      'Regional response was fast: Chinese, Indian and ASEAN teams were on the ground within days. Local civil society, community networks and administrations outside government control did most of the immediate rescue, as they had been doing for the war.',
    failed:
      'The military authorities continued airstrikes in earthquake-affected areas during the response period, restricted access for international responders and maintained communications blackouts. The disaster also landed in the same quarter as the dismantling of USAID: the American response, historically the largest single bilateral surge capacity in the world, amounted to a three-person assessment team.',
    inquiry:
      'There is no independent national inquiry, and that is itself the finding. The UN Office of the High Commissioner for Human Rights documented continued military attacks in quake-affected areas after the event; the Special Rapporteur on the situation of human rights in Myanmar called for a halt to hostilities and for unimpeded humanitarian access. The record here is composed of UN statements and OCHA reporting rather than of any commission with subpoena power.',
    sources: [
      'UN Office of the High Commissioner for Human Rights, statements on attacks in earthquake-affected areas of Myanmar (2025)',
      'UN Special Rapporteur on the situation of human rights in Myanmar, statements following the 28 March 2025 earthquake',
      'UN OCHA, Myanmar Earthquake Response situation reports and addendum to the Humanitarian Needs and Response Plan (2025)',
    ],
    families: ['earth'],
    titleMatch: /earthquake|quake|aftershock/i,
  },
];

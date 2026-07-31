// The genre map this project started from, before the shipped taxonomy in
// scripts/taxonomy.mjs consolidated it down to eleven families for a chart
// that can only hold so many legible colours. Transcribed from the project's
// original planning notes (two mind maps — disaster types, and themes &
// elements — plus the GPT classification prompts and a second thematic
// cross-map, further down this file) — kept here as a record of the fuller
// framework, not as claims about what's tagged per-film in the shipped
// dataset.

export interface DisasterBranch {
  label: string;
  sub?: { label: string; items: string[] }[];
  items?: string[];
  /** Which shipped family (or families) absorbed this branch, and why. */
  shipped: string;
}

export const DISASTER_TAXONOMY: DisasterBranch[] = [
  {
    label: 'Natural',
    sub: [
      { label: 'Geological', items: ['Earthquakes', 'Volcanoes', 'Tsunamis', 'Sinkholes', 'Landslides', 'Continental Drift', 'Polar Shift', 'Magnetic Field Reversal'] },
      { label: 'Meteorological', items: ['Hurricanes/Typhoons', 'Tornadoes', 'Blizzards/Ice Storms', 'Extreme Heat Waves', 'Floods', 'Wildfires'] },
      { label: 'Cosmic', items: ['Asteroid/Comet Impacts', 'Solar Flares', 'Gamma-Ray Bursts', 'Black Hole Threats', 'Space Station/Colony Disasters', 'Wormhole/Dimensional Rifts'] },
      { label: 'Environmental', items: ['Climate Change', 'Pollution', 'Deforestation', 'Ocean Acidification', 'Ozone Depletion'] },
      { label: 'Biological', items: ['Pandemics/Epidemics', 'Invasive Species', 'Crop Failures/Famine', 'Genetic Engineering Gone Wrong', 'Ecosystem Collapse'] },
    ],
    shipped: 'Earth & Weather · Cosmic · Climate · Plague',
  },
  {
    label: 'Man-Made',
    sub: [
      { label: 'Technological', items: ['Nuclear Accidents', 'Chemical Spills', 'AI Takeover', 'Cybersecurity Breaches', 'Infrastructure Failure'] },
      { label: 'Societal', items: ['Urban Fires', 'Social Unrest/Anarchy', 'Economic Collapse', 'Terrorism', 'War/Nuclear War'] },
    ],
    shipped: 'Wreckage · Atomic · Machines',
  },
  {
    label: 'Supernatural',
    items: ['Divine Judgment', 'Demonic/Ghostly Manifestations', 'Zombie/Kaiju Attacks', 'Monster/Kaiju Invasions', 'Alien Invasions'],
    shipped: 'The Undead · Invaders · Divine',
  },
  {
    label: 'Mythological / Legendary',
    items: ['Prophesied Apocalypse', 'Curse Fulfillment', 'Awakening of Ancient Deities'],
    shipped: 'Divine',
  },
  {
    label: 'Post-Apocalyptic',
    items: ['Nuclear Aftermath', 'Pandemic Aftermath', 'Environmental Collapse Aftermath', 'Technological Breakdown Aftermath', 'Alien Invasion Aftermath', 'Supernatural Event Aftermath'],
    shipped: 'The stated cause, when the source names one (an atomic-aftermath film is Atomic, not After the Fall) — otherwise After the Fall',
  },
  {
    label: 'Dystopian',
    items: ['Totalitarian Regimes', 'Resource Scarcity Control', 'Social Division', 'Environmental Degradation', 'Genetic Engineering Society'],
    shipped: 'After the Fall',
  },
  {
    label: 'Slow-Burn',
    items: ['Overpopulation', 'Resource Depletion', 'Gradual Societal Collapse'],
    shipped: 'After the Fall · Climate',
  },
  {
    label: 'Hybrid',
    items: ['Combination of Multiple Disaster Types'],
    shipped: 'Filed under whichever single cause is most specific — see "How the categories were made" below',
  },
  {
    label: 'Temporal',
    items: ['Alternate Timeline Collapses', 'Temporal Paradoxes', 'Time Loops'],
    shipped: 'After the Fall',
  },
];

export interface ThemeBranch {
  label: string;
  items?: string[];
  group?: { label: string; items: string[] }[];
  /** Honest note on whether/how this branch shows up in the shipped data. */
  status: string;
}

export const THEMES: ThemeBranch[] = [
  {
    label: 'Tones',
    items: ['Somber/Serious', 'Action-Packed', 'Hopeful', 'Cynical/Nihilistic', 'Satirical/Humorous', 'Contemplative', 'Suspenseful/Thrilling'],
    status: 'Not tagged per film — TMDB doesn’t carry a tone field, and hand-tagging 831 films by tone wasn’t attempted.',
  },
  {
    label: 'Central Themes',
    group: [
      { label: 'Human Nature', items: ['Resilience and Adaptability', 'Selfishness vs. Altruism', 'Moral Decay vs. Ethical Growth', 'Leadership and Responsibility'] },
      { label: 'Survival', items: ['Resource Management', 'Skill Acquisition', 'Group Dynamics', 'Decision Making Under Pressure'] },
      { label: 'Social Commentary', items: ['Class Divide', 'Government Response and Competence', 'Media Influence', 'Environmental Stewardship'] },
      { label: 'Scientific and Technological', items: ['Consequences of Scientific Advancement', 'Relationship Between Humans and Technology', 'Ethical Dilemmas in Science', 'Importance of Scientific Literacy'] },
      { label: 'Philosophical and Existential', items: ['Meaning of Life in Face of Destruction', 'Human Purpose and Legacy', 'Faith and Spirituality in Crisis', 'Confronting Mortality'] },
      { label: 'Interpersonal Relationships', items: ['Family Bonds', 'Forming New Communities', 'Trust and Betrayal', 'Love and Loss'] },
      { label: 'Rebuilding and Recovery', items: ['Starting Anew', 'Preserving Knowledge and Culture', 'Redefining Society', 'Learning from Past Mistakes'] },
    ],
    status: 'The closest thing shipped is the plot-language breakdown on the main page — a word-level proxy for the Survival branch only, run against real plot summaries. The other six branches remain conceptual.',
  },
  {
    label: 'Character Arcs',
    items: ['Hero’s Journey', 'Redemption', 'Corruption', 'Sacrifice', 'Coming of Age', 'Transformation'],
    status: 'Not tracked — this would need a synopsis-reading pass the project hasn’t done.',
  },
  {
    label: 'Narrative Structure',
    items: ['Pre-Disaster Warning', 'During-Disaster Struggle', 'Post-Disaster Aftermath', 'Cyclical', 'Non-Linear'],
    status: 'Not tracked per film, though it’s close in spirit to the Post-Apocalyptic branch of the disaster taxonomy, which does inform classification.',
  },
  {
    label: 'Scale of Impact',
    items: ['Personal', 'Community', 'National', 'Global', 'Cosmic'],
    status: 'Not tracked as a field, though it overlaps with the Cosmic family and would be a reasonable future addition.',
  },
  {
    label: 'Lessons and Takeaways',
    items: ['Preparedness and Planning', 'Unity in Face of Adversity', 'Value of Scientific Understanding', 'Importance of Environmental Conservation', 'Critical Thinking and Skepticism', 'Appreciation for Life and Relationships', 'Resilience of Human Spirit', 'Dangers of Unchecked Power or Technology'],
    status: 'Conceptual only — read as the project’s working theory of what the genre is *for*, not a field in the data.',
  },
];

// The raw MasterMovies.json fields (DisasterType / MainCategory / Subcategory /
// SpecificDisasterTypes) came from feeding film lists to GPT across at least
// three separate classification prompts, rewritten as the project's thinking
// changed. None of the three schemes below is what ships today — a given raw
// record reflects whichever pass classified it, which is exactly the
// inconsistency scripts/taxonomy.mjs's three-tier regex matching exists to
// untangle. Condensed from the actual prompts; the full prompt text for each
// pass ran considerably longer.
export interface ClassificationPass {
  name: string;
  categories: string[];
  addedFields: string[];
  note: string;
}

export const CLASSIFICATION_PASSES: ClassificationPass[] = [
  {
    name: 'Pass one — "10 Types of Disasters"',
    categories: ['Natural', 'Environmental', 'Technological', 'Biological', 'Cosmic', 'Supernatural', 'Societal', 'Geopolitical', 'Economic', 'Psychological'],
    addedFields: [],
    note: 'Multi-category tagging was explicitly encouraged rather than forced into one bucket — the philosophy behind it held that categories should be scale-independent, that a stated cause should outrank a film’s setting, and that the system should stay "evolving and adaptable" as new films complicated it.',
  },
  {
    name: 'Pass two — simplified to six',
    categories: ['Natural', 'Environmental', 'Technological', 'Biological', 'Supernatural', 'Societal'],
    addedFields: ['Co-Main Category', 'Secondary category / subcategory', 'Timeline stage (pre-disaster, in crisis, aftermath, temporal flux)', 'Tone', 'Ending type (technological/social solution, unresolved, philosophical, individual vs. collective)'],
    note: 'A deliberate simplification from ten categories down to six, traded for a lot more depth per film — timeline stage, tone, and how (or whether) the disaster actually got resolved.',
  },
  {
    name: 'Pass three — back to ten, restructured',
    categories: ['Natural', 'Chemical', 'Environmental', 'Technological', 'Biological', 'Supernatural', 'Societal', 'Geopolitical', 'Psychological', 'Cosmic'],
    addedFields: ['Co-Primary Category', 'Secondary classifications (5 named subcategories per primary category)', 'Tone', 'Disaster Timeline Focus (Premonition & Prevention / Crisis & Survival / Aftermath & Adaptation / Temporal Flux)'],
    note: 'Chemical split out from Environmental and Economic dropped; each of the ten categories got a fixed list of five named subcategories, which is the closest of the three passes to what the shipped taxonomy eventually formalized.',
  },
];

// A second, distinct thematic framework — not the Tones/Central Themes map
// above, but a later pass cross-mapping ten narrative themes directly against
// the disaster-type categories from the classification prompts.
export interface ThemeCross {
  label: string;
  related: string;
  items: string[];
}

// The relationship diagram, spelled out: five stages between a Notion
// planning doc and eleven bars in a chart.
export const PIPELINE: { label: string; detail: string }[] = [
  { label: 'Two planning maps', detail: 'Disaster taxonomy + themes and elements, sketched before a film was logged.' },
  { label: 'Three GPT classification passes', detail: '10 categories, then 6, then 10 again — each pass rewriting the scheme the last one used.' },
  { label: 'Raw MasterMovies.json', detail: '105 free-text disaster types · 49 main categories · 191 subcategories, none of it reconciled between passes.' },
  { label: 'scripts/taxonomy.mjs', detail: 'A three-tier regex pass: unambiguous hazards, then specific signals, then generic labels as a last resort.' },
  { label: 'Eleven shipped families', detail: 'What actually renders in the live chart, the plot-language tally, and every decade breakdown on the main page.' },
];

export const THEME_CROSSMAP: ThemeCross[] = [
  { label: 'Survival and Resilience', related: 'Natural, Environmental, Cosmic', items: ['Human adaptability in extreme conditions', 'The will to survive against overwhelming odds', 'Community strength and cooperation'] },
  { label: 'Human vs. Nature', related: 'Natural, Environmental, Cosmic', items: ['Humanity’s struggle against uncontrollable forces', 'Environmental stewardship and consequences', 'Humility in the face of natural power'] },
  { label: 'Technological Ethics and Consequences', related: 'Technological, Environmental', items: ['The double-edged sword of scientific advancement', 'AI and automation: boon or bane?', 'Responsibility in innovation'] },
  { label: 'Biological Fragility and Adaptation', related: 'Biological, Environmental', items: ['Human vulnerability to microscopic threats', 'Ethical dilemmas in medicine and biotechnology', 'Evolution and mutation under extreme pressure'] },
  { label: 'Cosmic Perspective and Existential Questions', related: 'Cosmic, Supernatural', items: ['Humanity’s place in the universe', 'First contact and its implications', 'Confronting the unknown and incomprehensible'] },
  { label: 'Social Order and Chaos', related: 'Societal, Psychological', items: ['Breakdown and reformation of social structures', 'Leadership and governance in crisis', 'Mob mentality vs. individual responsibility'] },
  { label: 'Global Cooperation and Conflict', related: 'Geopolitical, Economic', items: ['International relations under extreme stress', 'Balancing national interests with global needs', 'Diplomacy and conflict in resource-scarce scenarios'] },
  { label: 'Economic Systems and Resource Management', related: 'Economic, Environmental', items: ['Capitalism and alternative systems in crisis', 'Wealth disparity and its consequences', 'Sustainable practices vs. short-term survival'] },
  { label: 'Psychological Resilience and Collective Behavior', related: 'Psychological, Societal', items: ['Mass hysteria and social contagion', 'Mental health in prolonged disaster scenarios', 'Group psychology and decision-making under pressure'] },
  { label: 'Faith, Spirituality, and the Unexplainable', related: 'Supernatural, Psychological', items: ['The role of belief systems in crisis', 'Confronting forces beyond scientific understanding', 'Moral and ethical challenges in inexplicable situations'] },
];

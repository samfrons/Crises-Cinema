// The genre map this project started from, before the shipped taxonomy in
// scripts/taxonomy.mjs consolidated it down to eleven families for a chart
// that can only hold so many legible colours. Transcribed from the project's
// original planning boards (two mind maps: disaster types, and themes &
// elements) — kept here verbatim as a record of the fuller framework, not as
// claims about what's tagged per-film in the shipped dataset.

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

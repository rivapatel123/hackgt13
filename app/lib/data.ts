// Shared frontend types, category metadata, and realistic placeholder data
// for the ResQ dashboard. Placeholder reports are generated with a
// seeded RNG so server and client renders match.

export type CategoryKey =
  | "medical"
  | "food_water"
  | "missing_person"
  | "shelter"
  | "safe"
  | "fire"
  | "flood"
  | "other";

export type Urgency = "high" | "medium" | "low";

export type Report = {
  id: string;
  transcript: string;
  category: CategoryKey;
  urgency: Urgency;
  description: string;
  raw_location_text: string | null;
  latitude: number | null;
  longitude: number | null;
  accuracy?: number | null; // GPS accuracy radius in metres
  gpsAddress?: string | null; // street address for the GPS fix
  language?: LangKey | null; // spoken language (auto-detected)
  transcriptEn?: string | null; // English translation when not spoken in English
  assignedAt?: string | null; // when a responder was assigned (responded)
  // AI confidence, 0–1 (null = not measured)
  transcriptionConfidence?: number | null;
  languageConfidence?: number | null;
  urgencyConfidence?: number | null;
  hazardConfidence?: number | null;
  hazardSource?: "ai" | "voice" | "caller" | "alert" | null;
  words?: { w: string; p: number }[] | null; // per-word transcription confidence
  created_at: string;
  hazard?: HazardKey | null;
  name?: string;
  people?: number;
  audioUrl?: string;
  sizeKb?: number;
  durationSec?: number;
  live?: boolean;
  classifiedOnDevice?: boolean;
  assignedTo?: string | null;
};

export const CATEGORIES: Record<
  CategoryKey,
  {
    label: string;
    short: string;
    color: string;
    darkColor: string;
    glyph: string;
  }
> = {
  medical: {
    label: "Medical help",
    short: "Medical",
    color: "#e34948",
    darkColor: "#e66767",
    glyph: "+",
  },
  food_water: {
    label: "Food & water",
    short: "Food/Water",
    color: "#2a78d6",
    darkColor: "#3987e5",
    glyph: "W",
  },
  missing_person: {
    label: "Missing person",
    short: "Missing",
    color: "#eda100",
    darkColor: "#c98500",
    glyph: "?",
  },
  shelter: {
    label: "Shelter",
    short: "Shelter",
    color: "#4a3aa7",
    darkColor: "#9085e9",
    glyph: "S",
  },
  safe: {
    label: "Marked safe",
    short: "Safe",
    color: "#1baf7a",
    darkColor: "#199e70",
    glyph: "✓",
  },
  fire: {
    label: "Fire",
    short: "Fire",
    color: "#eb6834",
    darkColor: "#d95926",
    glyph: "F",
  },
  flood: {
    label: "Flooding / rescue",
    short: "Flood",
    color: "#e87ba4",
    darkColor: "#d55181",
    glyph: "~",
  },
  other: {
    label: "Other",
    short: "Other",
    color: "#6b6a66",
    darkColor: "#9a9993",
    glyph: "•",
  },
};

export const PRIMARY_CATEGORIES: CategoryKey[] = [
  "medical",
  "food_water",
  "missing_person",
  "shelter",
  "safe",
];

export function normalizeCategory(value: unknown): CategoryKey {
  const v = String(value ?? "")
    .toLowerCase()
    .replace(/[\s/&-]+/g, "_");
  if (v in CATEGORIES) return v as CategoryKey;
  if (v.includes("food") || v.includes("water")) return "food_water";
  if (v.includes("missing")) return "missing_person";
  if (v.includes("medic")) return "medical";
  if (v.includes("shelter")) return "shelter";
  if (v.includes("safe")) return "safe";
  return "other";
}

export function normalizeUrgency(value: unknown): Urgency {
  const v = String(value ?? "").toLowerCase();
  return v === "high" || v === "low" ? v : "medium";
}

export const HAZARDS = [
  { key: "hurricane", label: "Hurricane", emoji: "🌀" },
  { key: "flood", label: "Flood", emoji: "🌊" },
  { key: "tornado", label: "Tornado", emoji: "🌪️" },
  { key: "earthquake", label: "Earthquake", emoji: "🏚️" },
  { key: "wildfire", label: "Wildfire", emoji: "🔥" },
  { key: "tsunami", label: "Tsunami", emoji: "🌊" },
  { key: "volcano", label: "Volcano", emoji: "🌋" },
] as const;

export type HazardKey = (typeof HAZARDS)[number]["key"];

// Phrases that point to each disaster type, with a weight for how strongly
// they imply it (e.g. "lava" is unambiguous, "water" is only a hint).
const HAZARD_CUES: Record<HazardKey, [RegExp, number, string][]> = {
  hurricane: [
    [/\bhurricanes?\b/, 5, "hurricane"],
    [/\bstorm surge\b/, 4, "storm surge"],
    [/\b(tropical storm|category \d|cat \d)\b/, 4, "category storm"],
    [/\b(wind|winds|windy)\b/, 2, "wind"],
    [
      /\broof\b.*\b(off|gone|blew|torn|ripped)\b|\b(blew|torn|ripped) (off )?(the |our )?roof\b/,
      3,
      "roof blown off",
    ],
    [/\bstorm\b/, 2, "storm"],
    [/\bpower (is )?(out|lines? down)\b/, 1, "power out"],
  ],
  flood: [
    [/\bflood(ing|ed|s)?\b/, 5, "flooding"],
    [
      /\b(water|waters) (is |are )?(rising|coming in|up to|everywhere)\b|\brising water\b/,
      4,
      "rising water",
    ],
    [/\bunder ?water\b/, 3, "underwater"],
    [/\b(boat|kayak|raft)\b/, 2, "boat"],
    [
      /\b(attic|roof)\b.*\bwater\b|\bwater\b.*\b(attic|waist|chest|knee|windows?)\b/,
      3,
      "high water",
    ],
    [/\bdrown/, 3, "drowning"],
  ],
  tornado: [
    [/\btornado(es)?\b|\btwister\b/, 6, "tornado"],
    [/\bfunnel( cloud)?\b/, 4, "funnel cloud"],
    [/\b(siren|sirens)\b/, 1, "sirens"],
    [/\b(sounded like|like) a (freight )?train\b/, 3, "sounded like a train"],
    [/\bdebris\b/, 1, "debris"],
  ],
  earthquake: [
    [/\bearth ?quakes?\b|\bquake\b/, 6, "earthquake"],
    [/\b(shaking|shook|tremor|aftershocks?)\b/, 4, "shaking"],
    [/\b(collapsed|collapse|rubble|caved in|pancaked)\b/, 3, "collapse"],
    [
      /\b(crack|cracks|cracked)\b.*\b(wall|ground|building|floor)\b/,
      2,
      "cracks",
    ],
  ],
  wildfire: [
    [/\bwild ?fires?\b|\bforest fire\b|\bbrush fire\b/, 6, "wildfire"],
    [/\b(fire|fires|flames|burning|on fire)\b/, 3, "fire"],
    [/\bsmoke\b/, 3, "smoke"],
    [/\b(embers|ash falling|can'?t breathe.*smoke)\b/, 2, "embers"],
  ],
  tsunami: [
    [/\btsunamis?\b/, 6, "tsunami"],
    [/\b(huge|giant|big) waves?\b|\bwave (came|hit)\b/, 4, "huge wave"],
    [/\b(ocean|sea) (came|is coming|pulled back|went out)\b/, 4, "sea surge"],
  ],
  volcano: [
    [/\bvolcan(o|oes|ic)\b/, 6, "volcano"],
    [/\b(lava|magma)\b/, 6, "lava"],
    [/\berupt(ion|ing|ed)?\b/, 5, "eruption"],
    [/\bash\b/, 2, "ash"],
  ],
};

/**
 * Guess which disaster the caller is describing from their words.
 * Returns null until there's enough signal (score >= 3) to be useful.
 */
// Same idea for French, Spanish and Mandarin (no \b: it doesn't work with
// accented letters or Chinese characters). The cue shown is the word heard.
const HAZARD_CUES_INTL: Record<HazardKey, [RegExp, number][]> = {
  hurricane: [
    [/ouragan|huracán|huracan|飓风|台风/, 5],
    [/tempête|tormenta|暴风|风暴/, 2],
    [/vents? violents?|viento|大风/, 2],
  ],
  flood: [
    [/inondation|inondé|inundación|inundado|洪水|淹/, 5],
    [/l['’]eau monte|el agua (está )?subiendo|el agua sube|水位|涨水|上涨/, 4],
    [/bateau|bote|lancha|船/, 2],
  ],
  tornado: [[/tornade|龙卷风/, 6]],
  earthquake: [
    [/tremblement de terre|séisme|terremoto|sismo|地震/, 6],
    [/secousse|ça tremble|temblor|tiembla|摇晃|晃动/, 4],
    [/effondr|derrumb|倒塌|塌了/, 3],
  ],
  wildfire: [
    [/incendie|incendio|山火|火灾|着火/, 5],
    [/fumée|humo|浓烟|冒烟/, 3],
    [/flammes|llamas|\bfeu\b|fuego/, 2],
  ],
  tsunami: [
    [/raz-de-marée|maremoto|海啸/, 6],
    [/vague géante|ola gigante|巨浪/, 4],
  ],
  volcano: [
    [/volcan|volcán|火山/, 6],
    [/\blave\b|岩浆/, 6],
    [/éruption|erupción|喷发/, 5],
    [/cendres|ceniza|火山灰/, 2],
  ],
};

// Evidence mass reserved for "none of these / something else", so a single
// weak cue can't produce a confident answer.
const HAZARD_PRIOR = 3;

/**
 * Guess the disaster from the caller's words.
 * confidence = winning evidence ÷ (all evidence + prior): high when one
 * disaster clearly dominates, low when cues are weak or point several ways.
 */
export function detectHazard(text: string): {
  key: HazardKey;
  score: number;
  confidence: number;
  cues: string[];
} | null {
  const t = ` ${text.toLowerCase()} `;
  let best: { key: HazardKey; score: number; cues: string[] } | null = null;
  let total = 0;
  for (const key of Object.keys(HAZARD_CUES) as HazardKey[]) {
    let score = 0;
    const cues: string[] = [];
    for (const [re, weight, cue] of HAZARD_CUES[key]) {
      if (re.test(t)) {
        score += weight;
        cues.push(cue);
      }
    }
    for (const [re, weight] of HAZARD_CUES_INTL[key]) {
      const m = t.match(re);
      if (m) {
        score += weight;
        if (!cues.includes(m[0])) cues.push(m[0]);
      }
    }
    total += score;
    if (score > (best?.score ?? 0)) best = { key, score, cues };
  }
  return best && best.score >= 3
    ? { ...best, confidence: best.score / (total + HAZARD_PRIOR) }
    : null;
}

export function isHazardKey(v: unknown): v is HazardKey {
  return HAZARDS.some((h) => h.key === v);
}

// Demo scenario neighbourhoods (Tampa Bay) used to place placeholder reports.
export const NEIGHBORHOODS = [
  { name: "Downtown Tampa", lat: 27.95, lng: -82.46 },
  { name: "Seminole Heights", lat: 28.0, lng: -82.46 },
  { name: "Town 'n' Country", lat: 28.01, lng: -82.58 },
  { name: "Brandon", lat: 27.94, lng: -82.29 },
  { name: "Riverview", lat: 27.87, lng: -82.33 },
  { name: "Apollo Beach", lat: 27.77, lng: -82.4 },
  { name: "Ruskin", lat: 27.72, lng: -82.43 },
  { name: "Clearwater", lat: 27.97, lng: -82.8 },
  { name: "Largo", lat: 27.91, lng: -82.79 },
  { name: "Pinellas Park", lat: 27.84, lng: -82.7 },
  { name: "St. Petersburg", lat: 27.77, lng: -82.64 },
  { name: "Gulfport", lat: 27.75, lng: -82.7 },
];

const STREETS = [
  "Bayshore Blvd",
  "Dale Mabry Hwy",
  "Nebraska Ave",
  "Gandy Blvd",
  "4th St N",
  "Central Ave",
  "Ulmerton Rd",
  "Bloomingdale Ave",
  "Big Bend Rd",
  "Florida Ave",
  "Hillsborough Ave",
  "Park Blvd",
  "Gulf Blvd",
  "Kennedy Blvd",
  "Fowler Ave",
];

const NAMES = [
  "Maria D.",
  "James O.",
  "Priya S.",
  "Luis R.",
  "Keisha W.",
  "Tom B.",
  "Ana G.",
  "Devon H.",
  "Mei L.",
  "Carlos M.",
  "Grace N.",
  "Samuel K.",
  "Rosa V.",
  "Ethan P.",
  "Fatima A.",
  "Robert J.",
  "Linh T.",
  "Diego F.",
  "Hannah C.",
  "Marcus L.",
];

const TEMPLATES: Record<CategoryKey, { t: string; u: Urgency; d: string }[]> = {
  medical: [
    {
      t: "This is {name}, I'm at {addr}. My husband fell and I think his leg is broken, he can't walk and the water is rising.",
      u: "high",
      d: "Possible fractured leg, non-ambulatory, rising water",
    },
    {
      t: "{name} here, {addr}, second floor. I'm diabetic and I'm out of insulin since yesterday. Feeling dizzy.",
      u: "high",
      d: "Insulin-dependent diabetic, no insulin for 24h",
    },
    {
      t: "My name is {name}. I'm at {addr} with my mother, she's on oxygen and the power's been out 10 hours. Tank is almost empty.",
      u: "high",
      d: "Oxygen-dependent patient, tank nearly empty, no power",
    },
    {
      t: "It's {name} near {addr}. Neighbor cut his arm badly clearing glass, we stopped most of the bleeding but he needs stitches.",
      u: "medium",
      d: "Deep laceration, bleeding controlled",
    },
    {
      t: "{name}, {addr}. I'm 34 weeks pregnant and having contractions. Roads are flooded, can't drive.",
      u: "high",
      d: "Pregnant, 34 weeks, active contractions",
    },
  ],
  food_water: [
    {
      t: "Hi, {name} at {addr}. Five of us here including two kids. We ran out of drinking water this morning.",
      u: "medium",
      d: "5 people incl. 2 children, no drinking water",
    },
    {
      t: "{name} here, {addr}. We have food for maybe one more day and need baby formula for a 3 month old.",
      u: "medium",
      d: "Needs infant formula, ~1 day of food left",
    },
    {
      t: "This is {name} at the apartments on {addr}. About 20 residents, elderly mostly, no water pressure since the storm.",
      u: "medium",
      d: "~20 elderly residents without water",
    },
    {
      t: "{name}, {addr}. Just need water and some canned food, nobody is hurt.",
      u: "low",
      d: "Water and non-perishables, no injuries",
    },
  ],
  missing_person: [
    {
      t: "My name is {name}. I can't find my father, he's 78 with dementia, last seen near {addr} before the surge.",
      u: "high",
      d: "78-year-old with dementia missing since surge",
    },
    {
      t: "{name} here. My son is 15, he went to check on his friend on {addr} and hasn't come back. Wearing a red hoodie.",
      u: "high",
      d: "15-year-old missing, red hoodie",
    },
    {
      t: "It's {name}. Haven't heard from my neighbor Mrs. Alvarez at {addr} since Tuesday. She lives alone.",
      u: "medium",
      d: "Elderly neighbor unreachable since Tuesday",
    },
  ],
  shelter: [
    {
      t: "{name} at {addr}. Our roof came off in the night, we are three adults and a dog, need somewhere dry to go.",
      u: "medium",
      d: "Roof lost, 3 adults + dog need shelter",
    },
    {
      t: "This is {name}, {addr}. House has two feet of water inside. We're on the kitchen counter. Need to get out.",
      u: "high",
      d: "Floodwater inside home, occupants stranded",
    },
    {
      t: "{name}, near {addr}. Tree through the bedroom wall, we're okay but can't stay here tonight.",
      u: "low",
      d: "Structural damage, need overnight shelter",
    },
  ],
  safe: [
    {
      t: "This is {name} at {addr}. Just letting family know we're safe. No damage, all four of us okay.",
      u: "low",
      d: "Household of 4 safe, no damage",
    },
    {
      t: "{name} here, {addr}. We rode it out, we're fine. Power's out but we have supplies.",
      u: "low",
      d: "Safe, has supplies, no power",
    },
    {
      t: "It's {name}. I'm safe at the shelter off {addr}. Tell my sister I'm okay.",
      u: "low",
      d: "Safe at public shelter",
    },
  ],
  fire: [
    {
      t: "{name}, {addr}. Transformer blew and there's a fire spreading to the house next door!",
      u: "high",
      d: "Electrical fire spreading to adjacent structure",
    },
  ],
  flood: [
    {
      t: "{name} at {addr}. Water is up to the windows, we're in the attic with a hammer. Please send a boat.",
      u: "high",
      d: "Trapped in attic, water at window height",
    },
    {
      t: "This is {name}, {addr}. Car stalled in floodwater, water coming in, two of us inside.",
      u: "high",
      d: "Vehicle stalled in floodwater, 2 occupants",
    },
  ],
  other: [
    {
      t: "{name} near {addr}. Power lines down across the road, blocking the only way out of our street.",
      u: "medium",
      d: "Downed power lines blocking evacuation route",
    },
  ],
};

const WEIGHTS: [CategoryKey, number][] = [
  ["medical", 16],
  ["food_water", 18],
  ["missing_person", 7],
  ["shelter", 12],
  ["safe", 17],
  ["flood", 7],
  ["fire", 2],
  ["other", 3],
];

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Fixed anchor so placeholder timestamps are stable across renders.
export const DEMO_NOW = Date.parse("2026-09-25T15:42:00-04:00");

function buildSeedReports(): Report[] {
  const rand = mulberry32(1337);
  const extra = mulberry32(2024);
  const pick = <T>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)];
  const total = WEIGHTS.reduce((s, [, w]) => s + w, 0);
  const out: Report[] = [];

  for (let i = 0; i < 82; i++) {
    let r = rand() * total;
    let cat: CategoryKey = "other";
    for (const [k, w] of WEIGHTS) {
      if ((r -= w) <= 0) {
        cat = k;
        break;
      }
    }
    const tpl = pick(TEMPLATES[cat]);
    const hood = pick(NEIGHBORHOODS);
    const name = pick(NAMES);
    const addr = `${100 + Math.floor(rand() * 9800)} ${pick(STREETS)}, ${hood.name}`;
    const minutesAgo = Math.floor(rand() * rand() * 900) + 1;
    const transcript = tpl.t.replace("{name}", name).replace("{addr}", addr);
    // Extra randomness from a second generator so the layout above is unchanged.
    const respondMin = 2 + Math.round(extra() * 22);
    const transcriptionConfidence = 0.7 + extra() * 0.27;
    const u = scoreUrgency(transcript, cat);
    const hz = detectHazard(transcript);
    const assigned = rand() > 0.55;
    out.push({
      id: `seed-${i}`,
      transcript,
      category: cat,
      // Filed the same way live messages are: by the urgency model.
      urgency: u.urgency,
      description: tpl.d,
      raw_location_text: addr,
      latitude: hood.lat + (rand() - 0.5) * 0.06,
      longitude: hood.lng + (rand() - 0.5) * 0.07,
      created_at: new Date(DEMO_NOW - minutesAgo * 60_000).toISOString(),
      // Disaster: from the words if they say it, else the area-wide alert.
      hazard: hz?.key ?? "hurricane",
      hazardConfidence: hz?.confidence ?? null,
      hazardSource: hz ? "ai" : "alert",
      transcriptionConfidence,
      urgencyConfidence: u.confidence,
      name,
      people: 1 + Math.floor(rand() * 5),
      sizeKb: Math.round((7 + rand() * 11) * 10) / 10,
      durationSec: 9 + Math.floor(rand() * 20),
      ...(() => {
        const unit = assigned ? pick(RESPONDER_UNITS) : null;
        // Only "responded" if the response time has already passed.
        return unit && respondMin < minutesAgo
          ? {
              assignedTo: unit,
              assignedAt: new Date(
                DEMO_NOW - (minutesAgo - respondMin) * 60_000,
              ).toISOString(),
            }
          : { assignedTo: null, assignedAt: null };
      })(),
    });
  }
  return out.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export const RESPONDER_UNITS = [
  "Rescue Task Force 3",
  "Engine 12",
  "Water Rescue 7",
  "Medic 21",
  "Red Cross ERV 4",
  "National Guard Hi-Water 2",
];

// Headline numbers for the whole incident (the map shows a sample of them).
export const INCIDENT_STATS = {
  messagesReceived: 5184,
  pinned: 4927,
  avgSizeKb: 12,
  medianDispatchMin: 6.7,
  markedSafe: 1312,
  respondersActive: 214,
  rescuesCompleted: 638,
  unresolvedHigh: 97,
};

export const HOURLY_VOLUME = [
  38, 31, 27, 22, 19, 24, 41, 77, 126, 188, 241, 296, 342, 318, 287, 264, 251,
  238, 229, 214, 201, 187, 176, 173,
];

export const CATEGORY_TOTALS: {
  key: CategoryKey;
  count: number;
  medianMin: number;
}[] = [
  { key: "food_water", count: 1164, medianMin: 22 },
  { key: "safe", count: 1312, medianMin: 0 },
  { key: "medical", count: 1037, medianMin: 5.1 },
  { key: "shelter", count: 812, medianMin: 14 },
  { key: "flood", count: 431, medianMin: 4.2 },
  { key: "missing_person", count: 296, medianMin: 9.8 },
  { key: "other", count: 104, medianMin: 31 },
  { key: "fire", count: 28, medianMin: 3.6 },
];

export const NOTIFICATIONS = [
  {
    id: "n1",
    tone: "critical" as const,
    title: "Hurricane Warning — Category 4",
    body: "Hurricane Delphine landfall expected near Tampa Bay by 6:00 PM EDT. Storm surge 9–13 ft.",
    time: "12 min ago",
  },
  {
    id: "n2",
    tone: "info" as const,
    title: "Shelter open: Jefferson High School",
    body: "4401 W Cypress St — 340 beds available, pets allowed, medical staff on site.",
    time: "38 min ago",
  },
  {
    id: "n3",
    tone: "warning" as const,
    title: "Boil water notice",
    body: "Hillsborough County: boil tap water for 1 minute before drinking until further notice.",
    time: "1 hr ago",
  },
  {
    id: "n4",
    tone: "info" as const,
    title: "Satellite link restored",
    body: "Direct-to-Cell coverage active over Pinellas and Hillsborough counties.",
    time: "2 hr ago",
  },
];

export function timeAgo(iso: string, now = DEMO_NOW) {
  const mins = Math.max(0, Math.floor((now - Date.parse(iso)) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  return `${h}h ${mins % 60}m ago`;
}

// Keyword fallback used only when the backend is unreachable (e.g. offline
// demo). The real classification comes from Grok via /api/reports.
// Evidence for each urgency level (en / es / fr / zh), with weights.
const URGENCY_CUES: Record<Urgency, [RegExp, number][]> = {
  high: [
    [/\b(trapped|stuck)\b|atrapad|coincé|piégé|被困|困住/, 2],
    [/\bbleed\w*|sangr|saign|流血/, 2],
    [
      /can'?t breathe|not breathing|no (puede|puedo) respirar|ne (peut|peux) (pas )?respirer|不能呼吸|喘不过气/,
      3,
    ],
    [/\bunconscious|inconscien|昏迷/, 3],
    [/\b(dying|killed|dead)\b|muriendo|muerto|mourant|死/, 2],
    [/\b(rising|coming in)\b|subiendo|monte|上涨|涨水/, 1.5],
    [/\b(fire|smoke|flames)\b|fuego|humo|\bfeu\b|fumée|着火|火灾|烟/, 1.5],
    [
      /\b(hurry|right now|immediately|urgent|emergency)\b|urgente|rápido|\bvite\b|紧急|救命/,
      1,
    ],
    [
      /\b(pregnan\w*|contractions|heart attack|chest pain|insulin|oxygen)\b|embarazada|contracciones|insulina|oxígeno|enceinte|insuline|oxygène|怀孕|胰岛素|氧气/,
      1.5,
    ],
    [/\b(hurt|injur\w*|broken)\b|herid|blessé|受伤/, 1.5],
    [
      /\b(water inside|feet of water|water up to)\b|agua adentro|eau dans la maison|屋里进水/,
      2,
    ],
    [
      /\b(need to get out|get us out|can'?t get out|attic|kitchen counter|roof to escape)\b|no podemos salir|on ne peut pas sortir|出不去/,
      2,
    ],
    [
      /\b(dementia|alzheimer\w*|wheelchair|bedridden|newborn|infant)\b|demencia|démence|痴呆/,
      1.5,
    ],
  ],
  medium: [
    [/\b(need|needs|out of|ran out|running out)\b|necesit|besoin|需要/, 1],
    [
      /\b(water|food|formula|supplies|medicine)\b|\bagua\b|comida|de l'eau|nourriture|食物|喝水/,
      1,
    ],
    [
      /\b(roof|shelter|place to stay|damage\w*|no power|power('?s)? out)\b|techo|refugio|\btoit\b|屋顶|避难|停电/,
      1,
    ],
    [
      /\b(missing|can'?t find|haven'?t heard)\b|desaparecid|disparu|失踪|找不到/,
      1.5,
    ],
    [
      /\b(stitches|stopped (most of )?the bleeding|minor|not serious|stable)\b|puntos|points de suture/,
      2.5,
    ],
  ],
  low: [
    [
      /\b(safe|okay|fine|all good|no injuries|nobody('?s| is)? hurt|no one('?s| is)? hurt|no damage|rode it out)\b|a salvo|estamos bien|estoy bien|en sécurité|ça va|nous allons bien|安全|没事/,
      2.5,
    ],
    [/\b(just letting|let (my )?family know|checking in|checked in)\b/, 1.5],
  ],
};

// How much the request type alone suggests each urgency level.
const CATEGORY_URGENCY: Partial<
  Record<CategoryKey, Partial<Record<Urgency, number>>>
> = {
  medical: { high: 1.5 },
  flood: { high: 1.5 },
  fire: { high: 1.5 },
  missing_person: { high: 1.25, medium: 0.5 },
  food_water: { medium: 1.5 },
  shelter: { medium: 1.5 },
  safe: { low: 2.5 },
};

/**
 * Urgency with a probability for each level: evidence scores from cue words
 * + request type, turned into probabilities with a softmax. With no evidence
 * every level is 1/3, so the model is honestly unsure.
 */
export function scoreUrgency(text: string, category: CategoryKey) {
  const t = text.toLowerCase();
  const levels: Urgency[] = ["high", "medium", "low"];
  const score = Object.fromEntries(
    levels.map((u) => [
      u,
      URGENCY_CUES[u].reduce((s, [re, w]) => s + (re.test(t) ? w : 0), 0) +
        (CATEGORY_URGENCY[category]?.[u] ?? 0),
    ]),
  ) as Record<Urgency, number>;
  const T = 1.2; // temperature: >1 keeps the model from over-claiming
  const exp = levels.map((u) => Math.exp(score[u] / T));
  const sum = exp.reduce((a, b) => a + b, 0);
  const probs = Object.fromEntries(
    levels.map((u, i) => [u, exp[i] / sum]),
  ) as Record<Urgency, number>;
  const urgency = levels.reduce((a, b) => (probs[b] > probs[a] ? b : a));
  return { urgency, confidence: probs[urgency], probs };
}

export function classifyLocally(text: string): {
  category: CategoryKey;
  urgency: Urgency;
  urgencyConfidence: number;
} {
  const t = text.toLowerCase();
  const has = (...w: string[]) => w.some((x) => t.includes(x));
  let category: CategoryKey = "other";
  if (
    has(
      "hurt",
      "injur",
      "bleed",
      "broken",
      "insulin",
      "breath",
      "pain",
      "heart",
      "pregnan",
      "oxygen",
      "unconscious",
      "medic",
      // fr / es / zh
      "blessé",
      "saigne",
      "insuline",
      "respirer",
      "douleur",
      "enceinte",
      "oxygène",
      "inconscient",
      "médecin",
      "herido",
      "herida",
      "sangr",
      "insulina",
      "respirar",
      "dolor",
      "embarazada",
      "oxígeno",
      "inconsciente",
      "médico",
      "受伤",
      "流血",
      "胰岛素",
      "呼吸",
      "疼",
      "怀孕",
      "氧气",
      "昏迷",
      "医生",
    )
  )
    category = "medical";
  else if (
    has(
      "missing",
      "can't find",
      "cannot find",
      "lost my",
      "looking for",
      "haven't heard",
      "disparu",
      "je ne trouve pas",
      "desaparecid",
      "no encuentro",
      "失踪",
      "找不到",
      "走失",
    )
  )
    category = "missing_person";
  else if (
    has(
      "fire",
      "smoke",
      "burning",
      "fumée",
      "incendie",
      "humo",
      "fuego",
      "incendio",
      "着火",
      "火灾",
      "烟",
    )
  )
    category = "fire";
  else if (
    has(
      "trapped",
      "attic",
      "water is rising",
      "flooding",
      "stuck",
      "boat",
      "coincé",
      "piégé",
      "l'eau monte",
      "inond",
      "bateau",
      "atrapad",
      "el agua sube",
      "inund",
      "bote",
      "被困",
      "困住",
      "洪水",
      "淹",
      "船",
    )
  )
    category = "flood";
  else if (
    has(
      "water",
      "food",
      "hungry",
      "thirst",
      "formula",
      "supplies",
      "de l'eau",
      "nourriture",
      "faim",
      "soif",
      "agua",
      "comida",
      "hambre",
      "食物",
      "饿",
      "渴",
      "喝水",
      "奶粉",
    )
  )
    category = "food_water";
  else if (
    has(
      "roof",
      "shelter",
      "place to stay",
      "house is gone",
      "destroyed",
      "nowhere",
      "toit",
      "détruit",
      "refuge",
      "techo",
      "refugio",
      "albergue",
      "destruid",
      "屋顶",
      "避难",
      "房子",
    )
  )
    category = "shelter";
  else if (
    has(
      "safe",
      "okay",
      "we're fine",
      "we are fine",
      "i'm fine",
      "en sécurité",
      "nous allons bien",
      "a salvo",
      "estamos bien",
      "estoy bien",
      "安全",
      "没事",
    )
  )
    category = "safe";
  const u = scoreUrgency(text, category);
  return { category, urgency: u.urgency, urgencyConfidence: u.confidence };
}

// Where the demo civilian (Maria Delgado) is sheltering in the scenario.
export const DEMO_HOME = {
  lat: 27.9312,
  lng: -82.4818,
  accuracy: 9,
  label: "412 Bayshore Blvd, Apt 2B, Tampa",
};

// ---- Fallback text helpers (used when Grok isn't available) ----

const NEED_WORDS =
  /\b(need|help|hurt|injur\w*|bleed\w*|broken|trapped|stuck|rising|flood\w*|fire|smoke|missing|can'?t|insulin|oxygen|pregnan\w*|boat|water|food|shelter|roof|collapsed|safe|killed|dead|dying)\b/i;
const INTRO = /^(this is|my name|hi|hello|it'?s \w+ here)\b/i;

/** Pick the sentences that say what's wrong, for a short dispatcher title. */
export function summarize(transcript: string, max = 90): string {
  let sentences = transcript
    .split(/(?<=[.!?。！？])\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  // Run-on speech (common in translations): split into comma clauses instead.
  if (sentences.length === 1 && sentences[0].length > max)
    sentences = sentences[0]
      .split(/,\s+/)
      .map((c) => c.trim())
      .filter(Boolean);
  const useful = sentences.filter(
    (s) =>
      NEED_WORDS.test(s) &&
      !INTRO.test(s) &&
      !/^(i am|i'm) (at|in|on)\b/i.test(s),
  );
  let text = (useful.length ? useful : sentences).join(
    sentences.length && !/[.!?。！？]$/.test(sentences[0]) ? ", " : " ",
  );
  text = text.charAt(0).toUpperCase() + text.slice(1);
  if (text.length > max) {
    text = text.slice(0, max);
    text = `${text.slice(0, text.lastIndexOf(" ")).replace(/[,.;:]$/, "")}…`;
  }
  return text;
}

/** Find a spoken street address like "412 Bayshore Boulevard". */
export function extractAddress(transcript: string): string | null {
  const m = transcript.match(
    /\b\d{1,6}\s+(?:[A-Z][\w']*\s+){1,4}(?:Boulevard|Blvd|Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Way|Court|Ct|Highway|Hwy|Parkway|Pkwy|Place|Pl|Circle|Terrace)\b\.?/,
  );
  return m ? m[0].replace(/\.$/, "") : null;
}

// ---- Spoken languages (auto-detected) ----
export const LANGS = {
  en: { english: "English", native: "English", speech: "en-US" },
  fr: { english: "French", native: "Français", speech: "fr-FR" },
  zh: { english: "Mandarin", native: "中文 (普通话)", speech: "zh-CN" },
  es: { english: "Spanish", native: "Español", speech: "es-US" },
} as const;
export type LangKey = keyof typeof LANGS;
export const isLangKey = (v: unknown): v is LangKey =>
  typeof v === "string" && v in LANGS;

/** Best guess before anyone speaks: the device's own language, if supported. */
export function deviceLanguage(): LangKey {
  if (typeof navigator === "undefined") return "en";
  for (const l of navigator.languages ?? [navigator.language]) {
    const k = l.toLowerCase().slice(0, 2);
    if (isLangKey(k)) return k;
  }
  return "en";
}

// Built last: it uses the scoring functions and cue tables defined above.
export const SEED_REPORTS = buildSeedReports();

// ---- Time formatting for message / response timestamps ----
export function fmtClock(iso: string, withSeconds = false) {
  return new Date(iso).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    ...(withSeconds ? { second: "2-digit" } : {}),
  });
}

export function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
}

/** "6m 12s", "1h 04m", "45s" */
export function fmtDuration(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, "0")}s`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
}

/** Time from the message arriving to a responder being assigned. */
export function responseTime(r: { created_at: string; assignedAt?: string | null }) {
  return r.assignedAt ? Date.parse(r.assignedAt) - Date.parse(r.created_at) : null;
}

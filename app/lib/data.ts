// Shared frontend types, category metadata, and realistic placeholder data
// for the CallForHelp dashboard. Placeholder reports are generated with a
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
export function detectHazard(
  text: string,
): { key: HazardKey; score: number; cues: string[] } | null {
  const t = ` ${text.toLowerCase()} `;
  let best: { key: HazardKey; score: number; cues: string[] } | null = null;
  for (const key of Object.keys(HAZARD_CUES) as HazardKey[]) {
    let score = 0;
    const cues: string[] = [];
    for (const [re, weight, cue] of HAZARD_CUES[key]) {
      if (re.test(t)) {
        score += weight;
        cues.push(cue);
      }
    }
    if (score > (best?.score ?? 0)) best = { key, score, cues };
  }
  return best && best.score >= 3 ? best : null;
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
    out.push({
      id: `seed-${i}`,
      transcript: tpl.t.replace("{name}", name).replace("{addr}", addr),
      category: cat,
      urgency: tpl.u,
      description: tpl.d,
      raw_location_text: addr,
      latitude: hood.lat + (rand() - 0.5) * 0.06,
      longitude: hood.lng + (rand() - 0.5) * 0.07,
      created_at: new Date(DEMO_NOW - minutesAgo * 60_000).toISOString(),
      hazard: "hurricane",
      name,
      people: 1 + Math.floor(rand() * 5),
      sizeKb: Math.round((7 + rand() * 11) * 10) / 10,
      durationSec: 9 + Math.floor(rand() * 20),
      assignedTo: rand() > 0.55 ? pick(RESPONDER_UNITS) : null,
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

export const SEED_REPORTS = buildSeedReports();

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
  const mins = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  return `${h}h ${mins % 60}m ago`;
}

// Keyword fallback used only when the backend is unreachable (e.g. offline
// demo). The real classification comes from Grok via /api/reports.
export function classifyLocally(text: string): {
  category: CategoryKey;
  urgency: Urgency;
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
    )
  )
    category = "missing_person";
  else if (
    has("trapped", "attic", "water is rising", "flooding", "stuck", "boat")
  )
    category = "flood";
  else if (has("fire", "smoke", "burning")) category = "fire";
  else if (has("water", "food", "hungry", "thirst", "formula", "supplies"))
    category = "food_water";
  else if (
    has(
      "roof",
      "shelter",
      "place to stay",
      "house is gone",
      "destroyed",
      "nowhere",
    )
  )
    category = "shelter";
  else if (has("safe", "okay", "we're fine", "we are fine", "i'm fine"))
    category = "safe";
  const urgency: Urgency =
    category === "safe"
      ? "low"
      : has(
            "now",
            "please",
            "hurry",
            "dying",
            "can't breathe",
            "trapped",
            "bleeding",
            "rising",
          ) ||
          category === "medical" ||
          category === "flood"
        ? "high"
        : "medium";
  return { category, urgency };
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
  /\b(need|help|hurt|injur|bleed|broken|trapped|stuck|rising|flood|fire|smoke|missing|can'?t|insulin|oxygen|pregnan|boat|water|food|shelter|roof|collapsed|safe)\b/i;
const INTRO = /^(this is|my name|hi|hello|it'?s \w+ here)\b/i;

/** Pick the sentences that say what's wrong, for a short dispatcher title. */
export function summarize(transcript: string, max = 90): string {
  const sentences = transcript
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const useful = sentences.filter((s) => NEED_WORDS.test(s) && !INTRO.test(s));
  let text = (useful.length ? useful : sentences).join(" ");
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

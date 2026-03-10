// ═══════════════════════════════════════════════════════════
// OPEN MAT — DESIGN TOKENS
// Shared across all screens. Single source of truth.
// ═══════════════════════════════════════════════════════════

export const T = {
  // Backgrounds
  bg: "#0A0A0F",
  surface: "#0F1015",
  surface2: "#14151C",
  surface3: "#1A1B24",

  // Borders
  border: "#1E2029",
  borderB: "#2A2C38",

  // Text
  text: "#E8E8F0",
  muted: "#6B6E80",
  dim: "#3A3D4E",
  white: "#F0F0FF",

  // Semantic
  you: "#D4603A",     // warm — dominant / your color
  opp: "#3A8EC4",     // cool — opponent / defending
  neutral: "#5E6175", // gray — neutral positions

  // Move types
  red: "#E63946",     // submissions / danger
  blue: "#4895EF",    // transitions / flow
  amber: "#F4A261",   // sweeps / reversals
  green: "#52B788",   // takedowns / initiation
  teal: "#2A9D8F",    // escapes / safety
  gray: "#6C757D",    // counters / neutralization
  gold: "#E9C46A",    // mastery / excellence
  purple: "#8B5CF6",  // belt / progression

  // Coach
  coach: "#52B788",

  // Fonts
  display: "'Bebas Neue', sans-serif",
  body: "'DM Sans', sans-serif",
  mono: "'IBM Plex Mono', monospace",
};

// Move type → color mapping
export const MTColors = {
  submission: T.red,
  transition: T.blue,
  sweep: T.amber,
  escape: T.teal,
  takedown: T.green,
  counter: T.gray,
};

// Move type → short label
export const MTLabels = {
  submission: "SUB",
  transition: "TRANS",
  sweep: "SWEEP",
  escape: "ESC",
  takedown: "TD",
  counter: "CTR",
};

// Archetype → color
export const ArchColors = {
  wrestler: T.green,
  guard_puller: T.teal,
  leg_locker: T.purple,
  pressure_passer: T.red,
  submission_hunter: T.red,
  scrambler: T.amber,
};

// Belt → color
export const BeltColors = {
  white: "#E8E8F0",
  blue: "#3B82F6",
  purple: "#8B5CF6",
  brown: "#92613A",
  black: "#1A1A1A",
};

// Belt order helper
const BELT_ORDER = ["white", "blue", "purple", "brown", "black"];
export const atLeast = (belt, min) => BELT_ORDER.indexOf(belt) >= BELT_ORDER.indexOf(min);

// Tier display
export const TierDisplay = {
  drilled: { sym: "★", c: T.gold, label: "DRILLED" },
  trained: { sym: "─", c: T.muted, label: "TRAINED" },
  known: { sym: "░", c: T.dim, label: "KNOWN" },
  mastered: { sym: "◆", c: T.gold, label: "MASTERED" },
};

// Archetype data
export const ARCHETYPES = [
  { id: "wrestler", name: "Wrestler", desc: "Takedowns, top pressure, grind them down", strength: "Takedowns +20%", weakness: "Sweeps -15%", color: T.green },
  { id: "guard_puller", name: "Guard Puller", desc: "Sweeps, submissions from bottom, guard retention", strength: "Sweeps +20%", weakness: "Takedowns -15%", color: T.teal },
  { id: "leg_locker", name: "Leg Locker", desc: "Heel hooks, kneebars, leg entanglement specialist", strength: "Submissions +20%", weakness: "Takedowns -15%", color: T.purple },
  { id: "pressure_passer", name: "Pressure Passer", desc: "Guard passing, smash, heavy top game", strength: "Transitions +20%", weakness: "Sweeps -15%", color: T.red },
  { id: "submission_hunter", name: "Sub Hunter", desc: "Deep submission chains from every position", strength: "All subs +8%", weakness: "Transitions -20%", color: T.red },
  { id: "scrambler", name: "Scrambler", desc: "Transitions, athleticism, chaos", strength: "Transitions +18%", weakness: "Submissions -15%", color: T.amber },
];

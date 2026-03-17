// ═══════════════════════════════════════════════════════════
// OPEN MAT — DESIGN TOKENS (LIGHT MODE)
// DM font family. Sports-editorial aesthetic.
// Single source of truth for all screens.
// ═══════════════════════════════════════════════════════════

export const T = {
  // Backgrounds
  bg: "#F8F8FB",
  bgCard: "#FFFFFF",
  bgSection: "#F9FAFB",

  // Borders
  border: "#E5E7EB",
  borderFocus: "#D1D5DB",
  borderLight: "#F3F4F6",

  // Text
  text: "#111827",
  textSecondary: "#374151",
  muted: "#6B7280",
  dim: "#9CA3AF",

  // Move types
  sub: "#C23028",
  subBg: "#FEF2F1",
  subBorder: "#F5C4C2",
  subDark: "#8B1A14",

  sweep: "#B8860B",
  sweepBg: "#FDF8EC",
  sweepBorder: "#F0DBA8",
  sweepDark: "#7A5A08",

  trans: "#2563EB",
  transBg: "#EFF4FF",
  transBorder: "#BFCFFF",
  transDark: "#1A3D8F",

  td: "#0F7B5F",
  tdBg: "#EEFBF5",
  tdBorder: "#A7E5CF",
  tdDark: "#065A42",

  escape: "#7C3AED",
  escapeBg: "#F5F0FF",
  escapeBorder: "#D4BFFF",
  escapeDark: "#5521A6",

  // Semantic
  green: "#0F7B5F",
  red: "#C23028",
  gold: "#B8860B",
  blue: "#2563EB",
  purple: "#7C3AED",

  // GP cost colors
  gpCheap: "#0F7B5F",
  gpModerate: "#B8860B",
  gpExpensive: "#C23028",

  // Coach
  coach: "#0F7B5F",

  // Shadows
  shadowSm: "0 1px 3px rgba(0,0,0,0.04)",
  shadowMd: "0 4px 20px rgba(0,0,0,0.06)",
  shadowLg: "0 8px 24px rgba(0,0,0,0.08)",

  // Radii
  radiusSm: 6,
  radiusMd: 10,
  radiusLg: 14,

  // Fonts
  display: "'DM Serif Display', Georgia, serif",
  body: "'DM Sans', 'Helvetica Neue', sans-serif",
  mono: "'DM Mono', Menlo, monospace",

  // Legacy aliases (backward compat for screens not yet fully migrated)
  surface: "#FFFFFF",
  surface2: "#F9FAFB",
  surface3: "#F3F4F6",
  white: "#111827",
  you: "#C23028",
  opp: "#2563EB",
  amber: "#B8860B",
  teal: "#7C3AED",
  borderB: "#D1D5DB",
};

// ── TYPE COLORS ──────────────────────────────────────────
export const TYPE_COLORS = {
  submission:  { color: '#C23028', bg: '#FEF2F1', border: '#F5C4C2', dark: '#8B1A14', label: 'SUB' },
  sweep:       { color: '#B8860B', bg: '#FDF8EC', border: '#F0DBA8', dark: '#7A5A08', label: 'SWP' },
  transition:  { color: '#2563EB', bg: '#EFF4FF', border: '#BFCFFF', dark: '#1A3D8F', label: 'TRNS' },
  takedown:    { color: '#0F7B5F', bg: '#EEFBF5', border: '#A7E5CF', dark: '#065A42', label: 'TD' },
  escape:      { color: '#7C3AED', bg: '#F5F0FF', border: '#D4BFFF', dark: '#5521A6', label: 'ESC' },
  counter:     { color: '#6B7280', bg: '#F3F4F6', border: '#E5E7EB', dark: '#374151', label: 'CTR' },
};

// Move type → flat color (backward compat)
export const MTColors = {
  submission: '#C23028',
  transition: '#2563EB',
  sweep: '#B8860B',
  escape: '#7C3AED',
  takedown: '#0F7B5F',
  counter: '#6B7280',
};

// Move type → short label
export const MTLabels = {
  submission: "SUB",
  transition: "TRNS",
  sweep: "SWP",
  escape: "ESC",
  takedown: "TD",
  counter: "CTR",
};

// ── TIER STYLES ──────────────────────────────────────────
export const TIER_STYLES = {
  drilled:  { symbol: '★', color: '#B8860B', label: 'DRILLED', bg: '#FDF8EC', ring: '#E8C84A' },
  trained:  { symbol: '─', color: '#6B7280', label: 'TRAINED', bg: '#F3F4F6', ring: '#9CA3AF' },
  known:    { symbol: '░', color: '#9CA3AF', label: 'KNOWN',   bg: '#F9FAFB', ring: '#D1D5DB' },
  mastered: { symbol: '◆', color: '#B8860B', label: 'MASTERED', bg: '#FDF8EC', ring: '#D4A017' },
};

// Legacy alias
export const TierDisplay = {
  drilled:  { sym: "★", c: "#B8860B", label: "DRILLED" },
  trained:  { sym: "─", c: "#6B7280", label: "TRAINED" },
  known:    { sym: "░", c: "#9CA3AF", label: "KNOWN" },
  mastered: { sym: "◆", c: "#B8860B", label: "MASTERED" },
};

// ── ARCHETYPE COLORS ─────────────────────────────────────
export const ArchColors = {
  wrestler: "#0F7B5F",
  guard_puller: "#7C3AED",
  leg_locker: "#7C3AED",
  pressure_passer: "#C23028",
  submission_hunter: "#C23028",
  scrambler: "#B8860B",
};

// ── ARCHETYPE PORTRAITS ──────────────────────────────────
export const ARCHETYPE_PORTRAITS = {
  wrestler: '/assets/archetypes/gorilla.png',
  guard_puller: '/assets/archetypes/octopus.png',
  leg_locker: '/assets/archetypes/snake.png',
  pressure_passer: '/assets/archetypes/bear.png',
  submission_hunter: '/assets/archetypes/spider.png',
  scrambler: '/assets/archetypes/monkey.png',
};

export const ARCHETYPE_ANIMALS = {
  wrestler: 'Gorilla',
  guard_puller: 'Octopus',
  leg_locker: 'Snake',
  pressure_passer: 'Bear',
  submission_hunter: 'Spider',
  scrambler: 'Monkey',
};

// ── BELT COLORS ──────────────────────────────────────────
export const BeltColors = {
  white: "#E8E8E8",
  blue: "#2563EB",
  purple: "#7C3AED",
  brown: "#92400E",
  black: "#1F2937",
};

// Belt order helper
const BELT_ORDER = ["white", "blue", "purple", "brown", "black"];
export const atLeast = (belt, min) => BELT_ORDER.indexOf(belt) >= BELT_ORDER.indexOf(min);

// ── ARCHETYPE DATA ───────────────────────────────────────
export const ARCHETYPES = [
  { id: "wrestler", name: "Wrestler", animal: "Gorilla", desc: "Takedowns, top pressure, grind them down", strength: "Takedowns +20%", weakness: "Sweeps -15%", color: "#0F7B5F" },
  { id: "guard_puller", name: "Guard Puller", animal: "Octopus", desc: "Sweeps, submissions from bottom, guard retention", strength: "Sweeps +20%", weakness: "Takedowns -15%", color: "#7C3AED" },
  { id: "leg_locker", name: "Leg Locker", animal: "Snake", desc: "Heel hooks, kneebars, leg entanglement specialist", strength: "Submissions +20%", weakness: "Takedowns -15%", color: "#7C3AED" },
  { id: "pressure_passer", name: "Pressure Passer", animal: "Bear", desc: "Guard passing, smash, heavy top game", strength: "Transitions +20%", weakness: "Sweeps -15%", color: "#C23028" },
  { id: "submission_hunter", name: "Sub Hunter", animal: "Spider", desc: "Deep submission chains from every position", strength: "All subs +8%", weakness: "Transitions -20%", color: "#C23028" },
  { id: "scrambler", name: "Scrambler", animal: "Monkey", desc: "Transitions, athleticism, chaos", strength: "Transitions +18%", weakness: "Submissions -15%", color: "#B8860B" },
];

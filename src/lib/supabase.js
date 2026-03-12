import { createClient } from '@supabase/supabase-js';

// === SUPABASE ===
const SUPABASE_URL = 'https://efsswnwiehpejczlttwr.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmc3N3bndpZWhwZWpjemx0dHdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4MzE0OTgsImV4cCI6MjA4ODQwNzQ5OH0.Bxxm-Jh5my46y63Zy2yWhYOp-5XBsDAWTlGS9Nv2JII';
export const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// === DEBUG ===
export function dbg(msg, type) {
  const el = document.getElementById('debug-log');
  if (!el) return;
  const d = document.createElement('div');
  d.className = type || '';
  d.textContent = new Date().toLocaleTimeString() + ' ' + msg;
  el.appendChild(d);
  el.scrollTop = el.scrollHeight;
  console.log('[' + (type || 'info') + ']', msg);
}

// Triple-tap debug toggle
let tapCount = 0, tapTimer;
document.addEventListener('click', e => {
  if (e.clientX > window.innerWidth - 60 && e.clientY > window.innerHeight - 60) {
    tapCount++;
    clearTimeout(tapTimer);
    tapTimer = setTimeout(() => tapCount = 0, 500);
    if (tapCount >= 3) { document.getElementById('debug-log')?.classList.toggle('show'); tapCount = 0; }
  }
});

// === GRAPH CACHE ===
export const G = { positions: {}, techniques: {}, counters: {}, techFrom: {}, pairMap: {}, matrix: {} };
export const beltOrder = { white: 1, blue: 2, purple: 3, brown: 4, black: 5 };

export async function loadGraph() {
  dbg('Loading graph...', 'ok');
  const [p, t, c, m] = await Promise.all([
    sb.from('positions').select('*'),
    sb.from('techniques').select('*'),
    sb.from('counter_techniques').select('*'),
    sb.from('archetype_position_matrix').select('*')
  ]);
  if (p.error) { dbg('Positions error: ' + p.error.message, 'err'); return false; }
  if (t.error) { dbg('Techniques error: ' + t.error.message, 'err'); return false; }
  if (c.error) { dbg('Counters error: ' + c.error.message, 'err'); return false; }

  p.data.forEach(pos => {
    G.positions[pos.id] = pos;
    if (pos.pair_id) { G.pairMap[pos.id] = pos.pair_id; G.pairMap[pos.pair_id] = pos.id; }
  });
  t.data.forEach(tech => {
    G.techniques[tech.id] = tech;
    if (!G.techFrom[tech.from_position]) G.techFrom[tech.from_position] = [];
    G.techFrom[tech.from_position].push(tech);
  });
  c.data.forEach(ct => G.counters[ct.id] = ct);

  if (m.data) {
    m.data.forEach(row => {
      if (!G.matrix[row.position_id]) G.matrix[row.position_id] = {};
      G.matrix[row.position_id][row.archetype] = row.status;
    });
    dbg('Matrix loaded: ' + m.data.length + ' entries', 'ok');
  }

  dbg('Graph loaded: ' + p.data.length + ' pos, ' + t.data.length + ' tech, ' + c.data.length + ' counters', 'ok');
  return true;
}

export function getStatus(posId, archetype) {
  return (G.matrix[posId] && G.matrix[posId][archetype]) || 'neutral';
}

export function getMoves(posId, belt, deck, overtime, archetype) {
  const lvl = beltOrder[belt] || 1;
  const status = archetype ? getStatus(posId, archetype) : 'neutral';

  return (G.techFrom[posId] || []).filter(t => {
    if ((beltOrder[t.belt_unlock] || 1) > lvl) return false;
    if (!deck.includes(t.id)) return false;
    if (overtime && t.type !== 'submission') return false;
    // Position-based only: from_position match is handled by techFrom[posId].
    // Status (defending/dominant) does NOT restrict which moves you can play.
    return true;
  });
}

// Tiered hand draw: drilled guaranteed, trained fill to 5, 15% chance for 1 known
export function drawHand(posId, belt, deckIds, deckTiers, overtime, archetype, drilledMoves = []) {
  const all = getMoves(posId, belt, deckIds, overtime, archetype);
  if (all.length <= 5) return all;

  const drilledSet = new Set(drilledMoves || []);
  const drilled = all.filter(t => drilledSet.has(t.id));
  const trained = all.filter(t => !drilledSet.has(t.id) && (deckTiers[t.id] || 'trained') !== 'known');
  const known = all.filter(t => (deckTiers[t.id]) === 'known' && !drilledSet.has(t.id));

  const hand = [...drilled];
  const shuffled = [...trained].sort(() => Math.random() - 0.5);
  while (hand.length < 5 && shuffled.length > 0) {
    hand.push(shuffled.shift());
  }

  // 15% chance: add 1 known move if hand not full
  if (known.length > 0 && Math.random() < 0.15) {
    const kn = known[Math.floor(Math.random() * known.length)];
    if (hand.length < 5) hand.push(kn);
  }

  return hand;
}

// ═══════════════════════════════════════════════════════════
// OPEN MAT — EFFICIENCY GRADE + TIER PROGRESS
// Belt-gated move effectiveness calculation
// ═══════════════════════════════════════════════════════════

import { G } from './supabase';

// ── EFFICIENCY GRADE ─────────────────────────────────────
// Returns { score, grade, color } or null (white belt)
export function calculateEfficiency({
  technique,       // from G.techniques[id] — has .difficulty, .type, .gp_cost
  tier,            // 'known' | 'trained' | 'drilled' | 'mastered'
  playerArchetype,
  playerPosition,  // current position id
  chainCount,      // current chain count (from match state)
  hasVariant,      // boolean
  variantBonus,    // float 0-1
  belt,            // player belt
  currentGP,       // player's current GP (for overdraft penalty)
}) {
  if (belt === 'white') return null;
  if (!technique) return null;

  const difficulty = technique.difficulty || 1;
  const gpCost = technique.gp_cost || 1;
  const type = technique.type;

  // Position dominance from archetype matrix
  const posStatus = G.matrix?.[playerPosition]?.[playerArchetype] || 'neutral';
  const isDominant = posStatus === 'dominant';

  // Chain bonus (only at purple+)
  const chainBonus = (belt === 'purple' || belt === 'brown' || belt === 'black')
    ? Math.min(30, Math.max(0, ((chainCount || 0) - 1) * 10))
    : 0;

  let score = 0;

  if (type === 'submission') {
    score = 70
      + (difficulty * 4)
      + chainBonus
      + (isDominant ? 10 : 0)
      + (hasVariant ? (variantBonus || 0) * 20 : 0)
      - (gpCost * 8)
      - (tier === 'known' ? 10 : 0)
      + (tier === 'drilled' || tier === 'mastered' ? 5 : 0);
  } else if (type === 'escape') {
    score = 50
      + (difficulty * 8)
      + chainBonus
      - (gpCost * 8)
      - (tier === 'known' ? 10 : 0)
      + (tier === 'drilled' || tier === 'mastered' ? 5 : 0);
  } else {
    // transition, sweep, takedown
    score = 40
      + (difficulty * 12)
      + (isDominant ? 12 : 0)
      + chainBonus
      + (hasVariant ? (variantBonus || 0) * 10 : 0)
      - (gpCost * 8)
      - (tier === 'known' ? 10 : 0)
      + (tier === 'drilled' || tier === 'mastered' ? 5 : 0);
  }

  // Overdraft penalty
  if (currentGP !== undefined && currentGP !== null) {
    const overdraft = Math.max(0, gpCost - currentGP);
    score -= overdraft * 15;
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  let grade, color;
  if (score >= 80)      { grade = 'S'; color = '#B8860B'; }
  else if (score >= 60) { grade = 'A'; color = '#0F7B5F'; }
  else if (score >= 40) { grade = 'B'; color = '#2563EB'; }
  else if (score >= 20) { grade = 'C'; color = '#6B7280'; }
  else                  { grade = 'D'; color = '#C23028'; }

  return { score, grade, color };
}

// ── TIER PROGRESSION ─────────────────────────────────────
export function getTierProgress(tier, timesUsed = 0) {
  switch (tier) {
    case 'known':
      return { current: Math.min(timesUsed, 5), target: 5, label: `${Math.min(timesUsed, 5)}/5`, nextTier: 'Trained', color: '#9CA3AF' };
    case 'trained':
      return { current: 5, target: 5, label: 'READY TO DRILL', nextTier: 'Drilled', color: '#B8860B' };
    case 'drilled':
      return { current: Math.min(timesUsed, 25), target: 25, label: `${Math.min(timesUsed, 25)}/25`, nextTier: 'Mastered', color: '#B8860B' };
    case 'mastered':
      return { current: 25, target: 25, label: 'MAX', nextTier: null, color: '#B8860B' };
    default:
      return { current: 0, target: 5, label: '0/5', nextTier: 'Trained', color: '#9CA3AF' };
  }
}

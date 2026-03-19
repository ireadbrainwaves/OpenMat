// ═══════════════════════════════════════════════════════════
// OPEN MAT — ATMOSPHERE SYSTEM
// Position-based background washes and outcome colors.
// Subtle mood shifts that respond to match state.
// ═══════════════════════════════════════════════════════════

/**
 * Returns the CSS class name for the atmosphere based on position.
 * Atmosphere = subtle background wash that shifts with position.
 */
export function getAtmosphereClass(positionId, isDominant) {
  if (!positionId) return 'atmo-neutral';

  // Map position families to atmospheres
  const familyMap = {
    standing: 'atmo-neutral',
    clinch: 'atmo-neutral',
    guard: isDominant ? 'atmo-passing' : 'atmo-guard',
    half_guard: isDominant ? 'atmo-passing' : 'atmo-guard',
    passing: 'atmo-passing',
    side_control: isDominant ? 'atmo-pressure' : 'atmo-danger',
    mount: isDominant ? 'atmo-mount-top' : 'atmo-mount-bottom',
    back: isDominant ? 'atmo-back-attack' : 'atmo-back-defend',
    turtle: isDominant ? 'atmo-pressure' : 'atmo-danger',
    leg_entanglement: 'atmo-legs',
    scramble: 'atmo-neutral',
  };

  // Extract family from position ID (e.g., "mount_top" → "mount")
  const family = positionId.split('_')[0];
  return familyMap[family] || 'atmo-neutral';
}

/**
 * Returns the tighten atmosphere class for sub minigame.
 * @param {number} tighten — 0-5 tighten level
 */
export function getTightenAtmosphere(tighten) {
  if (tighten >= 4) return 'atmo-tighten-4';
  if (tighten >= 3) return 'atmo-tighten-3';
  if (tighten >= 2) return 'atmo-tighten-2';
  if (tighten >= 1) return 'atmo-tighten-1';
  return 'atmo-tighten-0';
}

/**
 * Returns edge glow box-shadow for sub minigame tighten level.
 * @param {number} tighten — 0-5
 */
export function getTightenEdgeGlow(tighten) {
  if (tighten >= 4) return 'inset 0 0 100px rgba(194,48,40,0.12)';
  if (tighten >= 3) return 'inset 0 0 80px rgba(194,48,40,0.08)';
  if (tighten >= 2) return 'inset 0 0 60px rgba(194,48,40,0.05)';
  if (tighten >= 1) return 'inset 0 0 50px rgba(194,48,40,0.03)';
  return 'none';
}

/**
 * Returns the outcome color for a turn result.
 */
export function getOutcomeColor(resultType) {
  const map = {
    submission: '#C23028',
    sweep: '#0F7B5F',
    transition: '#2563EB',
    takedown: '#0F7B5F',
    escape: '#7C3AED',
    countered: '#2563EB',
    chain: '#B8860B',
    hold: '#6B7280',
    caught: '#8B1A14',
    no_counter: '#7A5A08',
  };
  return map[resultType] || '#6B7280';
}

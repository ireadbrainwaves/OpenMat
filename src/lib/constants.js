export const BELT_COLORS = { white: '#fff', blue: '#5a9cf5', purple: '#a07cf5', brown: '#a0522d', black: '#333' };

export const TYPE_COLORS = {
  submission: '#e63946',
  sweep: '#f0a050',
  transition: '#5a9cf5',
  takedown: '#4aba80',
  escape: '#a07cf5',
};

export const TYPE_SHORT = {
  submission: 'sub',
  sweep: 'sweep',
  transition: 'trans',
  takedown: 'td',
  escape: 'escape',
};

export const TYPE_ICONS = {
  submission: '🔒',
  sweep: '↻',
  transition: '⤵',
  takedown: '🎯',
  escape: '↗',
};

export const FAMILY_COLORS = {
  standing: '#e8b84b',
  clinch: '#e88a4b',
  guard: '#5a9cf5',
  passing: '#a07cf5',
  side_control: '#e84b6a',
  mount: '#ff4444',
  back: '#f97316',
  leg_entanglement: '#4aba80',
  transition: '#6b7280',
};

export const ARCHETYPES = {
  wrestler:          { icon: '🤼', label: 'Wrestler',         desc: 'Takedowns, top pressure' },
  guard_puller:      { icon: '🛡', label: 'Guard Puller',     desc: 'Sweeps, bottom subs' },
  leg_locker:        { icon: '🦵', label: 'Leg Locker',       desc: 'Heel hooks, entanglements' },
  pressure_passer:   { icon: '🏋', label: 'Pressure Passer',  desc: 'Smash pass, heavy top' },
  submission_hunter: { icon: '🎯', label: 'Sub Hunter',       desc: 'Submission chains' },
  scrambler:         { icon: '⚡', label: 'Scrambler',         desc: 'Transitions, speed' },
};

export const BELT_DRILL_SLOTS = { white: 3, blue: 4, purple: 5, brown: 5, black: 5 };
export const BELT_MAX_TRAINED = { white: 10, blue: 12, purple: 15, brown: 18, black: 20 };
export const BELT_VARIANT_SLOTS = { white: 0, blue: 1, purple: 2, brown: 3, black: 4 };
export const MASTERY_THRESHOLD = 25; // successful uses while drilled to reach Mastered

export const GP_COSTS = { submission: 3, sweep: 2, takedown: 2, transition: 1, escape: 1, counter: 0 };

export const STANCE_CONFIG = {
  attack: { icon: '⚔️', label: 'Attack', desc: 'Commit to offense — moves cost base GP', gpEffect: 'Base GP', color: 'var(--red)' },
  defend: { icon: '🛡️', label: 'Defend', desc: '+15% defense — counters free, no GP gain', gpEffect: '0 GP', color: 'var(--muted)' },
  setup:  { icon: '🔄', label: 'Setup',  desc: 'Recover grip, reset position — +2 GP',   gpEffect: '+2 GP', color: 'var(--blue)' },
};

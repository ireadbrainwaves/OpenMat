export const BELT_COLORS = { white: '#E8E8E8', blue: '#2563EB', purple: '#7C3AED', brown: '#92400E', black: '#1F2937' };

export const TYPE_COLORS = {
  submission: '#C23028',
  sweep: '#B8860B',
  transition: '#2563EB',
  takedown: '#0F7B5F',
  escape: '#7C3AED',
};

export const TYPE_SHORT = {
  submission: 'sub',
  sweep: 'sweep',
  transition: 'trans',
  takedown: 'td',
  escape: 'escape',
};

export const TYPE_ICONS = {
  submission: '●',
  sweep: '↻',
  transition: '→',
  takedown: '↓',
  escape: '←',
};

export const FAMILY_COLORS = {
  standing: '#B8860B',
  clinch: '#C23028',
  guard: '#2563EB',
  passing: '#7C3AED',
  side_control: '#C23028',
  mount: '#C23028',
  back: '#B8860B',
  leg_entanglement: '#0F7B5F',
  transition: '#6B7280',
};

export const ARCHETYPES = {
  wrestler:          { icon: '●', label: 'Wrestler',         desc: 'Takedowns, top pressure' },
  guard_puller:      { icon: '○', label: 'Guard Puller',     desc: 'Sweeps, bottom subs' },
  leg_locker:        { icon: '◇', label: 'Leg Locker',       desc: 'Heel hooks, entanglements' },
  pressure_passer:   { icon: '■', label: 'Pressure Passer',  desc: 'Smash pass, heavy top' },
  submission_hunter: { icon: '◆', label: 'Sub Hunter',       desc: 'Submission chains' },
  scrambler:         { icon: '△', label: 'Scrambler',         desc: 'Transitions, speed' },
};

export const BELT_DRILL_SLOTS = { white: 3, blue: 4, purple: 5, brown: 5, black: 5 };
export const BELT_MAX_TRAINED = { white: 10, blue: 12, purple: 15, brown: 18, black: 20 };
export const BELT_VARIANT_SLOTS = { white: 0, blue: 1, purple: 2, brown: 3, black: 4 };
export const MASTERY_THRESHOLD = 25; // successful uses while drilled to reach Mastered

export const GP_COSTS = { submission: 3, sweep: 2, takedown: 3, transition: 1, escape: 2, counter: 0 };

export const BELT_GP = {
  white:  { start: 8,  max: 10, recoveryBonus: 0 },
  blue:   { start: 10, max: 12, recoveryBonus: 0 },
  purple: { start: 10, max: 14, recoveryBonus: 1 },
  brown:  { start: 12, max: 16, recoveryBonus: 1 },
  black:  { start: 12, max: 18, recoveryBonus: 2 },
};

export const GP_CONFIG = {
  SPAZ_COST: 4,
  SETUP_RECOVERY_BONUS: 2,
  DESPERATION_EXIT_GP: 2,
  SUB_MINIGAME_DRAIN: 1,
};

export const MOVE_COSTS = {
  transition: 1,
  escape: 2,
  sweep: 2,
  takedown: 3,
  submission: 3,
  survive: 0,
  spaz: 4,
};

export const STANCE_CONFIG = {
  attack: { icon: '⚔', label: 'Attack', desc: 'Commit to offense — moves cost base GP', gpEffect: 'Base GP', color: '#C23028' },
  defend: { icon: '◎', label: 'Defend', desc: '+15% defense — counters free, no GP gain', gpEffect: '0 GP', color: '#6B7280' },
  setup:  { icon: '↺', label: 'Setup',  desc: 'Recover grip, reset position — +2 GP',   gpEffect: '+2 GP', color: '#2563EB' },
};

import { sb as supabase, G } from './supabase';

/*
 * BotEngine — Phase 5: Personality System + Professor Adaptive AI
 *
 * bot_difficulty (0.15–0.95) controls decision quality across all phases.
 * personality JSONB overrides defaults per-bot:
 *   { stance, prefer_types, avoid_types, never_spaz, use_professor_ai }
 *
 * Professor AI activates via personality.use_professor_ai OR diff >= 0.90.
 * Professor does NOT read player drills — adapts from observed play only.
 */

// ── POSITION CLASSIFICATION ──────────────────────────────────
const DOMINANT_POSITIONS = new Set([
  'side_control_top', 'mount_top', 'mount_high_top', 'back_control_top',
  'knee_on_belly_top', 'north_south_top', 'kesa_gatame_top',
  'turtle_top', 'mount_technical_top', 'mount_s_mount_top',
  'passing_hq', 'passing_standing_open', 'passing_smash_pass',
  'passing_knee_slice', 'passing_body_fold', 'passing_torreando',
  'passing_leg_drag', 'passing_long_step',
  'clinch_bodylock', 'clinch_double_underhooks', 'clinch_front_headlock',
  'clinch_russian_tie',
  'leg_entanglement_ashi_garami', 'leg_entanglement_inside_sankaku',
  'leg_entanglement_outside_ashi', 'leg_entanglement_411',
  'leg_entanglement_game_over', 'leg_entanglement_reap',
  'crucifix_top', 'back_body_triangle',
]);

const GP_COSTS = { transition: 1, sweep: 2, takedown: 3, submission: 3, escape: 2 };

// ── ARCHETYPE CONFIGS ────────────────────────────────────────
const STANCE_WEIGHTS = {
  wrestler:          { attack: 0.6, defend: 0.1, setup: 0.3 },
  guard_puller:      { attack: 0.3, defend: 0.4, setup: 0.3 },
  leg_locker:        { attack: 0.5, defend: 0.2, setup: 0.3 },
  pressure_passer:   { attack: 0.5, defend: 0.2, setup: 0.3 },
  submission_hunter: { attack: 0.7, defend: 0.1, setup: 0.2 },
  scrambler:         { attack: 0.3, defend: 0.2, setup: 0.5 },
};

const ARCHETYPE_TYPE_SCORES = {
  submission_hunter: { submission: 5, transition: 2, escape: 1, sweep: 1, takedown: 0 },
  wrestler:          { takedown: 5, submission: 3, transition: 2, escape: 2, sweep: 0 },
  guard_puller:      { sweep: 5, submission: 4, transition: 2, escape: 2, takedown: 0 },
  pressure_passer:   { transition: 4, submission: 4, takedown: 3, escape: 1, sweep: 0 },
  leg_locker:        { submission: 5, transition: 4, escape: 1, sweep: 1, takedown: 0 },
  scrambler:         { transition: 4, sweep: 3, takedown: 3, escape: 2, submission: 1 },
};

// ── HELPERS ──────────────────────────────────────────────────
function weightedChoice(weights) {
  const entries = Object.entries(weights);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [key, weight] of entries) {
    r -= weight;
    if (r <= 0) return key;
  }
  return entries[entries.length - 1][0];
}

function parseDifficulty(d) {
  if (typeof d === 'number') return d;
  if (d === 'master') return 0.95;
  if (d === 'hard') return 0.7;
  if (d === 'medium') return 0.5;
  return 0.3;
}

function isTopPosition(posId) {
  return DOMINANT_POSITIONS.has(posId) || (posId && posId.endsWith('_top'));
}

// ── CACHES ───────────────────────────────────────────────────
const botStackCache = {};

async function getBotMoveStacks(botId) {
  if (botStackCache[botId]) return botStackCache[botId];
  const { data } = await supabase.from('player_move_stacks')
    .select('technique_id, tier, equipped_variant')
    .eq('profile_id', botId);
  const map = {};
  (data || []).forEach(m => { map[m.technique_id] = m; });
  botStackCache[botId] = map;
  return map;
}

const masteredCache = {};

async function getMasteredPositions(botId) {
  if (masteredCache[botId]) return masteredCache[botId];
  const stacks = await getBotMoveStacks(botId);
  const masteredMap = {};
  for (const [techId, stack] of Object.entries(stacks)) {
    if (stack.tier === 'mastered') {
      const tech = G.techniques[techId];
      if (tech) {
        if (!masteredMap[tech.from_position]) masteredMap[tech.from_position] = [];
        masteredMap[tech.from_position].push(techId);
      }
    }
  }
  masteredCache[botId] = masteredMap;
  return masteredMap;
}

// ── CHAIN SUB / COUNTER OPTIONS ──────────────────────────────
async function getChainSubOptions(botId, currentPosition, currentSubId) {
  const stacks = await getBotMoveStacks(botId);
  const tierOrder = { mastered: 0, drilled: 1, trained: 2, known: 3 };
  return Object.entries(stacks)
    .filter(([techId]) => {
      const tech = G.techniques[techId];
      return tech && tech.type === 'submission' && tech.from_position === currentPosition && techId !== currentSubId;
    })
    .sort((a, b) => (tierOrder[a[1].tier] ?? 3) - (tierOrder[b[1].tier] ?? 3))
    .map(([techId, stack]) => ({ id: techId, tier: stack.tier }));
}

async function getCounterOptions(botId, defenderPosition) {
  const stacks = await getBotMoveStacks(botId);
  const tierOrder = { mastered: 0, drilled: 1, trained: 2, known: 3 };
  return Object.entries(stacks)
    .filter(([techId]) => {
      const tech = G.techniques[techId];
      return tech && (tech.type === 'submission' || tech.type === 'sweep') && tech.from_position === defenderPosition;
    })
    .sort((a, b) => (tierOrder[a[1].tier] ?? 3) - (tierOrder[b[1].tier] ?? 3))
    .map(([techId, stack]) => ({ id: techId, tier: stack.tier }));
}

// ══════════════════════════════════════════════════════════════
// PROFESSOR MEMORY — in-match observation, resets each match
// ══════════════════════════════════════════════════════════════
const professorMemory = {
  playerMovesPlayed: [],
  playerStancesPlayed: [],
  positionVisitCount: {},
  botMovesPlayed: [],
  matchId: null,
};

function resetProfessorMemory(matchId) {
  professorMemory.playerMovesPlayed = [];
  professorMemory.playerStancesPlayed = [];
  professorMemory.positionVisitCount = {};
  professorMemory.botMovesPlayed = [];
  professorMemory.matchId = matchId;
}

function ensureMemoryForMatch(matchId) {
  if (professorMemory.matchId !== matchId) resetProfessorMemory(matchId);
}

// ── STANCE SELECTION ─────────────────────────────────────────
function pickStance(diff, botArchetype, currentPosition, botGP, oppGP, personality = {}) {
  const isTop = isTopPosition(currentPosition);
  const gpAdvantage = botGP - oppGP;

  let optimalStance;
  if (botGP <= 2) {
    optimalStance = 'setup';
  } else if (isTop || gpAdvantage > 3) {
    optimalStance = 'attack';
  } else if (!isTop && gpAdvantage < -3) {
    optimalStance = 'defend';
  } else {
    optimalStance = 'setup';
  }

  if (Math.random() < diff) {
    return optimalStance;
  } else {
    const weights = personality?.stance || STANCE_WEIGHTS[botArchetype] || STANCE_WEIGHTS.scrambler;
    return weightedChoice(weights);
  }
}

// Professor stance: adapts based on OBSERVED player patterns
function pickStanceProfessor(currentPosition, botGP) {
  if (botGP <= 2) return 'setup';

  const movesFromHere = professorMemory.playerMovesPlayed
    .filter(m => m.position === currentPosition);

  if (movesFromHere.length < 2) return 'attack';

  const total = movesFromHere.length;
  const offensiveCount = movesFromHere.filter(m =>
    m.type === 'submission' || m.type === 'takedown' || m.type === 'sweep'
  ).length;
  const offensiveRatio = offensiveCount / total;

  if (offensiveRatio > 0.6) {
    return Math.random() < 0.65 ? 'defend' :
           Math.random() < 0.5 ? 'setup' : 'attack';
  }
  if (offensiveRatio < 0.3) {
    return Math.random() < 0.65 ? 'attack' :
           Math.random() < 0.5 ? 'setup' : 'defend';
  }
  return Math.random() < 0.60 ? 'setup' :
         Math.random() < 0.5 ? 'attack' : 'defend';
}

// ── MOVE SELECTION ───────────────────────────────────────────
async function pickMove(diff, techniques, botArchetype, botId, currentPosition, botGP, drilledMoves, personality = {}) {
  const stacks = await getBotMoveStacks(botId);
  const drilledSet = new Set(drilledMoves || []);
  const preferTypes = personality?.prefer_types || [];
  const avoidTypes = personality?.avoid_types || [];

  const scored = techniques.map(t => {
    let score = 0;
    const type = t.type;
    const stack = stacks[t.id];
    const tier = stack?.tier;

    if (tier === 'mastered') score += 70;
    else if (tier === 'drilled' || drilledSet.has(t.id)) score += 50;
    else if (tier === 'trained') score += 10;

    const typeScores = ARCHETYPE_TYPE_SCORES[botArchetype] || ARCHETYPE_TYPE_SCORES.scrambler;
    score += (typeScores[type] || 0) * 5;

    // Personality type preferences
    if (preferTypes.includes(type)) score += 25;
    if (avoidTypes.includes(type)) score -= 25;

    if (t.to_position && DOMINANT_POSITIONS.has(t.to_position)) score += 15;

    if (t.to_position && t.to_position !== 'tap' && G.techFrom[t.to_position]) {
      score += Math.min(G.techFrom[t.to_position].length, 10);
    }

    const cost = GP_COSTS[type] || 1;
    if (botGP <= cost + 1) score -= 20;

    return { ...t, score };
  });

  scored.sort((a, b) => b.score - a.score);

  if (Math.random() < diff) {
    const topTier = scored.filter(s => s.score >= scored[0].score - 10);
    return topTier[Math.floor(Math.random() * topTier.length)].id;
  } else {
    scored.forEach(s => { s.score += Math.random() * 20 - 10; });
    scored.sort((a, b) => b.score - a.score);
    return scored[0].id;
  }
}

// Professor move: dead end hunting + mastered funneling + anti-repetition
async function pickMoveProfessor(techniques, botId, currentPosition, botGP, drilledMoves) {
  const stacks = await getBotMoveStacks(botId);
  const masteredMap = await getMasteredPositions(botId);
  const drilledSet = new Set(drilledMoves || []);

  const confirmedDeadEnds = new Set();
  const suspectedDeadEnds = new Set();
  const positionsVisited = new Set();

  professorMemory.playerMovesPlayed.forEach(m => {
    positionsVisited.add(m.position);
    if (m.moveId === '__survive__' || m.moveId === '__spaz__') {
      confirmedDeadEnds.add(m.position);
    }
  });

  positionsVisited.forEach(pos => {
    const movesHere = professorMemory.playerMovesPlayed.filter(m => m.position === pos);
    const onlyDefensive = movesHere.every(m =>
      m.type === 'escape' || m.moveId === '__survive__' || m.moveId === '__spaz__'
    );
    if (onlyDefensive && movesHere.length >= 1) {
      suspectedDeadEnds.add(pos);
    }
  });

  const scored = techniques.map(t => {
    let score = 0;
    const type = t.type;
    const stack = stacks[t.id];
    const tier = stack?.tier;
    const toPos = t.to_position;

    if (tier === 'mastered') score += 100;
    else if (tier === 'drilled' || drilledSet.has(t.id)) score += 50;
    else if (tier === 'trained') score += 10;

    if (type === 'submission') score += 30;
    else if (type === 'sweep') score += 25;
    else if (type === 'takedown') score += 30;
    else if (type === 'transition') score += 20;
    else if (type === 'escape') score += 15;

    if (toPos && confirmedDeadEnds.has(toPos)) score += 80;
    if (toPos && !confirmedDeadEnds.has(toPos) && suspectedDeadEnds.has(toPos)) score += 40;
    if (toPos && toPos !== 'tap' && !positionsVisited.has(toPos)) score += 20;
    if (confirmedDeadEnds.has(t.from_position) && type === 'submission') score += 50;

    if (masteredMap[t.from_position]?.includes(t.id)) score += 100;
    if (toPos && masteredMap[toPos]) score += 40;
    if (toPos && toPos !== 'tap' && G.techFrom[toPos]) {
      const secondaryPositions = (G.techFrom[toPos] || [])
        .map(tech => { const t2 = G.techniques[tech.id || tech]; return t2?.to_position; })
        .filter(Boolean);
      if (secondaryPositions.some(p => masteredMap[p])) score += 20;
    }

    if (toPos && DOMINANT_POSITIONS.has(toPos)) score += 15;

    const timesUsed = professorMemory.botMovesPlayed.filter(m => m.moveId === t.id).length;
    if (timesUsed === 1) score -= 15;
    if (timesUsed >= 2) score -= 30;

    const cost = GP_COSTS[type] || 1;
    if (botGP <= cost + 1) score -= 20;

    return { ...t, score };
  });

  scored.sort((a, b) => b.score - a.score);
  console.log('[PROFESSOR] scored:', scored.slice(0, 5).map(s =>
    `${s.id}(${s.type}):${s.score}` +
    (confirmedDeadEnds.has(s.to_position) ? ' [DEAD END]' : '') +
    (masteredMap[s.from_position]?.includes(s.id) ? ' [MASTERED]' : '')
  ));

  const topTier = scored.filter(s => s.score >= scored[0].score - 5);
  return topTier[Math.floor(Math.random() * topTier.length)].id;
}

// ── SUB MINIGAME ─────────────────────────────────────────────
async function pickSubChoice(diff, match, botId, isAttacker) {
  const isP1 = match.player1_id === botId;
  const botPos = isP1 ? (match.player1_position || match.current_position) : (match.player2_position || match.current_position);

  if (isAttacker) {
    const chainOptions = await getChainSubOptions(botId, botPos, match.sub_technique_id);
    if (Math.random() < diff) {
      const tighten = match.sub_tighten_turns || 0;
      if (tighten >= 3 && chainOptions.length > 0 && Math.random() < 0.4) {
        return { choice: 'chain_sub', techniqueId: chainOptions[0].id };
      }
      return { choice: 'tighten', techniqueId: null };
    } else {
      const roll = Math.random();
      if (roll < 0.6) return { choice: 'tighten', techniqueId: null };
      if (roll < 0.9 || chainOptions.length === 0) return { choice: 'adjust', techniqueId: null };
      return { choice: 'chain_sub', techniqueId: chainOptions[0].id };
    }
  } else {
    const counterOptions = await getCounterOptions(botId, botPos);
    if (Math.random() < diff) {
      const tighten = match.sub_tighten_turns || 0;
      if (counterOptions.length > 0 && Math.random() < 0.25) {
        return { choice: 'counter', techniqueId: counterOptions[0].id };
      } else if (tighten >= 3) {
        return { choice: 'explode', techniqueId: null };
      }
      return { choice: 'escape', techniqueId: null };
    } else {
      const roll = Math.random();
      if (roll < 0.45) return { choice: 'escape', techniqueId: null };
      if (roll < 0.70) return { choice: 'survive', techniqueId: null };
      if (roll < 0.90 || counterOptions.length === 0) return { choice: 'explode', techniqueId: null };
      return { choice: 'counter', techniqueId: counterOptions[0].id };
    }
  }
}

// ── SURVIVE / SPAZ ───────────────────────────────────────────
function pickSurviveOrSpaz(diff, botGP, personality = {}) {
  if (personality?.never_spaz) return '__survive__';
  if (botGP < 3) return '__survive__';
  if (Math.random() < diff) return '__survive__';
  return Math.random() < 0.4 ? '__spaz__' : '__survive__';
}

// ═══════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════
export const BotEngine = {
  // Variable wait — harder bots make you wait longer (anticipation IS difficulty)
  getThinkDelay(difficulty) {
    const diff = parseDifficulty(difficulty);
    const base = 1200 + (diff * 2000);
    return base + (Math.random() * 400 - 200);
  },
  get THINK_DELAY_MS() { return 800 + Math.random() * 1200; },

  updateMemory(matchId, playerMoveId, playerStance, playerPosition, botMoveId, turnNumber) {
    ensureMemoryForMatch(matchId);
    const tech = G.techniques[playerMoveId];
    professorMemory.playerMovesPlayed.push({
      position: playerPosition,
      moveId: playerMoveId,
      type: tech?.type || (playerMoveId === '__survive__' || playerMoveId === '__spaz__' ? 'universal' : 'unknown'),
      turn: turnNumber,
    });
    if (playerStance) {
      professorMemory.playerStancesPlayed.push({ position: playerPosition, stance: playerStance, turn: turnNumber });
    }
    professorMemory.positionVisitCount[playerPosition] =
      (professorMemory.positionVisitCount[playerPosition] || 0) + 1;
    if (botMoveId) {
      professorMemory.botMovesPlayed.push({ moveId: botMoveId, turn: turnNumber });
    }
    console.log('[PROFESSOR MEMORY]', {
      turn: turnNumber, playerMove: playerMoveId, playerPos: playerPosition,
      confirmedDeadEnds: professorMemory.playerMovesPlayed
        .filter(m => m.moveId === '__survive__' || m.moveId === '__spaz__').map(m => m.position),
      positionsVisited: Object.keys(professorMemory.positionVisitCount),
    });
  },

  async respondToStance(match, botId, botArchetype, difficulty, personality = {}) {
    await new Promise(r => setTimeout(r, this.getThinkDelay(difficulty)));
    const diff = parseDifficulty(difficulty);
    const isP1 = match.player1_id === botId;
    const botGP = isP1 ? (match.player1_gp ?? 10) : (match.player2_gp ?? 10);
    const oppGP = isP1 ? (match.player2_gp ?? 10) : (match.player1_gp ?? 10);
    const botPos = isP1 ? (match.player1_position || match.current_position) : (match.player2_position || match.current_position);

    ensureMemoryForMatch(match.id);

    const useProfessor = personality?.use_professor_ai || diff >= 0.90;
    let stance;
    if (useProfessor) {
      stance = pickStanceProfessor(botPos, botGP);
    } else {
      stance = pickStance(diff, botArchetype, botPos, botGP, oppGP, personality);
    }

    try {
      const { error } = await supabase.rpc('bot_submit_stance', {
        p_match_id: match.id, p_player_id: botId, p_stance: stance,
      });
      if (error) {
        console.error('Bot stance error:', error);
        await supabase.rpc('submit_stance', { p_match_id: match.id, p_stance: stance });
      }
      return stance;
    } catch (err) {
      console.error('Bot stance failed:', err);
      return null;
    }
  },

  async respondToMove(match, botId, botArchetype, botHand, drilledMoves, opponentStance, difficulty, personality = {}) {
    await new Promise(r => setTimeout(r, this.getThinkDelay(difficulty)));
    const diff = parseDifficulty(difficulty);
    const isP1 = match.player1_id === botId;
    const botGP = isP1 ? (match.player1_gp ?? 10) : (match.player2_gp ?? 10);
    const botPos = isP1 ? (match.player1_position || match.current_position) : (match.player2_position || match.current_position);

    ensureMemoryForMatch(match.id);

    console.log('Bot hand debug:', { position: botPos, handLength: botHand?.length, difficulty: diff });

    if (!botHand || botHand.length === 0) {
      const moveChoice = pickSurviveOrSpaz(diff, botGP, personality);
      console.log(`Bot has no moves — picking ${moveChoice} (GP: ${botGP}, diff: ${diff})`);
      try {
        const { error } = await supabase.rpc('bot_submit_move', {
          p_match_id: match.id, p_player_id: botId, p_technique_id: moveChoice, p_is_counter: false,
        });
        if (error) console.error('Bot universal move error:', error.message);
        return moveChoice;
      } catch (err) {
        console.error(`Bot ${moveChoice} failed:`, err);
        return '__survive__';
      }
    }

    const { data: techniques } = await supabase
      .from('techniques')
      .select('id, type, to_position, from_position')
      .in('id', botHand);

    let chosen;
    if (techniques && techniques.length > 0) {
      const useProfessor = personality?.use_professor_ai || diff >= 0.90;
      if (useProfessor) {
        chosen = await pickMoveProfessor(techniques, botId, botPos, botGP, drilledMoves);
      } else {
        chosen = await pickMove(diff, techniques, botArchetype, botId, botPos, botGP, drilledMoves, personality);
      }
      console.log('Bot chosen move:', chosen, '(diff:', diff, ')');
    } else {
      chosen = botHand[Math.floor(Math.random() * botHand.length)];
    }

    try {
      const { error } = await supabase.rpc('bot_submit_move', {
        p_match_id: match.id, p_player_id: botId, p_technique_id: chosen, p_is_counter: false,
      });
      if (error) console.error('Bot move error:', error);
      return chosen;
    } catch (err) {
      console.error('Bot move failed:', err);
      return null;
    }
  },

  async respondToSubMinigame(match, botId, isAttacker, difficulty) {
    await new Promise(r => setTimeout(r, 2000 + Math.random() * 1000));
    const diff = parseDifficulty(difficulty);

    ensureMemoryForMatch(match.id);

    const { choice, techniqueId } = await pickSubChoice(diff, match, botId, isAttacker);

    try {
      const rpcParams = { p_match_id: match.id, p_player_id: botId, p_choice: choice };
      if (techniqueId) rpcParams.p_technique_id = techniqueId;
      const { error } = await supabase.rpc('bot_submit_sub_choice', rpcParams);
      if (error) console.error('Bot sub choice error:', error);
      console.log('Bot sub choice:', choice, techniqueId ? `(tech: ${techniqueId})` : '', '(diff:', diff, ')');
      return choice;
    } catch (err) {
      console.error('Bot sub choice failed:', err);
      return null;
    }
  },
};

export default BotEngine;

import { sb as supabase } from './supabase';

/*
 * BotEngine — Phase 3.4
 * 
 * Client-side bot AI that responds to player moves in single-player matches.
 * When the human player locks a stance/move, the bot responds using the
 * service-role bot functions (bot_submit_stance, bot_submit_move, bot_submit_sub_choice).
 * 
 * Since we can't call service-role functions from the client, this module
 * uses the ANON key but calls the bot_ prefixed functions that accept
 * a player_id parameter. These functions must have SECURITY DEFINER with
 * an internal check that the target player is a bot.
 * 
 * Architecture:
 *   Player locks stance → BotEngine.respondToStance(match) → bot locks stance
 *   Player locks move → BotEngine.respondToMove(match) → bot locks move
 *   Both locked → resolve_turn() fires (existing trigger)
 * 
 * The bot logic mirrors the Python engine's decision-making:
 *   - Archetype-aware stance selection
 *   - Hand-based move selection (prioritizes drilled moves)
 *   - Smart counter picking based on opponent threats
 */

// Bot archetype strategies
const STANCE_WEIGHTS = {
  wrestler:          { attack: 0.6, defend: 0.1, setup: 0.3 },
  guard_puller:      { attack: 0.3, defend: 0.4, setup: 0.3 },
  leg_locker:        { attack: 0.5, defend: 0.2, setup: 0.3 },
  pressure_passer:   { attack: 0.5, defend: 0.2, setup: 0.3 },
  submission_hunter: { attack: 0.7, defend: 0.1, setup: 0.2 },
  scrambler:         { attack: 0.3, defend: 0.2, setup: 0.5 },
};

// Weighted random selection
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

// Archetype-aware move scoring
const ARCHETYPE_TYPE_SCORES = {
  submission_hunter: { submission: 5, transition: 2, escape: 1, sweep: 1, takedown: 0 },
  wrestler:          { takedown: 5, submission: 3, transition: 2, escape: 2, sweep: 0 },
  guard_puller:      { sweep: 5, submission: 4, transition: 2, escape: 2, takedown: 0 },
  pressure_passer:   { transition: 4, submission: 4, takedown: 3, escape: 1, sweep: 0 },
  leg_locker:        { submission: 5, transition: 4, escape: 1, sweep: 1, takedown: 0 },
  scrambler:         { transition: 4, sweep: 3, takedown: 3, escape: 2, submission: 1 },
};

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

const GP_COSTS = { transition: 1, sweep: 2, takedown: 2, submission: 3, escape: 1 };

function scoreMoveForArchetype(technique, archetype, currentPosition, botGP) {
  let score = 0;
  const type = technique.type;
  const to = technique.to_position || technique.to;

  // Base type scoring per archetype
  const scores = ARCHETYPE_TYPE_SCORES[archetype] || ARCHETYPE_TYPE_SCORES.scrambler;
  score += scores[type] || 0;

  // Bonus for advancing to a dominant position
  if (to && DOMINANT_POSITIONS.has(to)) {
    score += 1;
  }

  // Penalty when low on GP
  const cost = GP_COSTS[type] || 1;
  if (botGP <= cost + 1) {
    score -= 1;
  }

  // Random noise so bots aren't robotic (±1)
  score += Math.random() * 2 - 1;

  return score;
}

export const BotEngine = {
  // Delay to simulate "thinking" — computed fresh each call
  get THINK_DELAY_MS() { return 800 + Math.random() * 1200; },

  async respondToStance(match, botId, botArchetype) {
    await new Promise(r => setTimeout(r, this.THINK_DELAY_MS));

    const weights = STANCE_WEIGHTS[botArchetype] || STANCE_WEIGHTS.scrambler;
    const stance = weightedChoice(weights);

    try {
      const { error } = await supabase.rpc('bot_submit_stance', {
        p_match_id: match.id,
        p_player_id: botId,
        p_stance: stance,
      });

      if (error) {
        console.error('Bot stance error:', error);
        // Fallback: try regular submit as a hail mary
        await supabase.rpc('submit_stance', {
          p_match_id: match.id,
          p_stance: stance,
        });
      }

      return stance;
    } catch (err) {
      console.error('Bot stance failed:', err);
      return null;
    }
  },

  async respondToMove(match, botId, botArchetype, botHand, drilledMoves, opponentStance) {
    await new Promise(r => setTimeout(r, this.THINK_DELAY_MS));

    console.log('Bot hand debug:', { position: match.current_position, handLength: botHand?.length, botHand });
    if (!botHand || botHand.length === 0) {
      console.log('Bot has no moves in hand — calling resolve_survive...');
      try {
        const { data, error } = await supabase.rpc('resolve_survive', {
          p_match_id: match.id,
          p_player_id: botId,
        });
        if (error) console.error('Bot resolve_survive error:', error);
        else console.log('Bot resolve_survive result:', data);
        return null;
      } catch (err) {
        console.error('Bot resolve_survive failed:', err);
        return null;
      }
    }

    // Fetch technique details for scoring
    const { data: techniques } = await supabase
      .from('techniques')
      .select('id, type, to_position, from_position')
      .in('id', botHand);

    // Determine bot GP
    const isP1 = match.player1_id === botId;
    const botGP = isP1 ? match.player1_gp : match.player2_gp;

    let chosen;
    if (techniques && techniques.length > 0) {
      // Score each move using archetype-aware scoring
      const scored = techniques.map(t => ({
        ...t,
        score: scoreMoveForArchetype(t, botArchetype, match.current_position, botGP),
      }));
      scored.sort((a, b) => b.score - a.score);
      chosen = scored[0].id;
      console.log('Bot scored moves:', scored.map(s => `${s.id}(${s.type}):${s.score.toFixed(1)}`));
    } else {
      // Fallback to random if technique fetch fails
      chosen = botHand[Math.floor(Math.random() * botHand.length)];
    }

    try {
      console.log('Bot chosen move:', chosen);
      const { error } = await supabase.rpc('bot_submit_move', {
        p_match_id: match.id,
        p_player_id: botId,
        p_technique_id: chosen,
        p_is_counter: false,
      });

      if (error) {
        console.error('Bot move error:', error);
      }

      return chosen;
    } catch (err) {
      console.error('Bot move failed:', err);
      return null;
    }
  },

  async respondToSubMinigame(match, botId, isAttacker) {
    await new Promise(r => setTimeout(r, 2000 + Math.random() * 1000));

    // Bot sub choices — IDs must match the RPC/UI option IDs
    let choice;
    if (isAttacker) {
      // Attackers mostly squeeze, sometimes adjust
      const r = Math.random();
      choice = r < 0.55 ? 'squeeze' : r < 0.85 ? 'adjust' : 'transition_sub';
    } else {
      // Defenders prefer escape, sometimes explode
      const r = Math.random();
      choice = r < 0.35 ? 'technical_escape' : r < 0.6 ? 'explode' : r < 0.8 ? 'survive' : r < 0.9 ? 'sweep_scramble' : 'reversal_sub';
    }

    try {
      const { error } = await supabase.rpc('bot_submit_sub_choice', {
        p_match_id: match.id,
        p_player_id: botId,
        p_choice: choice,
      });

      if (error) console.error('Bot sub choice error:', error);
      return choice;
    } catch (err) {
      console.error('Bot sub choice failed:', err);
      return null;
    }
  },
};

export default BotEngine;

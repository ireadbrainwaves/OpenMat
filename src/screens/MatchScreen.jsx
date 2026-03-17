import React from 'react';
const { useState, useEffect, useRef, useCallback } = React;
import { sb, dbg, G, beltOrder, getStatus, drawHand } from '../lib/supabase';
import { FAMILY_COLORS, GP_COSTS, BELT_GP } from '../lib/constants';
import { T } from '../lib/tokens';
import { StanceIcon } from '../lib/icons';
import { Btn, Spinner, Center } from '../components/UI';
import { CompactCard } from '../components/MoveCard';
import BotEngine from '../lib/botEngine';
// Extracted match components
import ScoreHeader from './match/ScoreHeader';
import ResourceBar from './match/ResourceBar';
import { StancePick, StanceWait } from './match/StancePhase';
import SubMinigame from './match/SubMinigame';
import { RevealOverlay, TapOverlay, FinishOverlay, EscapedOverlay } from './match/MatchOverlays';

// ═══════════════════════════════════════════════════════════
// MATCH SCREEN — Production v2
// New UI from prototype, real Supabase integration
// ═══════════════════════════════════════════════════════════

// Position top/bottom label helper
function getPositionSuffix(positionId) {
  if (!positionId) return '';
  if (positionId.endsWith('_top')) return ' (Top)';
  if (positionId.endsWith('_bottom')) return ' (Bottom)';
  if (positionId === 'guard_closed') return ' (Bottom)';
  if (positionId === 'guard_closed_top') return ' (Top)';
  if (positionId === 'guard_half_bottom') return ' (Bottom)';
  if (positionId === 'guard_half_top') return ' (Top)';
  return '';
}

export default function MatchScreen({ profile, matchId, onEnd, isBot = false, botId: botIdProp = null }) {
  const [match, setMatch] = useState(null);
  const [opp, setOpp] = useState(null);
  const [deck, setDeck] = useState([]);
  const [sel, setSel] = useState(null);
  const [moves, setMoves] = useState([]);
  const [busy, setBusy] = useState(false);
  const [lastTurn, setLastTurn] = useState(null);
  const [turnHistory, setTurnHistory] = useState([]);
  const [subSel, setSubSel] = useState(null);
  const [subPickerFor, setSubPickerFor] = useState(null); // 'chain_sub' | 'counter' | null
  const [subPickerTechId, setSubPickerTechId] = useState(null); // selected technique in picker
  const [selectedStance, setSelectedStance] = useState(null);
  const [isBotMatch, setIsBotMatch] = useState(false);
  const [botId, setBotId] = useState(null);
  const [botArchetype, setBotArchetype] = useState(null);
  const [botDifficulty, setBotDifficulty] = useState(null);

  // Universal moves shown when hand is empty (not during sub minigame)
  const universalMoves = [
    { id: 'survive', name: 'Survive', type: 'universal', description: 'Hunker down. Rest and recover.', gp_cost: 0, gp_recovery: 1, is_universal: true },
    { id: 'spaz', name: 'Spaz', type: 'universal', description: 'Explosive escape. Costs 4 GP. If opponent subs — checkmate.', gp_cost: 4, gp_recovery: 0, is_universal: true },
  ];

  // Reveal overlay
  const [showReveal, setShowReveal] = useState(false);
  const [revealData, setRevealData] = useState(null);
  const [yourFlipped, setYourFlipped] = useState(false);
  const [oppFlipped, setOppFlipped] = useState(false);
  const [showResult, setShowResult] = useState(false);

  // Variant data: technique_id -> { variant_id, variant_name }
  const [variantMap, setVariantMap] = useState({});

  // TAP overlay
  const [tapOverlay, setTapOverlay] = useState(null); // { won: bool, subName: string, winnerName: string }
  const [finishOverlay, setFinishOverlay] = useState(null); // { won: bool, myPoints, oppPoints, method }

  // Sub choice reveal
  const [subReveal, setSubReveal] = useState(null); // { myChoice, oppChoice, isAttacker }
  const prevSubRoundRef = useRef(0);

  // Chain sub animation
  const [chainSub, setChainSub] = useState(null); // { oldName, newName }
  // Escaped overlay
  const [subEscaped, setSubEscaped] = useState(false);
  const prevSubTechRef = useRef(null);

  // Track what player locked in for the flip card display
  const lastLockedMoveRef = useRef(null);

  // Track last sub choice for reveal (in case server clears before we read)
  const lastSubChoiceRef = useRef(null);

  // Refs to avoid stale closures in polling/subscription
  const matchRef = useRef(null);
  const prevTurnRef = useRef(0);
  const revealTimerRef = useRef(null);
  const endedRef = useRef(false);

  // Keep matchRef in sync
  useEffect(() => { matchRef.current = match; }, [match]);

  // ── DERIVED ─────────────────────────────────────────────
  const amP1 = match?.player1_id === profile.id;
  const myPos = amP1 ? (match?.player1_position || match?.current_position) : (match?.player2_position || match?.current_position);
  const myPts = amP1 ? match?.player1_points : match?.player2_points;
  const oppPts = amP1 ? match?.player2_points : match?.player1_points;
  const myLocked = amP1 ? match?.player1_move_locked : match?.player2_move_locked;
  const myStanceLocked = amP1 ? match?.player1_stance_locked : match?.player2_stance_locked;
  const oppStanceVal = amP1 ? match?.player2_stance : match?.player1_stance;
  const myStanceVal = amP1 ? match?.player1_stance : match?.player2_stance;
  const phase = match?.turn_phase || 'stance';
  const pos = G.positions[myPos];
  const myStatus = getStatus(myPos, profile.archetype);
  const myGp = amP1 ? (match?.player1_gp ?? 10) : (match?.player2_gp ?? 10);
  const oppGp = amP1 ? (match?.player2_gp ?? 10) : (match?.player1_gp ?? 10);
  const myChain = amP1 ? (match?.player1_chain ?? 0) : (match?.player2_chain ?? 0);
  const gpMax = BELT_GP[profile.belt]?.max || 10;

  // Desperation mode: server tracks via player_desperation flag, fallback to GP < 0
  const myDesperation = amP1 ? match?.player1_desperation : match?.player2_desperation;
  const myLastMoveUsed = amP1 ? match?.player1_last_move_used : match?.player2_last_move_used;
  const isDesperation = myDesperation === true || myGp < 0;
  const isLastMove = myGp === 0 && !isDesperation;

  // Position-based GP recovery indicator (from positions table, graceful fallback)
  const posRecovery = (() => {
    if (!myPos || !pos) return 0;
    const isTop = myPos.includes('_top') || pos.family === 'standing' || myPos === 'scramble';
    return isTop ? (pos.gp_recovery_top ?? 0) : (pos.gp_recovery_bottom ?? 0);
  })();

  // Hand states:
  // 1. desperation (GP < 0) → survive only
  // 2. zero moves → survive + spaz
  // 3. moves + GP < 3 → normal hand + survive at bottom
  // 4. normal → full hand
  const inMovePhase = phase === 'move' && !myLocked && deck.length > 0 && myPos && !match?.sub_minigame_active && match?.status !== 'finished';
  const zeroMoves = inMovePhase && !isDesperation && moves.length === 0;
  const showSurviveExtra = inMovePhase && !isDesperation && moves.length > 0 && myGp < 3;
  if (phase === 'move') console.log('[UNIVERSAL CHECK]', { handLength: moves.length, myGP: myGp, zeroMoves, showSurviveExtra, isDesperation, isLastMove });

  const statusColor = { top: T.green, even: T.muted, bottom: T.amber };

  // ── CORE: Refresh match + turns from DB ─────────────────
  const refreshMatch = useCallback(async () => {
    const { data: m } = await sb.from('matches').select('*').eq('id', matchId).single();
    if (!m) return;

    const { data: t } = await sb.from('match_turns').select('*').eq('match_id', matchId).order('turn_number');
    if (t) { setTurnHistory(t); if (t.length > 0) setLastTurn(t[t.length - 1]); }

    // Check if turn advanced -> trigger reveal
    if (m.current_turn > prevTurnRef.current && t && t.length > 0) {
      const latestTurn = t[t.length - 1];
      triggerReveal(latestTurn, m);
      prevTurnRef.current = m.current_turn;
    }

    // Detect sub round advancement — show both choices
    const prev = matchRef.current;
    if (prev && m.sub_minigame_active && prev.sub_phase !== undefined && m.sub_phase > prev.sub_phase) {
      const isAtt = m.sub_attacker_id === profile.id;
      const myC = isAtt ? prev.sub_attacker_choice : prev.sub_defender_choice;
      const oppC = isAtt ? prev.sub_defender_choice : prev.sub_attacker_choice;
      if (myC || oppC) {
        console.log('[SUB]', { sub_phase: m.sub_phase, tighten: m.sub_tighten_turns, active: m.sub_minigame_active, round: m.sub_phase, myChoice: myC, oppChoice: oppC });
        setSubReveal({ myChoice: myC, oppChoice: oppC, isAttacker: isAtt });
        setTimeout(() => setSubReveal(null), 1500);
      }
    }
    // Also detect sub ending — show final choices (use ref fallback if server cleared)
    if (prev && prev.sub_minigame_active && !m.sub_minigame_active) {
      const isAtt = prev.sub_attacker_id === profile.id;
      const myC = (isAtt ? prev.sub_attacker_choice : prev.sub_defender_choice) || lastSubChoiceRef.current;
      const oppC = isAtt ? prev.sub_defender_choice : prev.sub_attacker_choice;
      console.log('[SUB END]', { myChoice: myC, oppChoice: oppC, isAttacker: isAtt, lastSubChoice: lastSubChoiceRef.current });
      if (myC || oppC) {
        setSubReveal({ myChoice: myC, oppChoice: oppC, isAttacker: isAtt });
        setTimeout(() => setSubReveal(null), 2000);
      }
      // Show ESCAPED overlay if sub ended without a submission finish
      const subFinished = m.status === 'finished' && (m.win_method === 'submission' || m.result_method === 'submission');
      if (!subFinished) {
        setSubEscaped(true);
        setTimeout(() => setSubEscaped(false), 1500);
      }
      lastSubChoiceRef.current = null;
    }
    prevSubRoundRef.current = m.sub_phase || 0;

    // Detect chain sub — sub_technique_id changed during active minigame
    if (prev && m.sub_minigame_active && prev.sub_technique_id && m.sub_technique_id && m.sub_technique_id !== prev.sub_technique_id) {
      const oldTech = G.techniques[prev.sub_technique_id];
      const newTech = G.techniques[m.sub_technique_id];
      setChainSub({ oldName: oldTech?.name || 'Submission', newName: newTech?.name || 'Submission' });
      setTimeout(() => setChainSub(null), 2000);
    }
    prevSubTechRef.current = m.sub_technique_id || null;

    setMatch(m);
    setSel(null); setSelectedStance(null); setSubSel(null); setSubPickerFor(null); setSubPickerTechId(null);

    // Handle match end — check for submission finish to show TAP overlay, or general finish
    if (m.status === 'finished' && !endedRef.current) {
      endedRef.current = true;
      const winMethod = m.win_method || m.result_method || m.method || m.finish_method || m.result || '';
      console.log('[MATCH END CHECK]', { status: m.status, winner: m.winner_id, win_method: m.win_method, result_method: m.result_method, method: m.method, finish_method: m.finish_method, result: m.result, sub_technique_id: m.sub_technique_id });
      dbg('Match finished! method=' + winMethod, 'ok');
      if (winMethod === 'submission' || m.sub_technique_id) {
        const iWon = m.winner_id === profile.id;
        const subTech = m.sub_technique_id ? G.techniques[m.sub_technique_id] : null;
        setTapOverlay({
          won: iWon,
          subName: subTech?.name || 'Submission',
          winnerName: iWon ? (profile.display_name || 'You') : (opp?.display_name || 'Opponent'),
        });
        setTimeout(() => { setTapOverlay(null); onEnd(m); }, 2500);
      } else {
        // Non-submission finish — show general finish overlay
        const iWon = m.winner_id === profile.id;
        const isP1 = m.player1_id === profile.id;
        const myPts = isP1 ? (m.player1_points || 0) : (m.player2_points || 0);
        const oppPts = isP1 ? (m.player2_points || 0) : (m.player1_points || 0);
        setFinishOverlay({
          won: iWon,
          myPoints: myPts,
          oppPoints: oppPts,
          method: winMethod || 'points',
        });
        setTimeout(() => { setFinishOverlay(null); onEnd(m); }, 3000);
      }
    }
  }, [matchId]);

  // ── INITIAL LOAD ────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { data: m } = await sb.from('matches').select('*').eq('id', matchId).single();
      if (m) { setMatch(m); matchRef.current = m; prevTurnRef.current = m.current_turn; }
      const oppId = m?.player1_id === profile.id ? m?.player2_id : m?.player1_id;
      const { data: o } = await sb.from('profiles').select('*').eq('id', oppId).single();
      if (o) {
        setOpp(o);
        if (o.is_bot) {
          setIsBotMatch(true);
          setBotId(oppId);
          setBotArchetype(o.archetype);
          setBotDifficulty(o.bot_difficulty || 'easy');
        }
      }
      const { data: d } = await sb.from('player_move_stacks').select('technique_id, tier, equipped_variant').eq('profile_id', profile.id);
      if (d) {
        setDeck(d);
        const withVariants = d.filter(r => r.equipped_variant);
        if (withVariants.length > 0) {
          const variantIds = withVariants.map(r => r.equipped_variant);
          const { data: variants } = await sb.from('technique_variants').select('id, name, technique_id').in('id', variantIds);
          if (variants) {
            const vMap = {};
            for (const v of variants) { vMap[v.technique_id] = { variant_id: v.id, variant_name: v.name }; }
            setVariantMap(vMap);
          }
        }
      }
      const { data: t } = await sb.from('match_turns').select('*').eq('match_id', matchId).order('turn_number');
      if (t) { setTurnHistory(t); if (t.length > 0) setLastTurn(t[t.length - 1]); }
    })();
  }, [matchId]);

  // ── REALTIME + POLLING FALLBACK ─────────────────────────
  useEffect(() => {
    const ch = sb.channel('match-' + matchId).on('postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'matches', filter: 'id=eq.' + matchId },
      () => { dbg('RT event received', 'ok'); refreshMatch(); }
    ).subscribe();

    const poll = setInterval(async () => {
      const { data: m } = await sb.from('matches').select('current_turn, turn_phase, status, player1_move_locked, player2_move_locked, player1_stance_locked, player2_stance_locked, sub_minigame_active, sub_phase, sub_tighten_turns, sub_attacker_locked, sub_defender_locked').eq('id', matchId).single();
      if (!m || !matchRef.current) return;
      const prev = matchRef.current;
      if (m.current_turn !== prev.current_turn || m.turn_phase !== prev.turn_phase || m.status !== prev.status ||
          m.player1_move_locked !== prev.player1_move_locked || m.player2_move_locked !== prev.player2_move_locked ||
          m.player1_stance_locked !== prev.player1_stance_locked || m.player2_stance_locked !== prev.player2_stance_locked ||
          m.sub_minigame_active !== prev.sub_minigame_active || m.sub_phase !== prev.sub_phase ||
          m.sub_tighten_turns !== prev.sub_tighten_turns || m.sub_attacker_locked !== prev.sub_attacker_locked || m.sub_defender_locked !== prev.sub_defender_locked) {
        dbg('Poll detected change -- refreshing', 'ok');
        refreshMatch();
      }
    }, 2000);

    return () => { sb.removeChannel(ch); clearInterval(poll); };
  }, [matchId, refreshMatch]);

  // ── REVEAL ──────────────────────────────────────────────
  function parseVariant(desc) {
    if (!desc) return null;
    const m = desc.match(/\[VARIANT:\s*(.+?)\]/);
    return m ? m[1].trim() : null;
  }

  function triggerReveal(turn, freshMatch) {
    const m = freshMatch || matchRef.current;
    const isP1 = m?.player1_id === profile.id;
    const variantName = parseVariant(turn.description);

    // Use match fields OR match_turns fields for move IDs (server may clear match fields after resolve)
    const myMoveId = (isP1 ? m?.player1_move : m?.player2_move) || (isP1 ? turn.player1_technique_id : turn.player2_technique_id) || (isP1 ? turn.player1_move : turn.player2_move);
    const oppMoveId = (isP1 ? m?.player2_move : m?.player1_move) || (isP1 ? turn.player2_technique_id : turn.player1_technique_id) || (isP1 ? turn.player2_move : turn.player1_move);
    const myTech = myMoveId ? G.techniques[myMoveId] : null;
    const oppTech = oppMoveId ? G.techniques[oppMoveId] : null;
    // Fallback to lastLockedMoveRef if all fields are empty
    const fallback = lastLockedMoveRef.current || { name: 'Your Move', type: 'unknown' };
    const myMoveName = myMoveId === '__survive__' ? 'Survive' : myMoveId === '__spaz__' ? 'Spaz' : (myTech?.name || fallback.name);
    const myMoveType = myMoveId === '__survive__' || myMoveId === '__spaz__' ? 'universal' : (myTech?.type || fallback.type);
    const oppMoveName = oppMoveId === '__survive__' ? 'Survive' : oppMoveId === '__spaz__' ? 'Spaz' : (oppTech?.name || 'Defended');
    const oppMoveType = oppMoveId === '__survive__' || oppMoveId === '__spaz__' ? 'universal' : (oppTech?.type || 'unknown');

    // Build better description — avoid generic "escaped" unless escape-type technique
    let cleanDesc = turn.description ? turn.description.replace(/\s*\[VARIANT:\s*.+?\]/, '').trim() : 'Position holds';
    if (cleanDesc.toLowerCase().includes('escaped') && oppTech && oppTech.type !== 'escape') {
      // Replace misleading "escaped" with a counter description
      if (oppTech && myTech) {
        cleanDesc = `${myMoveName} countered by ${oppMoveName}!`;
      }
    }
    // If description is very generic, enhance it
    if (!cleanDesc || cleanDesc === 'Position holds') {
      if (myTech && turn.result === 'sweep') cleanDesc = `${myMoveName} lands!`;
      else if (myTech && turn.result === 'submission_win') cleanDesc = `${myMoveName} locked in!`;
      else if (oppTech && myTech) cleanDesc = `${myMoveName} vs ${oppMoveName}`;
    }

    // Look up new position name for display
    const newPos = m?.current_position ? G.positions[m.current_position] : null;
    const newPosName = newPos?.name?.replace(/ \(.*\)/, '') || null;

    console.log('[REVEAL]', { isPlayer1: isP1, myMoveId, oppMoveId, myMoveName, oppMoveName, description: cleanDesc, turnFields: { p1_tech: turn.player1_technique_id, p2_tech: turn.player2_technique_id, p1_move: turn.player1_move, p2_move: turn.player2_move } });
    console.log('[REVEAL CARD]', { opponentStance: isP1 ? m?.player2_stance : m?.player1_stance, opponentMove: oppMoveId, oppMoveName, oppMoveType });

    // Feed Professor memory: what the player played, from where, and what the bot played
    if (isBotMatch && myMoveId) {
      const playerPos = turn.position_before || (isP1 ? turn.player1_position : turn.player2_position) || m?.current_position;
      const playerStance = isP1 ? m?.player1_stance : m?.player2_stance;
      BotEngine.updateMemory(matchId, myMoveId, playerStance, playerPos, oppMoveId, turn.turn_number);
    }

    setRevealData({ description: cleanDesc, result: turn.result, turn: turn.turn_number, myMoveName, myMoveType, variantName: variantName || fallback.variantName, oppMoveName, oppMoveType, newPosName });
    setYourFlipped(false); setOppFlipped(false); setShowResult(false);
    setShowReveal(true);
    setTimeout(() => setYourFlipped(true), 400);
    setTimeout(() => setOppFlipped(true), 750);
    setTimeout(() => setShowResult(true), 1200);
    if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    revealTimerRef.current = setTimeout(dismissReveal, 4500);
    lastLockedMoveRef.current = null;
  }

  function dismissReveal() {
    if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    setShowReveal(false); setRevealData(null);
    setYourFlipped(false); setOppFlipped(false); setShowResult(false);
    if (matchRef.current?.status === 'finished' && !endedRef.current) {
      endedRef.current = true;
      setTimeout(() => onEnd(matchRef.current), 500);
    }
  }

  // ── MOVES ───────────────────────────────────────────────
  const deckIds = deck.map(d => d.technique_id);
  const deckTiers = {};
  deck.forEach(d => { deckTiers[d.technique_id] = d.tier || 'trained'; });

  // Drilled moves from match state
  const myDrilled = amP1 ? (match?.player1_drilled_moves || []) : (match?.player2_drilled_moves || []);

  useEffect(() => {
    if (myPos && deck.length > 0) {
      console.log('[HAND] drawHand — position:', myPos, 'drilled:', myDrilled.length, 'deckIds:', deckIds.length);
      let m = drawHand(myPos, profile.belt, deckIds, deckTiers, match?.status === 'overtime', profile.archetype, myDrilled);
      console.log('[HAND] drawHand result:', m.length, 'moves:', m.map(x => x.name + '(' + x.type + ')'));
      console.log('[HAND FINAL]', { position: myPos, stance: myStanceVal, movesBeforeRender: m.length, deckSize: deckIds.length, belt: profile.belt });
      if (m.length === 0) {
        for (const dp of ['defending_clinch', 'defending_passing', 'defending_leg_entanglement', 'defending_back', 'defending_mount']) {
          const defMoves = drawHand(dp, profile.belt, deckIds, deckTiers, false, profile.archetype, myDrilled);
          if (defMoves.length > 0) { m = defMoves; console.log('[HAND] fallback hit:', dp, defMoves.length); break; }
        }
      }
      setMoves(m);
    }
  }, [myPos, deck, match?.status, match?.current_turn]);

  // (Old auto-survive removed — player now chooses between Survive and Spaz universal moves)

  const oppTendency = turnHistory.slice(-3).map(t => amP1 ? t.player2_stance : t.player1_stance).filter(Boolean);

  // ── ACTIONS ─────────────────────────────────────────────
  async function lockStance(stance) {
    if (busy) return; setSelectedStance(stance); setBusy(true);
    const { error } = await sb.rpc('submit_stance', { p_match_id: matchId, p_stance: stance });
    if (error) dbg('Stance error: ' + error.message, 'err');
    if (!error && isBotMatch) {
      BotEngine.respondToStance(matchRef.current, botId, botArchetype, botDifficulty);
    }
    setBusy(false);
  }

  async function lockMove() {
    if (!sel || busy) return; setBusy(true);

    // Handle universal moves (survive / spaz) — submit through normal move flow
    if (sel.is_universal) {
      const uMove = universalMoves.find(u => u.id === sel.id);
      lastLockedMoveRef.current = { name: uMove?.name || sel.id, type: 'universal', variantName: null };
      const techId = sel.id === 'survive' ? '__survive__' : '__spaz__';
      console.log('[UNIVERSAL]', sel.id, '— submitting as', techId);

      const { error } = await sb.rpc('submit_move', {
        p_match_id: matchId,
        p_technique_id: techId,
        p_is_counter: false,
        p_is_bait: false,
        p_feint_move: null,
      });
      if (error) dbg('Universal move error: ' + error.message, 'err');

      // Bot response — same as normal moves
      if (!error && isBotMatch) {
        const m = matchRef.current;
        const botDrills = m?.player1_id === botId ? (m?.player1_drilled_moves || []) : (m?.player2_drilled_moves || []);
        const botPos = m?.player1_id === botId ? (m?.player1_position || m?.current_position) : (m?.player2_position || m?.current_position);
        const { data: botHand } = await sb.rpc('draw_hand', {
          p_profile_id: botId,
          p_position: botPos || m?.current_position,
          p_archetype: botArchetype,
          p_drilled_moves: botDrills,
        });
        await BotEngine.respondToMove(m, botId, botArchetype, botHand, botDrills, myStanceVal, botDifficulty);
        setTimeout(() => refreshMatch(), 500);
      }
      setBusy(false);
      return;
    }

    // Normal move
    const allM = [...moves];
    const played = allM.find(m => m.id === sel.id);
    const variant = variantMap[sel.id];
    lastLockedMoveRef.current = played
      ? { name: played.name, type: played.type || 'unknown', variantName: variant?.variant_name || null }
      : { name: '???', type: 'unknown', variantName: null };
    const { error } = await sb.rpc('submit_move', { p_match_id: matchId, p_technique_id: sel.id, p_is_counter: false, p_is_bait: false, p_feint_move: null });
    if (error) dbg('Move error: ' + error.message, 'err');
    if (!error && isBotMatch) {
      const m = matchRef.current;
      const botDrills = m?.player1_id === botId ? (m?.player1_drilled_moves || []) : (m?.player2_drilled_moves || []);
      const botPos = m?.player1_id === botId ? (m?.player1_position || m?.current_position) : (m?.player2_position || m?.current_position);
      const { data: botHand } = await sb.rpc('draw_hand', {
        p_profile_id: botId,
        p_position: botPos || m?.current_position,
        p_archetype: botArchetype,
        p_drilled_moves: botDrills,
      });
      await BotEngine.respondToMove(m, botId, botArchetype, botHand, botDrills, myStanceVal, botDifficulty);
      setTimeout(() => refreshMatch(), 500);
    }
    setBusy(false);
  }

  // Get chain sub options: other submissions from the current sub's position that are in player's deck
  function getChainSubOptions() {
    if (!match?.sub_technique_id) return [];
    const currentSub = G.techniques[match.sub_technique_id];
    if (!currentSub) return [];
    const fromPos = currentSub.from_position;
    const allFromPos = G.techFrom[fromPos] || [];
    return allFromPos.filter(t =>
      t.type === 'submission' &&
      t.id !== match.sub_technique_id &&
      deckIds.includes(t.id)
    );
  }

  // Get counter options: sweeps and submissions from defender's position that are in player's deck
  function getCounterOptions() {
    const defPos = amP1 ? (match?.player1_position || match?.current_position) : (match?.player2_position || match?.current_position);
    if (!defPos) return [];
    const allFromPos = G.techFrom[defPos] || [];
    return allFromPos.filter(t =>
      (t.type === 'submission' || t.type === 'sweep') &&
      deckIds.includes(t.id)
    );
  }

  async function lockSubChoice() {
    if (!subSel || busy) return;
    // If chain_sub or reversal_sub selected but no technique picked yet, open picker
    if ((subSel === 'chain_sub' || subSel === 'counter') && !subPickerTechId) {
      setSubPickerFor(subSel);
      return;
    }
    setBusy(true);
    lastSubChoiceRef.current = subSel;
    const rpcParams = { p_match_id: matchId, p_choice: subSel };
    if (subPickerTechId) rpcParams.p_technique_id = subPickerTechId;
    const { error } = await sb.rpc('submit_sub_choice', rpcParams);
    if (error) {
      dbg('Sub err: ' + error.message, 'err');
    } else {
      setSubSel(null);
      setSubPickerFor(null);
      setSubPickerTechId(null);
      if (isBotMatch && match?.sub_minigame_active) {
        const botIsAttacker = match.sub_attacker_id === botId;
        await BotEngine.respondToSubMinigame(match, botId, botIsAttacker, botDifficulty);
        setTimeout(() => refreshMatch(), 500);
      }
    }
    setBusy(false);
  }

  function getEffGP(m) {
    const base = m.gp_cost || GP_COSTS[m.type] || 1;
    const tier = deckTiers[m.id];
    if (tier === 'drilled') return Math.max(1, base - 1);
    if (tier === 'known') return base + 1;
    return base;
  }

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════
  if (!match || !opp) return (
    <Center><Spinner size={30} /><div style={{ color: T.muted, fontSize: 13, fontFamily: T.body }}>Loading match...</div></Center>
  );

  const gpPct = Math.max(0, (myGp / gpMax) * 100);
  const gpColor = isDesperation ? '#ff2222' : myGp <= 2 ? T.red : myGp <= 5 ? T.amber : T.green;

  const showingStancePick = phase === 'stance' && !myStanceLocked && match.status !== 'finished';
  const showingStanceWait = phase === 'stance' && myStanceLocked && match.status !== 'finished';
  const showingMovePick = phase === 'move' && !myLocked && match.status !== 'finished';
  const showingMoveWait = phase === 'move' && myLocked && match.status !== 'finished';
  const showingSub = phase === 'sub_minigame' && match.sub_minigame_active;
  console.log('[SUB CHECK] turn_phase:', match.turn_phase);
  console.log('[SUB CHECK] sub_minigame_active:', match.sub_minigame_active);
  console.log('[SUB CHECK] sub_attacker_id:', match.sub_attacker_id);
  console.log('[SUB CHECK] sub_technique_id:', match.sub_technique_id);
  console.log('[SUB CHECK] current user is:', profile.id === match.sub_attacker_id ? 'ATTACKER' : 'DEFENDER');
  console.log('[SUB CHECK] showingSub:', showingSub);

  const F = {
    display: { fontFamily: T.display },
    mono: { fontFamily: T.mono },
    body: { fontFamily: T.body },
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', background: T.bg }}>

      {/* ═══ SCORE HEADER ═══ */}
      <ScoreHeader match={match} profile={profile} opp={opp} myPts={myPts} oppPts={oppPts} />

      {/* ═══ RESOURCE BAR ═══ */}
      <ResourceBar myGp={myGp} gpMax={gpMax} gpColor={gpColor} gpPct={gpPct} isDesperation={isDesperation} posRecovery={posRecovery} myStanceVal={myStanceVal} myChain={myChain} oppGp={oppGp} />

      {/* ═══ POSITION ═══ */}
      <div style={{ flexShrink: 0, position: 'relative', height: 56, borderBottom: `1px solid ${T.border}`, background: T.surface, display: 'flex', alignItems: 'flex-end', padding: '0 18px 8px', justifyContent: 'space-between' }}>
        <div>
          <div style={{ ...F.display, fontSize: 17, color: T.text, lineHeight: 1, marginBottom: 2 }}>{(pos?.name?.replace(/ \(.*\)/, '') || 'Unknown') + getPositionSuffix(myPos)}</div>
          <div style={{ ...F.mono, fontSize: 8, color: FAMILY_COLORS[pos?.family] || T.muted, textTransform: 'uppercase' }}>{pos?.family?.replace('_', ' ')}</div>
        </div>
        <span style={{ ...F.mono, fontSize: 8, padding: '3px 8px', border: '1px solid', borderRadius: 3, textTransform: 'uppercase', fontWeight: 500, color: statusColor[myStatus] || T.muted, borderColor: (statusColor[myStatus] || T.muted) + '66', background: (statusColor[myStatus] || T.muted) + '0C' }}>{myStatus}</span>
      </div>

      {/* ═══ PHASE CONTENT ═══ */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>

        {/* ── STANCE PICK ────────────────────────────────── */}
        {showingStancePick && (
          <StancePick selectedStance={selectedStance} busy={busy} lockStance={lockStance} oppTendency={oppTendency} />
        )}

        {/* ── STANCE WAIT ────────────────────────────────── */}
        {showingStanceWait && <StanceWait />}

        {/* ── MOVE PICK ──────────────────────────────────── */}
        {showingMovePick && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* Revealed stances */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, padding: '7px 18px', borderBottom: `1px solid ${T.border}`, flexShrink: 0, background: T.surface }}>
              {[['You', myStanceVal], ['Opp', oppStanceVal]].map(([who, stance], idx) => (
                <React.Fragment key={who}>
                  {idx === 1 && <span style={{ ...F.mono, fontSize: 8, color: T.dim }}>vs</span>}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <StanceIcon stance={stance} size={14} />
                    <span style={{ ...F.mono, fontSize: 8, color: T.dim, textTransform: 'uppercase' }}>{who}</span>
                    <span style={{ ...F.mono, fontSize: 9, padding: '3px 7px', borderRadius: 3, fontWeight: 600, textTransform: 'uppercase',
                      background: stance === 'attack' ? T.red + '18' : stance === 'setup' ? T.blue + '14' : T.muted + '18',
                      color: stance === 'attack' ? T.red : stance === 'setup' ? T.blue : T.muted,
                    }}>{stance === 'attack' ? 'ATK' : stance === 'defend' ? 'DEF' : 'SET'}</span>
                  </div>
                </React.Fragment>
              ))}
            </div>

            {/* DESPERATION MODE: gassed, survive only */}
            {isDesperation && inMovePhase && (
              <div style={{ flex: 1, overflowY: 'auto', padding: '6px 18px 0', minHeight: 0 }}>
                <div style={{ textAlign: 'center', padding: '16px 12px', marginBottom: 12, background: '#ff222210', border: '2px solid #ff222240', borderRadius: 10, animation: 'desperationPulse 2s ease-in-out infinite' }}>
                  <div style={{ ...F.display, fontSize: 24, color: '#ff2222', letterSpacing: '0.1em' }}>EXHAUSTED</div>
                  <div style={{ ...F.mono, fontSize: 10, color: T.red, marginTop: 4 }}>Survive and recover — need 2 GP for moves</div>
                  <div style={{ ...F.mono, fontSize: 9, color: T.dim, marginTop: 6 }}>
                    GP: {myGp} · Recovery: {posRecovery > 0 ? `+${posRecovery}` : posRecovery}/turn
                    {myStanceVal === 'setup' ? ' +2 setup' : ''}
                  </div>
                </div>
                {(() => {
                  const isSel = sel?.id === 'survive' && sel?.is_universal;
                  return (
                    <div onClick={() => setSel({ id: 'survive', is_universal: true })}
                      style={{
                        padding: '14px 14px', borderRadius: 10, cursor: 'pointer', transition: 'all 0.15s',
                        border: `2px dashed ${isSel ? '#457B9D' : '#457B9D60'}`,
                        background: isSel ? '#457B9D12' : T.surface + '80',
                      }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                        <span style={{ fontSize: 20 }}>{'\u{1F6E1}'}</span>
                        <span style={{ ...F.display, fontSize: 16, color: T.text }}>Survive</span>
                        {isSel && <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#457B9D', display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: 'auto' }}>
                          <svg viewBox="0 0 12 12" width={7} height={7}><path d="M2 6L5 9L10 3" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        </div>}
                      </div>
                      <div style={{ ...F.mono, fontSize: 10, color: T.muted }}>Hunker down. Rest and recover.</div>
                      <div style={{ ...F.mono, fontSize: 9, color: '#457B9D', marginTop: 4 }}>0 GP · Recovering...</div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* LAST MOVE WARNING: GP = 0, one more move then desperation */}
            {isLastMove && inMovePhase && (
              <div style={{ padding: '6px 18px 0', flexShrink: 0 }}>
                <div style={{ textAlign: 'center', padding: '8px 12px', background: '#ff222012', border: '1px solid #ff222040', borderRadius: 6, animation: 'lastMovePulse 1.5s ease-in-out infinite' }}>
                  <div style={{ ...F.display, fontSize: 14, color: '#ff2222', letterSpacing: '0.08em' }}>LAST MOVE</div>
                  <div style={{ ...F.mono, fontSize: 9, color: T.red }}>0 GP — choose wisely, then you're gassed</div>
                </div>
              </div>
            )}

            {/* State 3: Zero moves — Survive + Spaz */}
            {zeroMoves && (
              <div style={{ flex: 1, overflowY: 'auto', padding: '6px 18px 0', minHeight: 0 }}>
                <div style={{ textAlign: 'center', marginBottom: 12 }}>
                  <div style={{ ...F.display, fontSize: 20, color: T.text }}>No Moves Available</div>
                  <div style={{ ...F.mono, fontSize: 10, color: T.dim, marginTop: 4 }}>Choose a last-resort option</div>
                </div>
                {universalMoves.map(u => {
                  const isSurvive = u.id === 'survive';
                  const canAfford = myGp >= u.gp_cost;
                  const isSel = sel?.id === u.id;
                  const borderColor = isSurvive ? '#457B9D' : '#E63946';
                  return (
                    <div key={u.id} onClick={() => canAfford && setSel({ id: u.id, is_universal: true })}
                      style={{
                        padding: '14px 14px', borderRadius: 10, marginBottom: 8, cursor: canAfford ? 'pointer' : 'default',
                        opacity: canAfford ? 1 : 0.35, transition: 'all 0.15s',
                        border: `2px dashed ${isSel ? borderColor : borderColor + '60'}`,
                        background: isSel ? borderColor + '12' : T.surface + '80',
                      }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                        <span style={{ fontSize: 20 }}>{isSurvive ? '\u{1F6E1}' : '\u{1F4A5}'}</span>
                        <span style={{ ...F.display, fontSize: 16, color: T.text }}>{u.name}</span>
                        {isSel && <div style={{ width: 14, height: 14, borderRadius: '50%', background: borderColor, display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: 'auto' }}>
                          <svg viewBox="0 0 12 12" width={7} height={7}><path d="M2 6L5 9L10 3" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        </div>}
                      </div>
                      <div style={{ ...F.mono, fontSize: 10, color: T.muted, marginBottom: 4 }}>{u.description}</div>
                      <div style={{ ...F.mono, fontSize: 9, color: isSurvive ? '#457B9D' : (canAfford ? '#E63946' : T.dim) }}>
                        {isSurvive ? '0 GP \u2022 +1 recovery' : canAfford ? '4 GP \u2022 CHECKMATE RISK' : 'Not enough GP'}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* States 1 & 2: Normal hand (+ survive at bottom when GP < 3) */}
            {!zeroMoves && (
              <div style={{ flex: 1, overflowY: 'auto', padding: '6px 18px 0', minHeight: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ ...F.mono, fontSize: 9, color: T.muted, textTransform: 'uppercase' }}>Your Hand</span>
                  <span style={{ ...F.mono, fontSize: 9, color: T.dim }}>{moves.length} moves</span>
                </div>

                {console.log('[HAND DEBUG]', { stance: myStanceVal, movesCount: moves.length, moves: moves.map(m => m.name + '(' + m.type + ')') })}
                <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 8, scrollSnapType: 'x mandatory' }}>
                {moves.map(m => {
                  const tier = deckTiers[m.id] || 'trained';
                  const isDrilled = myDrilled.includes(m.id);
                  const effectiveTier = isDrilled ? 'drilled' : tier;
                  const effGP = getEffGP(m);
                  const baseGP = m.gp_cost || GP_COSTS[m.type] || 1;
                  const gpMod = effGP - baseGP;
                  const isSel = sel?.id === m.id && !sel?.isCounter;
                  const hasVariant = !!variantMap[m.id];

                  return (
                    <div key={m.id} style={{ scrollSnapAlign: 'start' }}>
                      <CompactCard
                        move={{ ...m, name: hasVariant ? variantMap[m.id].variant_name : m.name }}
                        type={m.type}
                        tier={effectiveTier}
                        gp={baseGP}
                        gpMod={gpMod}
                        selected={isSel}
                        variant={hasVariant ? m.name : null}
                        onClick={() => setSel({ id: m.id, isCounter: false })}
                        currentGP={myGp}
                        belt={profile.belt}
                        playerArchetype={profile.archetype}
                        playerPosition={myPos}
                        chainCount={myChain}
                        hasVariant={hasVariant}
                        variantBonus={hasVariant ? 0.20 : 0}
                      />
                    </div>
                  );
                })}
                </div>

                {/* State 2: Survive card at bottom when GP < 3 */}
                {showSurviveExtra && (() => {
                  const isSel = sel?.id === 'survive' && sel?.is_universal;
                  return (
                    <>
                      <div style={{ height: 1, background: T.border, margin: '10px 0 8px' }} />
                      <div onClick={() => setSel({ id: 'survive', is_universal: true })}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 6, marginBottom: 4,
                          cursor: 'pointer', transition: 'all 0.15s',
                          border: `1.5px dashed ${isSel ? '#457B9D' : '#457B9D60'}`,
                          background: isSel ? '#457B9D12' : 'transparent',
                        }}>
                        <span style={{ fontSize: 14 }}>{'\u{1F6E1}'}</span>
                        <span style={{ ...F.body, fontSize: 11, fontWeight: 500, color: isSel ? T.text : T.muted }}>Survive</span>
                        <span style={{ ...F.mono, fontSize: 9, color: '#457B9D', marginLeft: 'auto' }}>Recover &bull; +1 GP</span>
                        {isSel && <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#457B9D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <svg viewBox="0 0 12 12" width={6} height={6}><path d="M2 6L5 9L10 3" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        </div>}
                      </div>
                    </>
                  );
                })()}

              </div>
            )}

            {/* Bottom lock-in */}
            {(
              <div style={{ flexShrink: 0, padding: '8px 18px 28px', borderTop: `1px solid ${T.border}`, background: `linear-gradient(0deg, ${T.bg}, ${T.surface})` }}>
                <Btn onClick={lockMove} disabled={!sel || busy} style={{ animation: sel ? 'pulseGlow 2s infinite' : 'none' }}>
                  {busy ? <Spinner /> : sel?.is_universal ? `Lock In ${sel.id === 'survive' ? 'Survive' : 'Spaz'}` : sel ? 'Lock In Move' : 'Select a Move'}
                </Btn>
              </div>
            )}
          </div>
        )}

        {/* ── MOVE WAIT ──────────────────────────────────── */}
        {showingMoveWait && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <div style={{ position: 'relative', width: 70, height: 70, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {[0, 0.6, 1.2].map((d, i) => (
                <div key={i} style={{ position: 'absolute', borderRadius: '50%', border: `1px solid ${T.red}`, width: 36, height: 36, opacity: 0, animation: `pulseOut 1.8s ease-out ${d}s infinite` }} />
              ))}
              <div style={{ width: 34, height: 34, borderRadius: '50%', border: `1px solid ${T.red}`, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
                <svg viewBox="0 0 20 20" width={16} height={16} fill="none">
                  <circle cx="10" cy="10" r="4" fill={T.red} opacity="0.5" />
                  <circle cx="10" cy="10" r="8" stroke={T.red} strokeWidth="1" opacity="0.3" />
                </svg>
              </div>
            </div>
            <div style={{ ...F.mono, fontSize: 11, color: T.muted }}>Move locked -- waiting...</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, ...F.mono, fontSize: 8, color: T.dim }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: T.amber, animation: 'blink 1s ease-in-out infinite' }} />
              Opponent deciding
            </div>
          </div>
        )}

        {/* ── RESOLVING ──────────────────────────────────── */}
        {phase === 'resolving' && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Spinner size={24} />
            <span style={{ ...F.mono, fontSize: 12, color: T.muted, marginLeft: 8 }}>Resolving...</span>
          </div>
        )}

        {/* ── SUB MINIGAME ───────────────────────────────── */}
        {showingSub && (
          <SubMinigame
            match={match} profile={profile}
            isAtt={match.sub_attacker_id === profile.id}
            myGp={myGp} oppGp={oppGp} busy={busy}
            subSel={subSel} setSubSel={setSubSel}
            subPickerFor={subPickerFor} setSubPickerFor={setSubPickerFor}
            subPickerTechId={subPickerTechId} setSubPickerTechId={setSubPickerTechId}
            lockSubChoice={lockSubChoice}
            getChainSubOptions={getChainSubOptions} getCounterOptions={getCounterOptions}
            subReveal={subReveal} chainSub={chainSub}
          />
        )}

        {/* ── MATCH FINISHED ─────────────────────────────── */}
        {match.status === 'finished' && !showReveal && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
            <svg viewBox="0 0 48 48" width={36} height={36} fill="none">
              <rect x="6" y="10" width="36" height="28" rx="4" stroke={T.muted} strokeWidth="1.5" fill={T.muted + '10'} />
              <path d="M6 18H42" stroke={T.muted} strokeWidth="1" />
              <path d="M18 10V38" stroke={T.muted} strokeWidth="1" />
              <path d="M30 10V38" stroke={T.muted} strokeWidth="1" />
            </svg>
            <div style={{ ...F.display, fontSize: 18, color: T.text }}>Match Complete</div>
            <div style={{ ...F.mono, fontSize: 10, color: T.muted }}>Loading results...</div>
          </div>
        )}
      </div>

      {/* ═══ OVERLAYS ═══ */}
      {showReveal && revealData && (
        <RevealOverlay revealData={revealData} yourFlipped={yourFlipped} oppFlipped={oppFlipped} showResult={showResult} onDismiss={dismissReveal} />
      )}
      <TapOverlay tapOverlay={tapOverlay} />
      <FinishOverlay finishOverlay={finishOverlay} />
      <EscapedOverlay visible={subEscaped} />

      {/* ═══ KEYFRAMES ═══ */}
      <style>{`
        @keyframes pulseOut { 0% { transform: scale(1); opacity: 0.6; } 100% { transform: scale(2.4); opacity: 0; } }
        @keyframes blink { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }
        @keyframes pulseGlow { 0%, 100% { box-shadow: 0 0 0 0 ${T.red}40; } 50% { box-shadow: 0 0 12px 2px ${T.red}30; } }
        @keyframes shimmer { 0%, 100% { opacity: 1; filter: brightness(1); } 50% { opacity: 0.85; filter: brightness(1.3); } }
        @keyframes tapBounce { 0% { transform: scale(0); opacity: 0; } 50% { transform: scale(1.15); } 100% { transform: scale(1); opacity: 1; } }
        @keyframes tapShake { 0% { transform: translateX(0); } 15% { transform: translateX(-6px); } 30% { transform: translateX(5px); } 45% { transform: translateX(-4px); } 60% { transform: translateX(3px); } 75% { transform: translateX(-1px); } 100% { transform: translateX(0); } }
        @keyframes meterPulse { 0% { transform: scaleY(1); } 30% { transform: scaleY(1.8); } 100% { transform: scaleY(1); } }
        @keyframes fadeUp { 0% { opacity: 0; transform: translateY(8px); } 100% { opacity: 1; transform: translateY(0); } }
        @keyframes chainGold { 0% { opacity: 0; transform: translateX(-20px); } 100% { opacity: 1; transform: translateX(0); } }
        @keyframes escapeBurst { 0% { transform: scale(0); opacity: 0; } 50% { transform: scale(1.2); } 100% { transform: scale(1); opacity: 1; } }
        @keyframes desperationPulse { 0%, 100% { border-color: #ff222240; } 50% { border-color: #ff222280; } }
        @keyframes lastMovePulse { 0%, 100% { opacity: 0.8; } 50% { opacity: 1; } }
      `}</style>
    </div>
  );
}

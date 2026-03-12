import React from 'react';
const { useState, useEffect, useRef, useCallback } = React;
import { sb, dbg, G, beltOrder, getStatus, drawHand } from '../lib/supabase';
import { ARCHETYPES, FAMILY_COLORS, GP_COSTS } from '../lib/constants';
import { T, MTColors, MTLabels, TierDisplay } from '../lib/tokens';
import { MoveIcon, StanceIcon } from '../lib/icons';
import { Btn, Spinner, Center } from '../components/UI';
import BotEngine from '../lib/botEngine';

// ═══════════════════════════════════════════════════════════
// MATCH SCREEN — Production v2
// New UI from prototype, real Supabase integration
// ═══════════════════════════════════════════════════════════

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
  const [selectedStance, setSelectedStance] = useState(null);
  const [isBotMatch, setIsBotMatch] = useState(false);
  const [botId, setBotId] = useState(null);
  const [botArchetype, setBotArchetype] = useState(null);
  const [botDifficulty, setBotDifficulty] = useState(null);

  // Universal moves shown when hand is empty (not during sub minigame)
  const universalMoves = [
    { id: 'survive', name: 'Survive', type: 'universal', description: 'Hunker down. Rest and recover.', gp_cost: 0, gp_recovery: 1, is_universal: true },
    { id: 'spaz', name: 'Spaz', type: 'universal', description: 'Explosive escape. Costs 3 GP. If opponent subs — checkmate.', gp_cost: 3, gp_recovery: 0, is_universal: true },
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
  // Three hand states:
  // 1. moves + GP >= 3 → normal hand only
  // 2. moves + GP < 3 → normal hand + survive at bottom
  // 3. zero moves → survive + spaz only
  const inMovePhase = phase === 'move' && !myLocked && deck.length > 0 && myPos && !match?.sub_minigame_active && match?.status !== 'finished';
  const zeroMoves = inMovePhase && moves.length === 0;
  const showSurviveExtra = inMovePhase && moves.length > 0 && myGp < 3;
  if (phase === 'move') console.log('[UNIVERSAL CHECK]', { handLength: moves.length, myGP: myGp, zeroMoves, showSurviveExtra });

  // Stance config
  const stancesCfg = [
    { id: 'attack', label: 'Attack', desc: 'Commit to offense -- base GP cost', gp: 'Base GP', color: T.red },
    { id: 'defend', label: 'Defend', desc: '+15% defense -- counters free', gp: '0 GP', color: T.blue },
    { id: 'setup',  label: 'Setup',  desc: 'Recover grip, reset -- +2 GP',   gp: '+2 GP', color: T.amber },
  ];

  const statusColor = { dominant: T.green, neutral: T.muted, defending: T.amber, disadvantaged: T.red };

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
    setSel(null); setSelectedStance(null); setSubSel(null);

    // Handle match end — check for submission finish to show TAP overlay
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
        setTimeout(() => onEnd(m), 2500);
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
    const myMoveName = myTech?.name || fallback.name;
    const myMoveType = myTech?.type || fallback.type;
    const oppMoveName = oppTech?.name || 'Defended';
    const oppMoveType = oppTech?.type || 'unknown';

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

    // Handle universal moves (survive / spaz)
    if (sel.is_universal) {
      const uMove = universalMoves.find(u => u.id === sel.id);
      lastLockedMoveRef.current = { name: uMove?.name || sel.id, type: 'universal', variantName: null };
      console.log('[UNIVERSAL]', sel.id, '— submitting');

      if (sel.id === 'survive') {
        const { error } = await sb.rpc('resolve_survive', { p_match_id: matchId, p_player_id: profile.id });
        if (error) dbg('Survive error: ' + error.message, 'err');
      } else if (sel.id === 'spaz') {
        const { error } = await sb.rpc('resolve_spaz', { p_match_id: matchId, p_player_id: profile.id });
        if (error) dbg('Spaz error: ' + error.message, 'err');
      }

      // Always refresh after universal move RPC to pick up state changes
      await refreshMatch();

      // Bot response for universal moves
      if (isBotMatch) {
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

  async function lockSubChoice() {
    if (!subSel || busy) return;
    setBusy(true);
    lastSubChoiceRef.current = subSel;
    const { error } = await sb.rpc('submit_sub_choice', { p_match_id: matchId, p_choice: subSel });
    if (error) {
      dbg('Sub err: ' + error.message, 'err');
    } else {
      setSubSel(null);
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

  const gpPct = (myGp / 12) * 100;
  const gpColor = myGp <= 2 ? T.red : myGp <= 5 ? T.amber : T.green;
  const oppStaminaLabel = oppGp >= 8 ? 'Fresh' : oppGp >= 4 ? 'Tired' : 'Gassed';
  const oppStaminaColor = oppGp >= 8 ? T.green : oppGp >= 4 ? T.amber : T.red;

  const showingStancePick = phase === 'stance' && !myStanceLocked && match.status !== 'finished';
  const showingStanceWait = phase === 'stance' && myStanceLocked && match.status !== 'finished';
  const showingMovePick = phase === 'move' && !myLocked && match.status !== 'finished';
  const showingMoveWait = phase === 'move' && myLocked && match.status !== 'finished';
  const showingSub = phase === 'sub_minigame' && match.sub_minigame_active;

  const F = {
    display: { fontFamily: T.display },
    mono: { fontFamily: T.mono },
    body: { fontFamily: T.body },
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', background: T.bg }}>

      {/* ═══ SCORE HEADER ═══ */}
      <div style={{ padding: '4px 18px 6px', borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
          <span style={{ ...F.mono, fontSize: 9, color: T.muted, textTransform: 'uppercase' }}>
            Turn <em style={{ color: T.red, fontStyle: 'normal' }}>{match.current_turn}/{match.max_turns}</em>
          </span>
          <span style={{ ...F.mono, fontSize: 9, color: T.muted, textTransform: 'uppercase' }}>
            {ARCHETYPES[profile.archetype]?.label?.slice(0, 3)} vs {ARCHETYPES[opp.archetype]?.label?.slice(0, 3)}
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 50px 1fr', alignItems: 'center' }}>
          <div>
            <div style={{ ...F.mono, fontSize: 9, color: T.muted, textTransform: 'uppercase' }}>You</div>
            <div style={{ ...F.display, fontSize: 36, lineHeight: 1, color: myPts > oppPts ? T.red : T.text }}>{myPts || 0}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ ...F.display, fontSize: 18, color: T.dim }}>{match.max_turns - match.current_turn + 1}</div>
            <div style={{ ...F.mono, fontSize: 7, color: T.dim, textTransform: 'uppercase' }}>left</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ ...F.mono, fontSize: 9, color: T.muted, textTransform: 'uppercase' }}>Opp</div>
            <div style={{ ...F.display, fontSize: 36, lineHeight: 1, color: oppPts > myPts ? T.red : T.text, textAlign: 'right' }}>{oppPts || 0}</div>
          </div>
        </div>
      </div>

      {/* ═══ RESOURCE BAR ═══ */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '6px 18px', gap: 8, borderBottom: `1px solid ${T.border}`, flexShrink: 0, background: T.surface }}>
        <span style={{ ...F.display, fontSize: 18, color: gpColor, lineHeight: 1 }}>{myGp}</span>
        <span style={{ ...F.mono, fontSize: 8, color: T.dim }}>/12 GP</span>
        <div style={{ flex: 1, height: 3, background: T.border, borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: gpPct + '%', background: gpColor, borderRadius: 2, transition: 'width 0.3s' }} />
        </div>
        <div style={{ width: 1, height: 14, background: T.border }} />
        <span style={{ ...F.mono, fontSize: 7, color: T.dim }}>Chain</span>
        <span style={{ ...F.display, fontSize: 15, color: myChain >= 4 ? T.red : myChain >= 2 ? T.amber : T.dim, lineHeight: 1 }}>{myChain}</span>
        {myChain >= 2 && (
          <div style={{ display: 'flex', gap: 1 }}>
            {Array.from({ length: Math.min(myChain, 5) }).map((_, i) => (
              <div key={i} style={{ width: 4, height: 10, borderRadius: 1, background: myChain >= 4 ? T.red : T.amber, opacity: 0.5 + (i * 0.1) }} />
            ))}
          </div>
        )}
        <div style={{ width: 1, height: 14, background: T.border }} />
        <span style={{ ...F.mono, fontSize: 8, padding: '2px 6px', borderRadius: 3, background: oppStaminaColor + '18', color: oppStaminaColor, fontWeight: 600, textTransform: 'uppercase' }}>{oppStaminaLabel}</span>
      </div>

      {/* ═══ POSITION ═══ */}
      <div style={{ flexShrink: 0, position: 'relative', height: 56, borderBottom: `1px solid ${T.border}`, background: T.surface, display: 'flex', alignItems: 'flex-end', padding: '0 18px 8px', justifyContent: 'space-between' }}>
        <div>
          <div style={{ ...F.display, fontSize: 17, color: T.text, lineHeight: 1, marginBottom: 2 }}>{pos?.name?.replace(/ \(.*\)/, '') || 'Unknown'}</div>
          <div style={{ ...F.mono, fontSize: 8, color: FAMILY_COLORS[pos?.family] || T.muted, textTransform: 'uppercase' }}>{pos?.family?.replace('_', ' ')}</div>
        </div>
        <span style={{ ...F.mono, fontSize: 8, padding: '3px 8px', border: '1px solid', borderRadius: 3, textTransform: 'uppercase', fontWeight: 500, color: statusColor[myStatus] || T.muted, borderColor: (statusColor[myStatus] || T.muted) + '66', background: (statusColor[myStatus] || T.muted) + '0C' }}>{myStatus}</span>
      </div>

      {/* ═══ PHASE CONTENT ═══ */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>

        {/* ── STANCE PICK ────────────────────────────────── */}
        {showingStancePick && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 18px', gap: 14 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ ...F.mono, fontSize: 9, letterSpacing: '0.1em', color: T.muted, textTransform: 'uppercase' }}>Phase 1</div>
              <div style={{ ...F.display, fontSize: 26, color: T.text }}>Choose Your Stance</div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              {stancesCfg.map(s => {
                const isSel = selectedStance === s.id;
                return (
                  <div key={s.id} onClick={() => !busy && lockStance(s.id)} style={{
                    flex: 1, padding: '14px 8px', borderRadius: 10, textAlign: 'center', cursor: 'pointer',
                    border: `1px solid ${isSel ? s.color : T.border}`,
                    background: isSel ? s.color + '12' : T.surface,
                    transition: 'all 0.18s',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
                      <StanceIcon stance={s.id} size={24} />
                    </div>
                    <div style={{ ...F.display, fontSize: 14, color: isSel ? T.text : T.muted, letterSpacing: '0.05em' }}>{s.label}</div>
                    <div style={{ ...F.mono, fontSize: 8, color: T.dim, marginTop: 2 }}>{s.desc}</div>
                    <div style={{ ...F.mono, fontSize: 10, fontWeight: 600, color: isSel ? s.color : T.dim, marginTop: 6 }}>{s.gp}</div>
                  </div>
                );
              })}
            </div>

            {oppTendency.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                <span style={{ ...F.mono, fontSize: 8, color: T.dim, textTransform: 'uppercase' }}>Opp last 3:</span>
                {oppTendency.map((s, i) => (
                  <span key={i} style={{ ...F.mono, fontSize: 8, padding: '2px 5px', borderRadius: 2, textTransform: 'uppercase',
                    background: s === 'attack' ? T.red + '18' : s === 'setup' ? T.blue + '14' : T.muted + '14',
                    color: s === 'attack' ? T.red : s === 'setup' ? T.blue : T.muted,
                  }}>{s === 'attack' ? 'ATK' : s === 'defend' ? 'DEF' : 'SET'}</span>
                ))}
              </div>
            )}
            {busy && <div style={{ textAlign: 'center' }}><Spinner /></div>}
          </div>
        )}

        {/* ── STANCE WAIT ────────────────────────────────── */}
        {showingStanceWait && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Spinner />
            <div style={{ ...F.mono, fontSize: 11, color: T.muted }}>Stance locked -- waiting for opponent...</div>
          </div>
        )}

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

            {/* State 3: Zero moves — Survive + Spaz desperation */}
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
                        {isSurvive ? '0 GP \u2022 +1 recovery' : canAfford ? '3 GP \u2022 CHECKMATE RISK' : 'Not enough GP'}
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
                {moves.map(m => {
                  const tier = deckTiers[m.id] || 'trained';
                  const isDrilled = myDrilled.includes(m.id);
                  const effectiveTier = isDrilled ? 'drilled' : tier;
                  const effGP = getEffGP(m);
                  const canAfford = myGp >= effGP;
                  const isSel = sel?.id === m.id && !sel?.isCounter;
                  const td = TierDisplay[effectiveTier] || TierDisplay.trained;
                  const typeColor = MTColors[m.type] || T.muted;
                  const hasVariant = !!variantMap[m.id];
                  const isKnown = effectiveTier === 'known';

                  return (
                    <div key={m.id} onClick={() => canAfford && setSel({ id: m.id, isCounter: false })} style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, marginBottom: 4,
                      cursor: canAfford ? 'pointer' : 'default', opacity: canAfford ? (isKnown ? 0.55 : 1) : 0.3, transition: 'all 0.15s',
                      position: 'relative', overflow: 'hidden',
                      border: `1px solid ${isSel ? typeColor : isDrilled ? '#FFD700' + '50' : isKnown ? T.dim + '40' : T.border}`,
                      background: isSel ? typeColor + '10' : isDrilled ? '#FFD700' + '08' : T.surface,
                      boxShadow: isDrilled && !isSel ? '0 0 8px #FFD70015' : 'none',
                    }}>
                      {/* Left accent bar */}
                      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: isSel ? typeColor : isDrilled ? '#FFD700' : isKnown ? T.dim + '40' : 'transparent', opacity: 0.7 }} />

                      {/* Type icon */}
                      <div style={{ width: 26, height: 26, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: typeColor + '14', position: 'relative' }}>
                        <MoveIcon type={m.type} size={16} />
                        {isDrilled && <span style={{ position: 'absolute', top: -4, right: -4, fontSize: 10, lineHeight: 1, color: '#FFD700', textShadow: '0 0 4px #FFD70080' }}>★</span>}
                      </div>

                      {/* Move info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, fontFamily: T.body, color: isSel ? T.white : hasVariant ? T.gold : isKnown ? T.dim : T.text }}>
                            {hasVariant ? variantMap[m.id].variant_name : m.name}
                          </span>
                          {hasVariant && <span style={{ color: T.gold, fontSize: 10, lineHeight: 1 }}>&#9670;</span>}
                          {isDrilled && <span style={{ fontSize: 9, color: '#FFD700', lineHeight: 1 }}>★</span>}
                          {!isDrilled && <span style={{ fontSize: 9, color: td.c, lineHeight: 1 }}>{td.sym}</span>}
                        </div>
                        <div style={{ ...F.mono, fontSize: 8, color: isKnown ? T.dim : T.muted, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
                          <span style={{ fontSize: 7, padding: '1px 4px', borderRadius: 2, background: typeColor + '18', color: typeColor }}>{MTLabels[m.type] || 'MOVE'}</span>
                          <span style={{ color: T.dim }}>
                            {hasVariant ? m.name + ' > ' : ''}
                            {m.to_position ? G.positions[m.to_position]?.name?.replace(/ \(.*\)/, '') : 'SUBMISSION'}
                          </span>
                          {isDrilled && <span style={{ color: T.green }}>+15%</span>}
                          {isKnown && <span style={{ color: T.red }}>+1 GP</span>}
                        </div>
                      </div>

                      {/* GP cost */}
                      <div style={{ textAlign: 'center', flexShrink: 0, minWidth: 32 }}>
                        {isDrilled && <div style={{ ...F.mono, fontSize: 8, color: T.green, textDecoration: 'line-through', textDecorationColor: T.muted }}>{m.gp_cost || GP_COSTS[m.type] || 1}</div>}
                        <div style={{ ...F.display, fontSize: 16, lineHeight: 1, color: isDrilled ? '#FFD700' : isKnown ? T.red : !canAfford ? T.red : T.muted }}>{effGP}</div>
                        <div style={{ ...F.mono, fontSize: 7, color: T.dim }}>GP</div>
                      </div>

                      {/* Selection check */}
                      {isSel && (
                        <div style={{ position: 'absolute', top: 6, right: 8, width: 16, height: 16, borderRadius: '50%', background: typeColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <svg viewBox="0 0 12 12" width={8} height={8}><path d="M2 6L5 9L10 3" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        </div>
                      )}
                    </div>
                  );
                })}

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
        {showingSub && (() => {
          const isAtt = match.sub_attacker_id === profile.id;
          const subTech = G.techniques[match.sub_technique_id];
          const myLk = isAtt ? match.sub_attacker_locked : match.sub_defender_locked;
          const tighten = match?.sub_tighten_turns ?? 0;
          const subRound = match?.sub_phase ?? 1;

          const attOpts = [
            { id: 'squeeze', label: 'Squeeze', desc: 'Commit fully', cost: 2, color: T.red },
            { id: 'adjust', label: 'Adjust', desc: 'Reposition grip', cost: 1, color: T.amber },
            { id: 'transition_sub', label: 'Chain Sub', desc: 'Switch submission', cost: 1, color: T.purple },
          ];
          const defOpts = [
            { id: 'technical_escape', label: 'Tech Escape', desc: 'Strip the grip', cost: 1, color: T.teal },
            { id: 'explode', label: 'Explode', desc: 'All-out burst', cost: 2, color: T.red },
            { id: 'survive', label: 'Survive', desc: 'Weather the storm', cost: 1, color: T.blue },
            { id: 'sweep_scramble', label: 'Sweep', desc: 'Escape + position', cost: 2, color: T.amber },
            { id: 'reversal_sub', label: 'Reversal', desc: 'Counter-submission', cost: 3, color: T.gold },
          ];
          const opts = isAtt ? attOpts : defOpts;

          return (
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 18px 100px' }}>
              {/* Sub header */}
              <div style={{ textAlign: 'center', margin: '12px 0', padding: 14, background: T.red + '0A', borderRadius: 10, border: `1px solid ${T.red}30` }}>
                <div style={{ ...F.mono, fontSize: 11, color: T.red, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Submission</div>
                {chainSub ? (
                  <div style={{ marginTop: 2 }}>
                    <div style={{ ...F.display, fontSize: 16, color: T.dim, textDecoration: 'line-through', opacity: 0.5 }}>{chainSub.oldName}</div>
                    <div style={{ ...F.display, fontSize: 22, color: '#FFD700', animation: 'chainGold 0.5s ease-out', textShadow: '0 0 12px #FFD70040' }}>Chain &rarr; {chainSub.newName}!</div>
                  </div>
                ) : (
                  <div style={{ ...F.display, fontSize: 22, color: T.text, marginTop: 2 }}>{subTech?.name || 'Submission'}</div>
                )}
                <div style={{ ...F.mono, fontSize: 11, color: T.muted, marginTop: 4 }}>{isAtt ? 'Finish it!' : 'Escape or survive!'}</div>
              </div>

              {/* Tighten meter — animated */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: 10 }}>
                <span style={{ ...F.mono, fontSize: 8, color: T.dim, width: 50, textAlign: 'right' }}>TIGHTEN</span>
                <div style={{ display: 'flex', gap: 3 }}>
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} style={{
                      width: 28, height: 7, borderRadius: 3,
                      background: i <= tighten ? T.red : T.dim + '30',
                      transition: 'background 0.4s, box-shadow 0.4s',
                      boxShadow: i === tighten ? `0 0 6px ${T.red}60` : 'none',
                      animation: i === tighten ? 'meterPulse 0.6s ease-out' : 'none',
                    }} />
                  ))}
                </div>
                <span style={{ ...F.mono, fontSize: 9, color: tighten >= 4 ? T.red : T.muted, width: 30 }}>{tighten}/5</span>
              </div>

              {/* Sub choice reveal overlay */}
              {subReveal && (
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 12, animation: 'fadeUp 0.3s ease-out' }}>
                  <div style={{ flex: 1, padding: '8px 10px', borderRadius: 8, textAlign: 'center',
                    background: subReveal.myChoice === 'squeeze' ? T.red + '18' : subReveal.myChoice === 'adjust' ? T.amber + '18' : subReveal.myChoice === 'transition_sub' ? T.purple + '18' : subReveal.myChoice === 'technical_escape' ? T.teal + '18' : subReveal.myChoice === 'explode' ? T.red + '18' : T.blue + '18',
                    border: `1px solid ${subReveal.myChoice === 'squeeze' ? T.red : subReveal.myChoice === 'adjust' ? T.amber : subReveal.myChoice === 'transition_sub' ? T.purple : subReveal.myChoice === 'technical_escape' ? T.teal : subReveal.myChoice === 'explode' ? T.red : T.blue}40`,
                  }}>
                    <div style={{ ...F.mono, fontSize: 8, color: T.muted, marginBottom: 2 }}>YOU</div>
                    <div style={{ ...F.body, fontSize: 11, fontWeight: 600, color: T.text }}>{subReveal.myChoice?.replace('_', ' ')}</div>
                  </div>
                  <div style={{ ...F.mono, fontSize: 9, color: T.dim, alignSelf: 'center' }}>vs</div>
                  <div style={{ flex: 1, padding: '8px 10px', borderRadius: 8, textAlign: 'center',
                    background: subReveal.oppChoice === 'squeeze' ? T.red + '18' : subReveal.oppChoice === 'adjust' ? T.amber + '18' : subReveal.oppChoice === 'transition_sub' ? T.purple + '18' : subReveal.oppChoice === 'technical_escape' ? T.teal + '18' : subReveal.oppChoice === 'explode' ? T.red + '18' : T.blue + '18',
                    border: `1px solid ${subReveal.oppChoice === 'squeeze' ? T.red : subReveal.oppChoice === 'adjust' ? T.amber : subReveal.oppChoice === 'transition_sub' ? T.purple : subReveal.oppChoice === 'technical_escape' ? T.teal : subReveal.oppChoice === 'explode' ? T.red : T.blue}40`,
                  }}>
                    <div style={{ ...F.mono, fontSize: 8, color: T.muted, marginBottom: 2 }}>OPP</div>
                    <div style={{ ...F.body, fontSize: 11, fontWeight: 600, color: T.text }}>{subReveal.oppChoice?.replace('_', ' ')}</div>
                  </div>
                </div>
              )}

              {/* Round indicators */}
              <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 14 }}>
                {[1, 2, 3].map(r => (
                  <div key={r} style={{
                    width: 22, height: 22, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 600, fontFamily: T.mono,
                    background: r < subRound ? T.red : 'transparent',
                    border: `1.5px solid ${r <= subRound ? T.red : T.dim}`,
                    color: r < subRound ? '#fff' : r === subRound ? T.text : T.dim,
                  }}>{r}</div>
                ))}
              </div>

              {/* Options */}
              {!myLk && opts.map(o => {
                const oSel = subSel === o.id;
                return (
                  <div key={o.id} onClick={() => myGp >= o.cost && setSubSel(o.id)} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 14px', marginBottom: 5, borderRadius: 8, cursor: myGp >= o.cost ? 'pointer' : 'default',
                    opacity: myGp >= o.cost ? 1 : 0.35, transition: 'all 0.15s',
                    background: oSel ? o.color + '10' : T.surface,
                    border: `1px solid ${oSel ? o.color : T.border}`,
                    borderLeft: `3px solid ${oSel ? o.color : T.border}`,
                  }}>
                    <div>
                      <div style={{ ...F.body, fontSize: 13, fontWeight: 600, color: oSel ? T.text : T.muted }}>{o.label}</div>
                      <div style={{ ...F.mono, fontSize: 10, color: T.dim }}>{o.desc}</div>
                    </div>
                    <span style={{ ...F.mono, fontSize: 10, color: T.amber, fontWeight: 700 }}>{o.cost}GP</span>
                  </div>
                );
              })}

              {myLk && (
                <div style={{ textAlign: 'center', padding: 20 }}>
                  <Spinner />
                  <div style={{ ...F.mono, fontSize: 11, color: T.muted, marginTop: 8 }}>Locked -- waiting...</div>
                </div>
              )}

              {!myLk && (
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '10px 18px 28px', background: `linear-gradient(180deg, transparent 0%, ${T.bg} 40%)` }}>
                  <Btn onClick={lockSubChoice} disabled={!subSel || busy} style={{ background: subSel ? `linear-gradient(135deg, ${T.red}, #c0392b)` : undefined }}>
                    {busy ? <Spinner /> : subSel ? 'Lock In' : 'Select an Option'}
                  </Btn>
                </div>
              )}
            </div>
          );
        })()}

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

      {/* ═══ REVEAL OVERLAY ═══ */}
      {showReveal && revealData && (
        <div onClick={dismissReveal} style={{ position: 'absolute', inset: 0, zIndex: 60, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: T.bg, cursor: 'pointer' }}>
          {/* Grid pattern background */}
          <div style={{ position: 'absolute', inset: 0, backgroundImage: `linear-gradient(${T.border} 1px, transparent 1px), linear-gradient(90deg, ${T.border} 1px, transparent 1px)`, backgroundSize: '20px 20px', opacity: 0.1 }} />

          <div style={{ ...F.mono, fontSize: 9, letterSpacing: '0.2em', color: T.muted, textTransform: 'uppercase', marginBottom: 20, zIndex: 2 }}>Turn {revealData.turn} -- Reveal</div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 20, zIndex: 2 }}>
            {/* Your card */}
            <div style={{ width: 130, height: 155, perspective: 700 }}>
              <div style={{ width: '100%', height: '100%', position: 'relative', transformStyle: 'preserve-3d', transition: 'transform 0.6s cubic-bezier(0.4,0,0.2,1)', transform: yourFlipped ? 'rotateY(180deg)' : 'none' }}>
                {/* Card back */}
                <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', borderRadius: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, background: T.surface2, border: `1px solid ${T.border}` }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', border: `1px solid ${T.borderB}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: 22, height: 22, borderRadius: '50%', border: `1px solid ${T.border}` }} />
                  </div>
                  <div style={{ ...F.display, fontSize: 10, letterSpacing: '0.1em', color: T.borderB }}>OPEN MAT</div>
                </div>
                {/* Card front */}
                <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', transform: 'rotateY(180deg)', borderRadius: 6, display: 'flex', flexDirection: 'column', padding: 14, background: '#2a0810', border: `1px solid ${T.red}` }}>
                  <div style={{ ...F.mono, fontSize: 8, color: T.red, textTransform: 'uppercase', marginBottom: 4 }}>You played</div>
                  <div style={{ ...F.mono, fontSize: 7, padding: '2px 5px', border: `1px solid ${T.red}`, borderRadius: 2, color: T.red, textTransform: 'uppercase', alignSelf: 'flex-start', marginBottom: 8 }}>{MTLabels[revealData?.myMoveType] || 'MOVE'}</div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ ...F.display, fontSize: 22, color: '#fff', lineHeight: 1.1 }}>{revealData?.myMoveName || 'Your Move'}</div>
                  </div>
                  <div style={{ ...F.mono, fontSize: 8, color: T.muted }}>{myStanceVal}</div>
                </div>
              </div>
            </div>

            <div style={{ ...F.display, fontSize: 11, color: T.dim, zIndex: 2 }}>VS</div>

            {/* Opp card */}
            <div style={{ width: 130, height: 155, perspective: 700 }}>
              <div style={{ width: '100%', height: '100%', position: 'relative', transformStyle: 'preserve-3d', transition: 'transform 0.6s cubic-bezier(0.4,0,0.2,1)', transform: oppFlipped ? 'rotateY(180deg)' : 'none' }}>
                {/* Card back */}
                <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', borderRadius: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, background: T.surface2, border: `1px solid ${T.border}` }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', border: `1px solid ${T.borderB}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: 22, height: 22, borderRadius: '50%', border: `1px solid ${T.border}` }} />
                  </div>
                  <div style={{ ...F.display, fontSize: 10, letterSpacing: '0.1em', color: T.borderB }}>OPEN MAT</div>
                </div>
                {/* Card front */}
                <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', transform: 'rotateY(180deg)', borderRadius: 6, display: 'flex', flexDirection: 'column', padding: 14, background: '#050d1a', border: `1px solid ${T.blue}` }}>
                  <div style={{ ...F.mono, fontSize: 8, color: T.blue, textTransform: 'uppercase', marginBottom: 4 }}>Opponent</div>
                  <div style={{ ...F.mono, fontSize: 7, padding: '2px 5px', border: `1px solid ${T.blue}`, borderRadius: 2, color: T.blue, textTransform: 'uppercase', alignSelf: 'flex-start', marginBottom: 8 }}>{MTLabels[revealData?.oppMoveType] || 'MOVE'}</div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ ...F.display, fontSize: 20, color: '#7aaee0', lineHeight: 1.1 }}>{revealData?.oppMoveName || 'Defended'}</div>
                  </div>
                  <div style={{ ...F.mono, fontSize: 8, color: T.muted }}>{opp.display_name}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Result */}
          <div style={{ zIndex: 2, textAlign: 'center', opacity: showResult ? 1 : 0, transform: showResult ? 'translateY(0)' : 'translateY(12px)', transition: 'opacity 0.4s, transform 0.4s' }}>
            {revealData.variantName && (
              <div style={{ marginBottom: 6 }}>
                <div style={{ ...F.display, fontSize: 24, color: T.gold, animation: 'shimmer 2s ease-in-out infinite', lineHeight: 1 }}>
                  {revealData.variantName}
                </div>
                <div style={{ ...F.mono, fontSize: 8, color: T.muted, marginTop: 2 }}>
                  Variant of {revealData.myMoveName || 'technique'}
                </div>
              </div>
            )}
            <div style={{ ...F.display, fontSize: 28, lineHeight: 1, marginBottom: 4, color: revealData.result === 'submission_win' ? T.red : revealData.result === 'sweep' ? T.green : T.amber }}>{revealData.description}</div>
            {revealData.newPosName && (
              <div style={{ ...F.mono, fontSize: 10, color: T.muted, marginTop: 6 }}>&rarr; {revealData.newPosName}</div>
            )}
            <div style={{ ...F.mono, fontSize: 8, color: T.dim, marginTop: 10 }}>Tap anywhere to continue</div>
          </div>
        </div>
      )}

      {/* ═══ TAP OVERLAY ═══ */}
      {tapOverlay && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 100,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          background: tapOverlay.won ? '#D4603A' : '#E63946',
          animation: 'tapShake 0.4s ease-out',
        }}>
          <div style={{
            ...F.display, fontSize: 72, fontWeight: 900, color: '#fff',
            lineHeight: 1, letterSpacing: '0.05em',
            animation: 'tapBounce 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
            textShadow: '0 4px 20px rgba(0,0,0,0.4)',
          }}>TAP!</div>
          <div style={{
            ...F.display, fontSize: 20, color: 'rgba(255,255,255,0.9)',
            marginTop: 16, textAlign: 'center',
          }}>{tapOverlay.subName}</div>
          <div style={{
            ...F.mono, fontSize: 13, color: 'rgba(255,255,255,0.7)',
            marginTop: 12, textTransform: 'uppercase', letterSpacing: '0.1em',
          }}>{tapOverlay.won ? 'Submission Victory!' : 'You got tapped'}</div>
          <div style={{
            ...F.mono, fontSize: 11, color: 'rgba(255,255,255,0.5)',
            marginTop: 8,
          }}>{tapOverlay.winnerName} wins</div>
        </div>
      )}

      {/* ═══ ESCAPED OVERLAY ═══ */}
      {subEscaped && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 99,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.7)',
          animation: 'fadeUp 0.3s ease-out',
          pointerEvents: 'none',
        }}>
          <div style={{
            ...F.display, fontSize: 56, fontWeight: 900, color: '#2A9D8F',
            letterSpacing: '0.06em', lineHeight: 1,
            animation: 'escapeBurst 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
            textShadow: '0 0 30px #2A9D8F60, 0 4px 20px rgba(0,0,0,0.4)',
          }}>ESCAPED!</div>
        </div>
      )}

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
      `}</style>
    </div>
  );
}

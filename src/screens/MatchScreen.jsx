import React from 'react';
const { useState, useEffect, useRef, useCallback } = React;
import { sb, dbg, G, beltOrder, getStatus, getMoves } from '../lib/supabase';
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

  // Survive mechanic
  const [noMovesConfirmed, setNoMovesConfirmed] = useState(false);
  const [surviveBusy, setSurviveBusy] = useState(false);
  const [surviveResult, setSurviveResult] = useState(null);
  const [caughtBySub, setCaughtBySub] = useState(false);

  const SURVIVE_FLAVOR = {
    white:  'Hold on -- just survive!',
    blue:   'Heart over technique -- push through!',
    purple: 'Trust your defense. Breathe.',
    brown:  'Grind through. Champions survive.',
    black:  'Breathe. Survive. Escape is earned.',
  };

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

  // Track what player locked in for the flip card display
  const lastLockedMoveRef = useRef(null);

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
      triggerReveal(latestTurn);
      prevTurnRef.current = m.current_turn;
    }

    setMatch(m);
    setSel(null); setSelectedStance(null);
    setNoMovesConfirmed(false); setSurviveResult(null); setCaughtBySub(false);

    // Handle match end — check for submission finish to show TAP overlay
    if (m.status === 'finished' && !endedRef.current) {
      endedRef.current = true;
      dbg('Match finished!', 'ok');
      if (m.win_method === 'submission' || m.result_method === 'submission') {
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
      const { data: m } = await sb.from('matches').select('current_turn, turn_phase, status, player1_move_locked, player2_move_locked, player1_stance_locked, player2_stance_locked').eq('id', matchId).single();
      if (!m || !matchRef.current) return;
      const prev = matchRef.current;
      if (m.current_turn !== prev.current_turn || m.turn_phase !== prev.turn_phase || m.status !== prev.status ||
          m.player1_move_locked !== prev.player1_move_locked || m.player2_move_locked !== prev.player2_move_locked ||
          m.player1_stance_locked !== prev.player1_stance_locked || m.player2_stance_locked !== prev.player2_stance_locked) {
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

  function triggerReveal(turn) {
    const myMove = lastLockedMoveRef.current || { name: 'Your Move', type: 'unknown' };
    const variantName = parseVariant(turn.description);
    const cleanDesc = turn.description ? turn.description.replace(/\s*\[VARIANT:\s*.+?\]/, '').trim() : 'Position holds';
    // Extract opponent move from turn data, with fallback to match object
    const oppTechId = amP1
      ? (turn.player2_technique_id || matchRef.current?.player2_move)
      : (turn.player1_technique_id || matchRef.current?.player1_move);
    const oppTech = oppTechId ? G.techniques[oppTechId] : null;
    const oppMoveName = oppTech?.name || 'Defended';
    const oppMoveType = oppTech?.type || 'unknown';
    console.log('[REVEAL]', { turn: turn.turn_number, oppTechId, oppTech: oppTech?.name, myMove: myMove.name, turnKeys: Object.keys(turn) });
    setRevealData({ description: cleanDesc, result: turn.result, turn: turn.turn_number, myMoveName: myMove.name, myMoveType: myMove.type, variantName, oppMoveName, oppMoveType });
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

  useEffect(() => {
    if (myPos && deck.length > 0) {
      console.log('[HAND] draw_hand equiv — position:', myPos, 'archetype:', profile.archetype, 'belt:', profile.belt, 'deckIds:', deckIds.length, 'techFrom keys:', Object.keys(G.techFrom).filter(k => k.includes('standing')));
      let m = getMoves(myPos, profile.belt, deckIds, match?.status === 'overtime', profile.archetype);
      console.log('[HAND] getMoves raw result:', m.length, 'moves:', m.map(x => x.name + '(' + x.type + ')'));
      if (m.length === 0) {
        console.warn('[HAND] 0 moves from position, triggering survive');
        for (const dp of ['defending_clinch', 'defending_passing', 'defending_leg_entanglement', 'defending_back', 'defending_mount']) {
          const defMoves = getMoves(dp, profile.belt, deckIds, false, profile.archetype);
          if (defMoves.length > 0) { m = defMoves; console.log('[HAND] fallback hit:', dp, defMoves.length); break; }
        }
      }
      setMoves(m);
    } else {
      // Silently skip — hand will redraw when position/deck load
    }
  }, [myPos, deck, match?.status]);

  // Check has_moves_from_position when hand comes up empty during move phase
  useEffect(() => {
    if (phase === 'move' && !myLocked && moves.length === 0 && myPos && match?.status !== 'finished') {
      (async () => {
        const { data } = await sb.rpc('has_moves_from_position', { p_profile_id: profile.id, p_position: myPos });
        setNoMovesConfirmed(data === false);
      })();
    } else {
      setNoMovesConfirmed(false);
    }
  }, [phase, myLocked, moves.length, myPos, match?.status]);

  const oppTendency = turnHistory.slice(-3).map(t => amP1 ? t.player2_stance : t.player1_stance).filter(Boolean);

  // Filter counters to current position only — strict match required
  const allCounters = Object.values(G.counters);
  const counters = allCounters.filter(c => {
    const cPos = c.from_position || c.position || c.applicable_position;
    return cPos && cPos === myPos;
  });

  // Stance does NOT filter the hand — it only affects resolution bonuses (server-side).
  // Available moves are determined purely by position + deck.
  const showCounters = true;

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
    const allM = [...moves, ...counters.map(c => ({ ...c, type: 'counter' }))];
    const played = allM.find(m => m.id === sel.id);
    const variant = variantMap[sel.id];
    lastLockedMoveRef.current = played
      ? { name: played.name, type: played.type || 'counter', variantName: variant?.variant_name || null }
      : { name: '???', type: 'unknown', variantName: null };
    const { error } = await sb.rpc('submit_move', { p_match_id: matchId, p_technique_id: sel.id, p_is_counter: sel.isCounter || false, p_is_bait: false, p_feint_move: null });
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
      // After bot responds (including survive), refresh to pick up turn advancement
      setTimeout(() => refreshMatch(), 500);
    }
    setBusy(false);
  }

  async function handleSurvive() {
    if (surviveBusy) return;
    setSurviveBusy(true);
    // Player survive first — signal the server that this player has no moves
    const { data, error } = await sb.rpc('resolve_survive', { p_match_id: matchId, p_player_id: profile.id });
    if (error) dbg('Survive error: ' + error.message, 'err');
    const result = Array.isArray(data) ? data[0] : data;
    setSurviveResult(result || { success: false, message: 'Position held.' });

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
      let botHasSub = false;
      if (botHand && botHand.length > 0) {
        const { data: techs } = await sb.from('techniques').select('id, type').in('id', botHand);
        botHasSub = techs?.some(t => t.type === 'submission');
      }
      if (botHasSub) {
        setCaughtBySub(true);
        setSurviveBusy(false);
        await BotEngine.respondToMove(m, botId, botArchetype, botHand, botDrills, myStanceVal, botDifficulty);
        setTimeout(() => refreshMatch(), 500);
        return;
      }
      await BotEngine.respondToMove(m, botId, botArchetype, botHand, botDrills, myStanceVal, botDifficulty);
      // After bot responds (including bot survive), refresh to advance turn
      setTimeout(() => refreshMatch(), 500);
    }
    setSurviveBusy(false);
  }

  async function lockSubChoice() {
    if (!subSel || busy) return;
    setBusy(true);
    const { error } = await sb.rpc('submit_sub_choice', { p_match_id: matchId, p_choice: subSel });
    if (error) {
      dbg('Sub err: ' + error.message, 'err');
    } else {
      setSubSel(null);
      if (isBotMatch && match?.sub_minigame_active) {
        const botIsAttacker = match.sub_attacker_id === botId;
        BotEngine.respondToSubMinigame(match, botId, botIsAttacker, botDifficulty);
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

            {/* Survive UI -- no moves available */}
            {noMovesConfirmed && !caughtBySub && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 24px', gap: 14 }}>
                <StanceIcon stance="defend" size={48} />
                <div style={{ ...F.display, fontSize: 22, textAlign: 'center', color: T.text }}>No Moves Available</div>
                <div style={{ ...F.mono, fontSize: 11, color: T.muted, textAlign: 'center' }}>
                  {SURVIVE_FLAVOR[profile.belt] || SURVIVE_FLAVOR.white}
                </div>
                {surviveResult ? (
                  <div style={{ width: '100%', padding: 14, borderRadius: 10, border: `1px solid ${surviveResult.success ? T.green + '50' : T.red + '50'}`, background: surviveResult.success ? T.green + '0A' : T.red + '0A', textAlign: 'center' }}>
                    <div style={{ ...F.display, fontSize: 20, color: surviveResult.success ? T.green : T.red, marginBottom: 4 }}>
                      {surviveResult.success ? 'SURVIVED' : 'HELD DOWN'}
                    </div>
                    {surviveResult.roll !== undefined && (
                      <div style={{ ...F.mono, fontSize: 9, color: T.muted, marginBottom: 4 }}>
                        Roll {surviveResult.roll} vs threshold {surviveResult.final_chance ?? surviveResult.threshold ?? '?'}
                        {surviveResult.chain_penalty ? ` (chain -${Math.abs(surviveResult.chain_penalty)})` : ''}
                      </div>
                    )}
                    <div style={{ ...F.mono, fontSize: 10, color: T.text }}>{surviveResult.message || ''}</div>
                  </div>
                ) : (
                  <Btn onClick={handleSurvive} disabled={surviveBusy} style={{ width: '100%' }}>
                    {surviveBusy ? <Spinner /> : 'Survive'}
                  </Btn>
                )}
              </div>
            )}

            {/* CAUGHT -- opponent sub while you have no moves */}
            {noMovesConfirmed && caughtBySub && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 24px', gap: 14 }}>
                <svg viewBox="0 0 48 48" width={48} height={48} fill="none">
                  <circle cx="24" cy="24" r="20" stroke={T.red} strokeWidth="2" fill={T.red + '10'} />
                  <path d="M16 16L32 32M32 16L16 32" stroke={T.red} strokeWidth="2.5" strokeLinecap="round" />
                </svg>
                <div style={{ ...F.display, fontSize: 26, textAlign: 'center', color: T.red }}>CAUGHT!</div>
                <div style={{ ...F.mono, fontSize: 11, color: T.muted, textAlign: 'center' }}>
                  No escape routes -- opponent is attacking a submission!
                </div>
                <div style={{ ...F.mono, fontSize: 9, color: T.dim, textAlign: 'center' }}>
                  Entering submission minigame at disadvantage...
                </div>
              </div>
            )}

            {/* Hand -- filtered by position */}
            {!noMovesConfirmed && (
              <div style={{ flex: 1, overflowY: 'auto', padding: '6px 18px 0', minHeight: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ ...F.mono, fontSize: 9, color: T.muted, textTransform: 'uppercase' }}>Your Hand</span>
                  <span style={{ ...F.mono, fontSize: 9, color: T.dim }}>{moves.length} moves</span>
                </div>

                {console.log('[HAND DEBUG]', { stance: myStanceVal, movesCount: moves.length, moves: moves.map(m => m.name + '(' + m.type + ')') })}
                {moves.map(m => {
                  const tier = deckTiers[m.id] || 'trained';
                  const effGP = getEffGP(m);
                  const canAfford = myGp >= effGP;
                  const isSel = sel?.id === m.id && !sel?.isCounter;
                  const td = TierDisplay[tier] || TierDisplay.trained;
                  const typeColor = MTColors[m.type] || T.muted;
                  const hasVariant = !!variantMap[m.id];

                  return (
                    <div key={m.id} onClick={() => canAfford && setSel({ id: m.id, isCounter: false })} style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, marginBottom: 4,
                      cursor: canAfford ? 'pointer' : 'default', opacity: canAfford ? 1 : 0.3, transition: 'all 0.15s',
                      position: 'relative', overflow: 'hidden',
                      border: `1px solid ${isSel ? typeColor : tier === 'drilled' ? T.gold + '40' : T.border}`,
                      background: isSel ? typeColor + '10' : tier === 'drilled' ? T.gold + '06' : T.surface,
                    }}>
                      {/* Left accent bar */}
                      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: isSel ? typeColor : tier === 'drilled' ? T.gold : 'transparent', opacity: 0.6 }} />

                      {/* Type icon */}
                      <div style={{ width: 26, height: 26, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: typeColor + '14' }}>
                        <MoveIcon type={m.type} size={16} />
                      </div>

                      {/* Move info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, fontFamily: T.body, color: isSel ? T.white : hasVariant ? T.gold : T.text }}>
                            {hasVariant ? variantMap[m.id].variant_name : m.name}
                          </span>
                          {hasVariant && <span style={{ color: T.gold, fontSize: 10, lineHeight: 1 }}>&#9670;</span>}
                          <span style={{ fontSize: 9, color: td.c, lineHeight: 1 }}>{td.sym}</span>
                        </div>
                        <div style={{ ...F.mono, fontSize: 8, color: T.muted, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
                          <span style={{ fontSize: 7, padding: '1px 4px', borderRadius: 2, background: typeColor + '18', color: typeColor }}>{MTLabels[m.type] || 'MOVE'}</span>
                          <span style={{ color: T.dim }}>
                            {hasVariant ? m.name + ' > ' : ''}
                            {m.to_position ? G.positions[m.to_position]?.name?.replace(/ \(.*\)/, '') : 'SUBMISSION'}
                          </span>
                          {tier === 'drilled' && <span style={{ color: T.green }}>+15%</span>}
                          {tier === 'known' && <span style={{ color: T.red }}>-10%</span>}
                        </div>
                      </div>

                      {/* GP cost */}
                      <div style={{ textAlign: 'center', flexShrink: 0, minWidth: 32 }}>
                        {tier === 'drilled' && <div style={{ ...F.mono, fontSize: 8, color: T.green, textDecoration: 'line-through', textDecorationColor: T.muted }}>{m.gp_cost || GP_COSTS[m.type] || 1}</div>}
                        <div style={{ ...F.display, fontSize: 16, lineHeight: 1, color: tier === 'drilled' ? T.gold : !canAfford ? T.red : T.muted }}>{effGP}</div>
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

                {/* Counters -- styled cards, only in defend/setup */}
                {showCounters && counters.length === 0 && (
                  <div style={{ ...F.mono, fontSize: 9, color: T.dim, textAlign: 'center', padding: '10px 0' }}>
                    No counters available from this position
                  </div>
                )}
                {showCounters && counters.length > 0 && (
                  <>
                    <div style={{ ...F.mono, fontSize: 8, color: T.dim, textTransform: 'uppercase', margin: '10px 0 5px', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <MoveIcon type="counter" size={12} />
                      Counters <span style={{ color: T.green }}>0GP</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, paddingBottom: 8 }}>
                      {counters.map(c => {
                        const cSel = sel?.id === c.id && sel?.isCounter;
                        return (
                          <div key={c.id} onClick={() => setSel({ id: c.id, isCounter: true })} style={{
                            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 6, cursor: 'pointer',
                            border: `1px solid ${cSel ? T.gray : T.border}`,
                            background: cSel ? T.gray + '10' : T.surface,
                            transition: 'all 0.15s',
                          }}>
                            <MoveIcon type="counter" size={14} />
                            <span style={{ ...F.body, fontSize: 11, fontWeight: 500, color: cSel ? T.text : T.muted }}>{c.name}</span>
                            <span style={{ ...F.mono, fontSize: 9, color: T.green, marginLeft: 'auto' }}>0GP</span>
                            {cSel && (
                              <div style={{ width: 14, height: 14, borderRadius: '50%', background: T.gray, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <svg viewBox="0 0 12 12" width={7} height={7}><path d="M2 6L5 9L10 3" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Bottom lock-in */}
            {!noMovesConfirmed && (
              <div style={{ flexShrink: 0, padding: '8px 18px 28px', borderTop: `1px solid ${T.border}`, background: `linear-gradient(0deg, ${T.bg}, ${T.surface})` }}>
                <Btn onClick={lockMove} disabled={!sel || busy} style={{ animation: sel ? 'pulseGlow 2s infinite' : 'none' }}>
                  {busy ? <Spinner /> : sel ? 'Lock In Move' : 'Select a Move'}
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
          const tighten = match?.sub_tighten ?? 0;
          const subRound = match?.sub_round ?? 1;

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
                <div style={{ ...F.display, fontSize: 22, color: T.text, marginTop: 2 }}>{subTech?.name || 'Submission'}</div>
                <div style={{ ...F.mono, fontSize: 11, color: T.muted, marginTop: 4 }}>{isAtt ? 'Finish it!' : 'Escape or survive!'}</div>
              </div>

              {/* Tighten meter */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: 10 }}>
                <span style={{ ...F.mono, fontSize: 8, color: T.dim, width: 50, textAlign: 'right' }}>TIGHTEN</span>
                <div style={{ display: 'flex', gap: 3 }}>
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} style={{
                      width: 28, height: 7, borderRadius: 3,
                      background: i <= tighten ? T.red : T.dim + '30',
                      transition: 'background 0.3s',
                    }} />
                  ))}
                </div>
                <span style={{ ...F.mono, fontSize: 9, color: tighten >= 4 ? T.red : T.muted, width: 30 }}>{tighten}/5</span>
              </div>

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
                  <div style={{ ...F.mono, fontSize: 7, padding: '2px 5px', border: `1px solid ${T.blue}`, borderRadius: 2, color: T.blue, textTransform: 'uppercase', alignSelf: 'flex-start', marginBottom: 8 }}>{revealData?.oppMoveType ? (MTLabels[revealData.oppMoveType] || oppStanceVal?.toUpperCase()) : (oppStanceVal === 'attack' ? 'ATK' : oppStanceVal === 'defend' ? 'DEF' : 'SET')}</div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ ...F.display, fontSize: 20, color: '#7aaee0', lineHeight: 1.1 }}>{revealData?.oppMoveName || opp.display_name}</div>
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

      {/* ═══ KEYFRAMES ═══ */}
      <style>{`
        @keyframes pulseOut { 0% { transform: scale(1); opacity: 0.6; } 100% { transform: scale(2.4); opacity: 0; } }
        @keyframes blink { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }
        @keyframes pulseGlow { 0%, 100% { box-shadow: 0 0 0 0 ${T.red}40; } 50% { box-shadow: 0 0 12px 2px ${T.red}30; } }
        @keyframes shimmer { 0%, 100% { opacity: 1; filter: brightness(1); } 50% { opacity: 0.85; filter: brightness(1.3); } }
        @keyframes tapBounce { 0% { transform: scale(0); opacity: 0; } 50% { transform: scale(1.15); } 100% { transform: scale(1); opacity: 1; } }
        @keyframes tapShake { 0% { transform: translateX(0); } 15% { transform: translateX(-6px); } 30% { transform: translateX(5px); } 45% { transform: translateX(-4px); } 60% { transform: translateX(3px); } 75% { transform: translateX(-1px); } 100% { transform: translateX(0); } }
      `}</style>
    </div>
  );
}

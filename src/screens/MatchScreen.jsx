import React from 'react';
const { useState, useEffect, useRef, useCallback } = React;
import { sb, dbg, G, beltOrder, getStatus, getMoves } from '../lib/supabase';
import { ARCHETYPES, TYPE_COLORS, TYPE_SHORT, FAMILY_COLORS, GP_COSTS } from '../lib/constants';
import { Btn, Spinner, Center } from '../components/UI';
import BotEngine from '../lib/botEngine';

const S = {
  mono: { fontFamily: "'JetBrains Mono', monospace" },
  bebas: { fontFamily: "'Bebas Neue', sans-serif" },
};

export default function MatchScreen({ profile, matchId, onEnd, isBot = false, botId: botIdProp = null }) {
  const [match, setMatch] = useState(null);
  const [opp, setOpp] = useState(null);
  const [deck, setDeck] = useState([]);
  const [sel, setSel] = useState(null);
  const [moves, setMoves] = useState([]);
  const [busy, setBusy] = useState(false);
  const [lastTurn, setLastTurn] = useState(null);
  const [turnHistory, setTurnHistory] = useState([]);
  const [isBait, setIsBait] = useState(false);
  const [feintMove, setFeintMove] = useState(null);
  const [subSel, setSubSel] = useState(null);
  const [selectedStance, setSelectedStance] = useState(null);
  const [isBotMatch, setIsBotMatch] = useState(false);
  const [botId, setBotId] = useState(null);
  const [botArchetype, setBotArchetype] = useState(null);

  // Survive mechanic
  const [noMovesConfirmed, setNoMovesConfirmed] = useState(false);
  const [surviveBusy, setSurviveBusy] = useState(false);
  const [surviveResult, setSurviveResult] = useState(null);
  const [caughtBySub, setCaughtBySub] = useState(false);

  const SURVIVE_FLAVOR = {
    white:  'Hold on — just survive!',
    blue:   'Heart over technique — push through!',
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

  // Track what player locked in for the flip card display
  const lastLockedMoveRef = useRef(null);

  // Refs to avoid stale closures in polling/subscription
  const matchRef = useRef(null);
  const prevTurnRef = useRef(0);
  const revealTimerRef = useRef(null);
  const endedRef = useRef(false);

  // Keep matchRef in sync
  useEffect(() => { matchRef.current = match; }, [match]);

  // Derived (safe to compute from state)
  const amP1 = match?.player1_id === profile.id;
  const myPos = amP1 ? match?.player1_position : match?.player2_position;
  const myPts = amP1 ? match?.player1_points : match?.player2_points;
  const oppPts = amP1 ? match?.player2_points : match?.player1_points;
  const myLocked = amP1 ? match?.player1_move_locked : match?.player2_move_locked;
  const myStanceLocked = amP1 ? match?.player1_stance_locked : match?.player2_stance_locked;
  const oppStanceVal = amP1 ? match?.player2_stance : match?.player1_stance;
  const myStanceVal = amP1 ? match?.player1_stance : match?.player2_stance;
  const myFeints = amP1 ? match?.player1_feints_remaining : match?.player2_feints_remaining;
  const phase = match?.turn_phase || 'stance';
  const pos = G.positions[myPos];
  const myStatus = getStatus(myPos, profile.archetype);
  const myGp = amP1 ? (match?.player1_gp ?? 10) : (match?.player2_gp ?? 10);
  const oppGp = amP1 ? (match?.player2_gp ?? 10) : (match?.player1_gp ?? 10);
  const myChain = amP1 ? (match?.player1_chain ?? 0) : (match?.player2_chain ?? 0);

  const stanceMap = {
    attack: { icon: '⚔️', label: 'Attack', color: 'var(--red)', bg: 'var(--red-dim)', desc: 'Commit to offense — base GP cost', gp: 'Base GP' },
    defend: { icon: '🛡️', label: 'Defend', color: 'var(--muted)', bg: 'rgba(68,68,90,0.08)', desc: '+15% defense — counters free', gp: '0 GP' },
    setup:  { icon: '🔄', label: 'Setup', color: 'var(--blue)', bg: 'rgba(90,156,245,0.06)', desc: 'Recover grip — +2 GP', gp: '+2 GP' },
  };
  const statusColors = { dominant: 'var(--green)', neutral: 'var(--text-secondary)', defending: 'var(--amber)', disadvantaged: 'var(--red)' };
  const statusBg = { dominant: 'rgba(74,186,128,.08)', neutral: 'rgba(136,136,168,.06)', defending: 'rgba(240,160,80,.08)', disadvantaged: 'rgba(230,57,70,.08)' };

  // === CORE: Refresh match + turns from DB ===
  const refreshMatch = useCallback(async () => {
    const { data: m } = await sb.from('matches').select('*').eq('id', matchId).single();
    if (!m) return;

    const { data: t } = await sb.from('match_turns').select('*').eq('match_id', matchId).order('turn_number');
    if (t) { setTurnHistory(t); if (t.length > 0) setLastTurn(t[t.length - 1]); }

    // Check if turn advanced → trigger reveal
    if (m.current_turn > prevTurnRef.current && t && t.length > 0) {
      const latestTurn = t[t.length - 1];
      triggerReveal(latestTurn);
      prevTurnRef.current = m.current_turn;
    }

    setMatch(m);
    setSel(null); setIsBait(false); setFeintMove(null); setSelectedStance(null);
    setNoMovesConfirmed(false); setSurviveResult(null); setCaughtBySub(false);

    // Handle match end
    if (m.status === 'finished' && !endedRef.current) {
      endedRef.current = true;
      dbg('Match finished!', 'ok');
      setTimeout(() => onEnd(m), 2500);
    }
  }, [matchId]);

  // === INITIAL LOAD ===
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
        }
      }
      const { data: d } = await sb.from('player_move_stacks').select('technique_id, tier').eq('profile_id', profile.id);
      if (d) setDeck(d);
      const { data: t } = await sb.from('match_turns').select('*').eq('match_id', matchId).order('turn_number');
      if (t) { setTurnHistory(t); if (t.length > 0) setLastTurn(t[t.length - 1]); }
    })();
  }, [matchId]);

  // === REALTIME + POLLING FALLBACK ===
  useEffect(() => {
    // Real-time subscription
    const ch = sb.channel('match-' + matchId).on('postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'matches', filter: 'id=eq.' + matchId },
      () => { dbg('RT event received', 'ok'); refreshMatch(); }
    ).subscribe();

    // Polling fallback every 2s — catches missed RT events
    const poll = setInterval(async () => {
      const { data: m } = await sb.from('matches').select('current_turn, turn_phase, status, player1_move_locked, player2_move_locked, player1_stance_locked, player2_stance_locked').eq('id', matchId).single();
      if (!m || !matchRef.current) return;
      const prev = matchRef.current;
      // Only refresh if something changed
      if (m.current_turn !== prev.current_turn || m.turn_phase !== prev.turn_phase || m.status !== prev.status ||
          m.player1_move_locked !== prev.player1_move_locked || m.player2_move_locked !== prev.player2_move_locked ||
          m.player1_stance_locked !== prev.player1_stance_locked || m.player2_stance_locked !== prev.player2_stance_locked) {
        dbg('Poll detected change — refreshing', 'ok');
        refreshMatch();
      }
    }, 2000);

    return () => { sb.removeChannel(ch); clearInterval(poll); };
  }, [matchId, refreshMatch]);

  // === REVEAL ===
  function triggerReveal(turn) {
    const myMove = lastLockedMoveRef.current || { name: 'Your Move', type: 'unknown' };
    setRevealData({ description: turn.description || 'Position holds', result: turn.result, turn: turn.turn_number, myMoveName: myMove.name, myMoveType: myMove.type });
    setYourFlipped(false); setOppFlipped(false); setShowResult(false);
    setShowReveal(true);
    setTimeout(() => setYourFlipped(true), 400);
    setTimeout(() => setOppFlipped(true), 750);
    setTimeout(() => setShowResult(true), 1200);
    if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    revealTimerRef.current = setTimeout(dismissReveal, 4500);
    lastLockedMoveRef.current = null; // reset for next turn
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

  // === MOVES ===
  const deckIds = deck.map(d => d.technique_id);
  const deckTiers = {};
  deck.forEach(d => { deckTiers[d.technique_id] = d.tier || 'trained'; });

  useEffect(() => {
    if (myPos && deck.length > 0) {
      let m = getMoves(myPos, profile.belt, deckIds, match?.status === 'overtime', profile.archetype);
      if (m.length === 0) {
        for (const dp of ['defending_clinch', 'defending_passing', 'defending_leg_entanglement', 'defending_back', 'defending_mount']) {
          const defMoves = getMoves(dp, profile.belt, deckIds, false, profile.archetype);
          if (defMoves.length > 0) { m = defMoves; break; }
        }
      }
      setMoves(m);
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
  const counters = Object.values(G.counters).slice(0, 10);

  // === ACTIONS ===
  async function lockStance(stance) {
    if (busy) return; setSelectedStance(stance); setBusy(true);
    const { error } = await sb.rpc('submit_stance', { p_match_id: matchId, p_stance: stance });
    if (error) dbg('Stance error: ' + error.message, 'err');
    if (!error && isBotMatch) {
      BotEngine.respondToStance(matchRef.current, botId, botArchetype);
    }
    setBusy(false);
  }

  async function lockMove() {
    if (!sel || busy) return; setBusy(true);
    // Remember what we played for the flip card
    const allM = [...moves, ...counters.map(c => ({ ...c, type: 'counter' }))];
    const played = allM.find(m => m.id === sel.id);
    lastLockedMoveRef.current = played ? { name: played.name, type: played.type || 'counter' } : { name: '???', type: 'unknown' };
    const { error } = await sb.rpc('submit_move', { p_match_id: matchId, p_technique_id: sel.id, p_is_counter: sel.isCounter || false, p_is_bait: isBait, p_feint_move: feintMove });
    if (error) dbg('Move error: ' + error.message, 'err');
    if (!error && isBotMatch) {
      const m = matchRef.current;
      const botDrills = m?.player1_id === botId ? (m?.player1_drilled_moves || []) : (m?.player2_drilled_moves || []);
      const botPos = m?.player1_id === botId ? m?.player1_position : m?.player2_position;
      const { data: botHand } = await sb.rpc('draw_hand', {
        p_profile_id: botId,
        p_position: botPos || m?.current_position,
        p_archetype: botArchetype,
        p_drilled_moves: botDrills,
      });
      BotEngine.respondToMove(m, botId, botArchetype, botHand, botDrills, myStanceVal);
    }
    setBusy(false);
  }

  async function handleSurvive() {
    if (surviveBusy) return;
    setSurviveBusy(true);

    // In bot matches: trigger bot's move first, then check if they submitted a sub
    if (isBotMatch) {
      const m = matchRef.current;
      const botDrills = m?.player1_id === botId ? (m?.player1_drilled_moves || []) : (m?.player2_drilled_moves || []);
      const botPos = m?.player1_id === botId ? m?.player1_position : m?.player2_position;
      const { data: botHand } = await sb.rpc('draw_hand', {
        p_profile_id: botId,
        p_position: botPos || m?.current_position,
        p_archetype: botArchetype,
        p_drilled_moves: botDrills,
      });

      // Check if bot has a submission in hand
      let botHasSub = false;
      if (botHand && botHand.length > 0) {
        const { data: techs } = await sb.from('techniques').select('id, type').in('id', botHand);
        botHasSub = techs?.some(t => t.type === 'submission');
      }

      if (botHasSub) {
        // Bot has a sub — don't survive, let the sub land (CAUGHT!)
        setCaughtBySub(true);
        setSurviveBusy(false);
        // Let bot submit its move — it will pick the sub via archetype scoring
        await BotEngine.respondToMove(m, botId, botArchetype, botHand, botDrills, myStanceVal);
        return;
      }

      // Bot has no sub — let bot move, then resolve survive
      await BotEngine.respondToMove(m, botId, botArchetype, botHand, botDrills, myStanceVal);
    }

    const { data, error } = await sb.rpc('resolve_survive', { p_match_id: matchId, p_player_id: profile.id });
    if (error) dbg('Survive error: ' + error.message, 'err');
    const result = Array.isArray(data) ? data[0] : data;
    setSurviveResult(result || { success: false, message: 'Position held.' });
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
        BotEngine.respondToSubMinigame(match, botId, botIsAttacker);
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

  // === RENDER ===
  if (!match || !opp) return <Center><Spinner size={30} /><div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Loading match...</div></Center>;

  const gpPct = (myGp / 12) * 100;
  const gpColor = myGp <= 2 ? 'var(--red)' : myGp <= 5 ? 'var(--amber)' : 'var(--green)';
  const oppStaminaLabel = oppGp >= 8 ? 'Fresh' : oppGp >= 4 ? 'Tired' : 'Gassed';
  const oppStaminaColor = oppGp >= 8 ? 'var(--green)' : oppGp >= 4 ? 'var(--amber)' : 'var(--red)';

  // Determine what to show based on actual match state (not overlay flags)
  const showingStancePick = phase === 'stance' && !myStanceLocked && match.status !== 'finished';
  const showingStanceWait = phase === 'stance' && myStanceLocked && match.status !== 'finished';
  const showingMovePick = phase === 'move' && !myLocked && match.status !== 'finished';
  const showingMoveWait = phase === 'move' && myLocked && match.status !== 'finished';
  const showingSub = phase === 'sub_minigame' && match.sub_minigame_active;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>

      {/* ═══ SCORE HEADER ═══ */}
      <div style={{ padding: '4px 18px 6px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
          <span style={{ ...S.mono, fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase' }}>Turn <em style={{ color: 'var(--red)', fontStyle: 'normal' }}>{match.current_turn}/{match.max_turns}</em></span>
          <span style={{ ...S.mono, fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase' }}>{ARCHETYPES[profile.archetype]?.label?.slice(0,2)} vs {ARCHETYPES[opp.archetype]?.label?.slice(0,2)}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 50px 1fr', alignItems: 'center' }}>
          <div>
            <div style={{ ...S.mono, fontSize: 9, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>You</div>
            <div style={{ ...S.bebas, fontSize: 36, lineHeight: 1, color: myPts > oppPts ? 'var(--red)' : 'var(--text)' }}>{myPts || 0}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ ...S.bebas, fontSize: 18, color: 'var(--border-bright)' }}>{match.max_turns - match.current_turn + 1}</div>
            <div style={{ ...S.mono, fontSize: 7, color: 'var(--dim)', textTransform: 'uppercase' }}>left</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ ...S.mono, fontSize: 9, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Opp</div>
            <div style={{ ...S.bebas, fontSize: 36, lineHeight: 1, color: oppPts > myPts ? 'var(--red)' : 'var(--text)', textAlign: 'right' }}>{oppPts || 0}</div>
          </div>
        </div>
      </div>

      {/* ═══ RESOURCE BAR ═══ */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '6px 18px', gap: 8, borderBottom: '1px solid var(--border)', flexShrink: 0, background: 'var(--surface)' }}>
        <span style={{ fontSize: 10 }}>✊</span>
        <span style={{ ...S.bebas, fontSize: 18, color: gpColor, lineHeight: 1 }}>{myGp}</span>
        <span style={{ ...S.mono, fontSize: 8, color: 'var(--dim)' }}>/12 GP</span>
        <div style={{ flex: 1, height: 3, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: gpPct + '%', background: gpColor, borderRadius: 2, transition: 'width 0.3s' }} />
        </div>
        <div style={{ width: 1, height: 14, background: 'var(--border)' }} />
        <span style={{ ...S.mono, fontSize: 7, color: 'var(--dim)' }}>Chain</span>
        <span style={{ ...S.bebas, fontSize: 15, color: myChain >= 4 ? 'var(--red)' : myChain >= 2 ? 'var(--amber)' : 'var(--dim)', lineHeight: 1 }}>{myChain}</span>
        {myChain >= 2 && <span style={{ fontSize: 9 }}>{'🔥'.repeat(Math.min(myChain, 5))}</span>}
        <div style={{ width: 1, height: 14, background: 'var(--border)' }} />
        <span style={{ ...S.mono, fontSize: 8, padding: '2px 6px', borderRadius: 3, background: oppGp >= 8 ? 'rgba(74,186,128,.1)' : oppGp >= 4 ? 'rgba(240,160,80,.1)' : 'rgba(230,57,70,.1)', color: oppStaminaColor, fontWeight: 600, textTransform: 'uppercase' }}>{oppStaminaLabel}</span>
      </div>

      {/* ═══ POSITION ═══ */}
      <div style={{ flexShrink: 0, position: 'relative', height: 60, borderBottom: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', alignItems: 'flex-end', padding: '0 18px 8px', justifyContent: 'space-between' }}>
        <div>
          <div style={{ ...S.bebas, fontSize: 17, color: 'var(--text)', lineHeight: 1, marginBottom: 2 }}>{pos?.name?.replace(/ \(.*\)/, '') || 'Unknown'}</div>
          <div style={{ ...S.mono, fontSize: 8, color: FAMILY_COLORS[pos?.family] || 'var(--muted)', textTransform: 'uppercase' }}>{pos?.family?.replace('_', ' ')}</div>
        </div>
        <span style={{ ...S.mono, fontSize: 8, padding: '3px 8px', border: '1px solid', borderRadius: 3, textTransform: 'uppercase', fontWeight: 500, color: statusColors[myStatus], borderColor: statusColors[myStatus] + '66', background: statusBg[myStatus] }}>{myStatus}</span>
      </div>

      {/* ═══ PHASE CONTENT ═══ */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>

        {/* PHASE 1: STANCE */}
        {showingStancePick && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 18px', gap: 12 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ ...S.mono, fontSize: 9, letterSpacing: '0.1em', color: 'var(--muted)', textTransform: 'uppercase' }}>Phase 1</div>
              <div style={{ ...S.bebas, fontSize: 26 }}>Choose Your Stance</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {Object.entries(stanceMap).map(([id, cfg]) => (
                <div key={id} onClick={() => !busy && lockStance(id)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', border: '1px solid ' + (selectedStance === id ? cfg.color : 'var(--border)'), borderRadius: 'var(--radius)', background: selectedStance === id ? cfg.bg : 'var(--surface)', cursor: 'pointer', transition: 'all 0.18s', position: 'relative', overflow: 'hidden' }}>
                  {selectedStance === id && <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: cfg.color }} />}
                  <div style={{ width: 34, height: 34, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, background: cfg.color + '15', flexShrink: 0 }}>{cfg.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: selectedStance === id ? 'var(--text)' : 'var(--text-secondary)' }}>{cfg.label}</div>
                    <div style={{ ...S.mono, fontSize: 8, color: 'var(--dim)' }}>{cfg.desc}</div>
                  </div>
                  <div style={{ ...S.mono, fontSize: 9, fontWeight: 600, color: selectedStance === id ? cfg.color : 'var(--dim)' }}>{cfg.gp}</div>
                </div>
              ))}
            </div>
            {oppTendency.length > 0 && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
              <span style={{ ...S.mono, fontSize: 8, color: 'var(--dim)', textTransform: 'uppercase' }}>Opp last 3:</span>
              {oppTendency.map((s, i) => <span key={i} style={{ ...S.mono, fontSize: 8, padding: '2px 5px', borderRadius: 2, textTransform: 'uppercase', background: s === 'attack' ? 'rgba(230,57,70,.1)' : s === 'setup' ? 'rgba(90,156,245,.08)' : 'rgba(68,68,90,.1)', color: s === 'attack' ? 'rgba(230,57,70,.7)' : s === 'setup' ? 'rgba(90,156,245,.6)' : 'var(--muted)' }}>{s === 'attack' ? 'ATK' : s === 'defend' ? 'DEF' : 'SET'}</span>)}
            </div>}
            {busy && <div style={{ textAlign: 'center' }}><Spinner /></div>}
          </div>
        )}

        {showingStanceWait && <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}><Spinner /><div style={{ ...S.mono, fontSize: 11, color: 'var(--text-secondary)' }}>Stance locked — waiting for opponent...</div></div>}

        {/* PHASE 2: MOVES */}
        {showingMovePick && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Revealed stances */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, padding: '7px 18px', borderBottom: '1px solid var(--border)', flexShrink: 0, background: 'var(--surface)' }}>
              {[['You', myStanceVal], ['Opp', oppStanceVal]].map(([who, stance], idx) => (
                <React.Fragment key={who}>
                  {idx === 1 && <span style={{ ...S.mono, fontSize: 8, color: 'var(--dim)' }}>vs</span>}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ ...S.mono, fontSize: 8, color: 'var(--dim)', textTransform: 'uppercase' }}>{who}</span>
                    <span style={{ ...S.mono, fontSize: 9, padding: '3px 7px', borderRadius: 3, fontWeight: 600, textTransform: 'uppercase', background: stance === 'attack' ? 'rgba(230,57,70,.12)' : stance === 'setup' ? 'rgba(90,156,245,.1)' : 'rgba(68,68,90,.12)', color: stance === 'attack' ? 'var(--red)' : stance === 'setup' ? 'var(--blue)' : 'var(--text-secondary)' }}>{stance === 'attack' ? 'ATK' : stance === 'defend' ? 'DEF' : 'SET'}</span>
                  </div>
                </React.Fragment>
              ))}
            </div>

            {/* Survive UI — shown when hand is confirmed empty */}
            {noMovesConfirmed && !caughtBySub && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 24px', gap: 14 }}>
                <div style={{ fontSize: 32 }}>🛡️</div>
                <div style={{ ...S.bebas, fontSize: 22, textAlign: 'center' }}>No Moves Available</div>
                <div style={{ ...S.mono, fontSize: 11, color: 'var(--text-secondary)', textAlign: 'center' }}>
                  {SURVIVE_FLAVOR[profile.belt] || SURVIVE_FLAVOR.white}
                </div>
                {surviveResult ? (
                  <div style={{ width: '100%', padding: '14px', borderRadius: 'var(--radius)', border: '1px solid ' + (surviveResult.success ? 'rgba(74,186,128,.35)' : 'rgba(230,57,70,.35)'), background: surviveResult.success ? 'rgba(74,186,128,.06)' : 'rgba(230,57,70,.06)', textAlign: 'center' }}>
                    <div style={{ ...S.bebas, fontSize: 20, color: surviveResult.success ? 'var(--green)' : 'var(--red)', marginBottom: 4 }}>
                      {surviveResult.success ? 'SURVIVED' : 'HELD DOWN'}
                    </div>
                    {surviveResult.roll !== undefined && (
                      <div style={{ ...S.mono, fontSize: 9, color: 'var(--text-secondary)', marginBottom: 4 }}>
                        Roll {surviveResult.roll} vs threshold {surviveResult.final_chance ?? surviveResult.threshold ?? '?'}
                        {surviveResult.chain_penalty ? ` (chain −${Math.abs(surviveResult.chain_penalty)})` : ''}
                      </div>
                    )}
                    <div style={{ ...S.mono, fontSize: 10, color: 'var(--text)' }}>{surviveResult.message || ''}</div>
                  </div>
                ) : (
                  <Btn onClick={handleSurvive} disabled={surviveBusy} style={{ width: '100%' }}>
                    {surviveBusy ? <Spinner /> : 'Survive'}
                  </Btn>
                )}
              </div>
            )}

            {/* CAUGHT! — opponent locked a sub while you have no moves */}
            {noMovesConfirmed && caughtBySub && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 24px', gap: 14 }}>
                <div style={{ fontSize: 32 }}>💀</div>
                <div style={{ ...S.bebas, fontSize: 26, textAlign: 'center', color: 'var(--red)' }}>CAUGHT!</div>
                <div style={{ ...S.mono, fontSize: 11, color: 'var(--text-secondary)', textAlign: 'center' }}>
                  No escape routes — opponent is attacking a submission!
                </div>
                <div style={{ ...S.mono, fontSize: 9, color: 'var(--dim)', textAlign: 'center' }}>
                  Entering submission minigame at disadvantage...
                </div>
              </div>
            )}

            {/* Hand */}
            {!noMovesConfirmed && <div style={{ flex: 1, overflowY: 'auto', padding: '6px 18px 0', minHeight: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ ...S.mono, fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase' }}>Your Hand</span>
                <span style={{ ...S.mono, fontSize: 9, color: 'var(--dim)' }}>{moves.length} moves</span>
              </div>

              {moves.map(m => {
                const tier = deckTiers[m.id] || 'trained';
                const effGP = getEffGP(m);
                const canAfford = myGp >= effGP;
                const isSel = sel?.id === m.id && !sel?.isCounter;
                const typeShort = TYPE_SHORT[m.type] || 'trans';
                const tierIcon = tier === 'drilled' ? '★' : tier === 'trained' ? '─' : '░';

                return (
                  <div key={m.id} onClick={() => canAfford && setSel({ id: m.id, isCounter: false })} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 11px', borderRadius: 'var(--radius-sm)', marginBottom: 4, cursor: canAfford ? 'pointer' : 'default', opacity: canAfford ? 1 : 0.3, transition: 'all 0.15s', position: 'relative', overflow: 'hidden', border: isSel ? '1px solid var(--red)' : tier === 'drilled' ? '1px solid var(--tier-drilled-border)' : '1px solid var(--border)', background: isSel ? 'var(--red-dim)' : tier === 'drilled' ? 'var(--tier-drilled-bg)' : tier === 'known' ? 'var(--tier-known-bg)' : 'var(--surface)' }}>
                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: isSel ? 'var(--red)' : tier === 'drilled' ? 'var(--tier-drilled)' : 'transparent', opacity: 0.6 }} />
                    <div style={{ width: 22, height: 22, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, flexShrink: 0, background: tier === 'drilled' ? 'rgba(245,200,66,.1)' : 'rgba(136,136,168,.08)', color: tier === 'drilled' ? 'var(--tier-drilled)' : 'var(--text-secondary)' }}>{tierIcon}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: isSel ? '#fff' : 'var(--text)' }}>{m.name}</div>
                      <div style={{ ...S.mono, fontSize: 8, color: 'var(--muted)', textTransform: 'uppercase' }}>
                        <span style={{ fontSize: 7, padding: '1px 4px', borderRadius: 2, marginRight: 4, background: TYPE_COLORS[m.type] + '18', color: TYPE_COLORS[m.type] }}>{typeShort}</span>
                        {m.to_position ? G.positions[m.to_position]?.name?.replace(/ \(.*\)/, '') : 'SUBMISSION'}
                        {tier === 'drilled' ? ' · +15%' : tier === 'known' ? ' · -10%' : ''}
                      </div>
                    </div>
                    <div style={{ textAlign: 'center', flexShrink: 0, minWidth: 32 }}>
                      {tier === 'drilled' && <div style={{ ...S.mono, fontSize: 8, color: 'var(--green)', textDecoration: 'line-through', textDecorationColor: 'var(--muted)' }}>{m.gp_cost || GP_COSTS[m.type] || 1}</div>}
                      <div style={{ ...S.bebas, fontSize: 16, lineHeight: 1, color: tier === 'drilled' ? 'var(--tier-drilled)' : !canAfford ? 'var(--red)' : 'var(--text-secondary)' }}>{effGP}</div>
                      <div style={{ ...S.mono, fontSize: 7, color: 'var(--dim)' }}>GP</div>
                    </div>
                    {isSel && <div style={{ position: 'absolute', top: 6, right: 8, width: 16, height: 16, borderRadius: '50%', background: 'var(--red)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: '#fff', fontWeight: 700 }}>✓</div>}
                  </div>
                );
              })}

              <div style={{ ...S.mono, fontSize: 8, color: 'var(--dim)', textTransform: 'uppercase', margin: '8px 0 5px' }}>Counters <span style={{ color: 'var(--green)' }}>0GP</span></div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', paddingBottom: 8 }}>
                {counters.map(c => (
                  <div key={c.id} onClick={() => setSel({ id: c.id, isCounter: true })} style={{ ...S.mono, padding: '5px 9px', borderRadius: 'var(--radius-sm)', fontSize: 9, cursor: 'pointer', background: sel?.id === c.id ? 'rgba(74,186,128,.08)' : 'var(--surface2)', border: '1px solid ' + (sel?.id === c.id ? 'var(--green)' : 'var(--border)'), color: sel?.id === c.id ? 'var(--green)' : 'var(--text-secondary)' }}>{c.name}</div>
                ))}
              </div>
            </div>}

            {/* Bottom */}
            {!noMovesConfirmed && <div style={{ flexShrink: 0, padding: '8px 18px 28px', borderTop: '1px solid var(--border)', background: 'linear-gradient(0deg, var(--bg), var(--surface))' }}>
              <div style={{ display: 'flex', gap: 6, marginBottom: 7 }}>
                <div onClick={() => setIsBait(!isBait)} style={{ flex: 1, padding: '6px', borderRadius: 'var(--radius-sm)', border: '1px solid ' + (isBait ? 'var(--amber)' : 'var(--border)'), textAlign: 'center', cursor: 'pointer' }}>
                  <div style={{ ...S.mono, fontSize: 9, fontWeight: 600, color: isBait ? 'var(--amber)' : 'var(--muted)' }}>🎭 Bait</div>
                </div>
                <div onClick={() => myFeints > 0 && setFeintMove(feintMove ? null : 'placeholder')} style={{ flex: 1, padding: '6px', borderRadius: 'var(--radius-sm)', border: '1px solid ' + (feintMove ? 'var(--purple)' : 'var(--border)'), textAlign: 'center', cursor: myFeints > 0 ? 'pointer' : 'default', opacity: myFeints > 0 ? 1 : 0.4 }}>
                  <div style={{ ...S.mono, fontSize: 9, fontWeight: 600, color: feintMove ? 'var(--purple)' : 'var(--muted)' }}>👻 Feint ({myFeints || 0})</div>
                </div>
              </div>
              <Btn onClick={lockMove} disabled={!sel || busy} style={{ animation: sel ? 'pulseGlow 2s infinite' : 'none' }}>
                {busy ? <Spinner /> : sel ? 'Lock In Move' : 'Select a Move'}
              </Btn>
            </div>}
          </div>
        )}

        {showingMoveWait && <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <div style={{ position: 'relative', width: 70, height: 70, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {[0, 0.6, 1.2].map((d, i) => <div key={i} style={{ position: 'absolute', borderRadius: '50%', border: '1px solid var(--red)', width: 36, height: 36, opacity: 0, animation: `pulseOut 1.8s ease-out ${d}s infinite` }} />)}
            <div style={{ width: 34, height: 34, borderRadius: '50%', border: '1px solid var(--red)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, zIndex: 2 }}>✊</div>
          </div>
          <div style={{ ...S.mono, fontSize: 11, color: 'var(--text-secondary)' }}>Move locked — waiting...</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, ...S.mono, fontSize: 8, color: 'var(--dim)' }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--amber)', animation: 'blink 1s ease-in-out infinite' }} />Opponent deciding
          </div>
        </div>}

        {phase === 'resolving' && <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spinner size={24} /><span style={{ ...S.mono, fontSize: 12, color: 'var(--text-secondary)', marginLeft: 8 }}>Resolving...</span></div>}

        {/* SUB MINIGAME */}
        {showingSub && (() => {
          const isAtt = match.sub_attacker_id === profile.id;
          const subTech = G.techniques[match.sub_technique_id];
          const myLk = isAtt ? match.sub_attacker_locked : match.sub_defender_locked;
          const attOpts = [{ id:'squeeze',label:'Squeeze',desc:'Commit fully (2GP)',icon:'💪',cost:2 },{ id:'adjust',label:'Adjust',desc:'Reposition (1GP)',icon:'🔄',cost:1 },{ id:'transition_sub',label:'Chain Sub',desc:'Switch sub (1GP)',icon:'⛓️',cost:1 }];
          const defOpts = [{ id:'technical_escape',label:'Tech Escape',desc:'Strip grip (1GP)',icon:'🏃',cost:1 },{ id:'explode',label:'Explode',desc:'All-out (2GP)',icon:'💥',cost:2 },{ id:'survive',label:'Survive',desc:'Weather storm (1GP)',icon:'🛡️',cost:1 },{ id:'sweep_scramble',label:'Sweep',desc:'Escape+position (2GP)',icon:'🌀',cost:2 },{ id:'reversal_sub',label:'Reversal!',desc:'Counter-sub (3GP)',icon:'⚡',cost:3 }];
          const opts = isAtt ? attOpts : defOpts;
          return (
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 18px 100px' }}>
              <div style={{ textAlign: 'center', margin: '12px 0', padding: 14, background: 'rgba(230,57,70,.06)', borderRadius: 'var(--radius)', border: '1px solid rgba(230,57,70,.2)' }}>
                <div style={{ ...S.mono, fontSize: 11, color: 'var(--red)', fontWeight: 700 }}>💥 SUBMISSION</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{subTech?.name || 'Submission'}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>{isAtt ? 'Finish it!' : 'Escape or survive!'}</div>
              </div>
              {!myLk && opts.map(o => (
                <div key={o.id} onClick={() => myGp >= o.cost && setSubSel(o.id)} style={{ background: subSel === o.id ? 'rgba(230,57,70,.06)' : 'var(--surface)', border: '1px solid ' + (subSel === o.id ? 'var(--red)' : 'var(--border)'), borderRadius: 'var(--radius-sm)', padding: '11px 14px', marginBottom: 5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: myGp >= o.cost ? 'pointer' : 'default', opacity: myGp >= o.cost ? 1 : 0.35 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span style={{ fontSize: 18 }}>{o.icon}</span><div><div style={{ fontSize: 13, fontWeight: 600 }}>{o.label}</div><div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{o.desc}</div></div></div>
                  <span style={{ ...S.mono, fontSize: 10, color: 'var(--amber)', fontWeight: 700 }}>{o.cost}GP</span>
                </div>
              ))}
              {myLk && <div style={{ textAlign: 'center', padding: 20 }}><Spinner /><div style={{ ...S.mono, fontSize: 11, color: 'var(--text-secondary)', marginTop: 8 }}>Locked — waiting...</div></div>}
              {!myLk && <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '10px 18px 28px', background: 'linear-gradient(180deg, transparent 0%, var(--bg) 40%)' }}>
                <Btn onClick={lockSubChoice} disabled={!subSel || busy} style={{ background: subSel ? 'linear-gradient(135deg, var(--red), #c0392b)' : undefined }}>
                  {busy ? <Spinner /> : subSel ? '💥 Lock In' : 'Select an Option'}
                </Btn>
              </div>}
            </div>
          );
        })()}

        {match.status === 'finished' && !showReveal && <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}><div style={{ fontSize: 28 }}>🏁</div><div style={{ fontSize: 16, fontWeight: 700 }}>Match Complete</div><div style={{ ...S.mono, fontSize: 10, color: 'var(--text-secondary)' }}>Loading results...</div></div>}
      </div>

      {/* ═══ REVEAL OVERLAY ═══ */}
      {showReveal && revealData && (
        <div onClick={dismissReveal} style={{ position: 'absolute', inset: 0, zIndex: 60, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', cursor: 'pointer' }}>
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)', backgroundSize: '20px 20px', opacity: 0.1 }} />

          <div style={{ ...S.mono, fontSize: 9, letterSpacing: '0.2em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 20, zIndex: 2 }}>Turn {revealData.turn} — Reveal</div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 20, zIndex: 2 }}>
            {/* Your card */}
            <div style={{ width: 130, height: 155, perspective: 700 }}>
              <div style={{ width: '100%', height: '100%', position: 'relative', transformStyle: 'preserve-3d', transition: 'transform 0.6s cubic-bezier(0.4,0,0.2,1)', transform: yourFlipped ? 'rotateY(180deg)' : 'none' }}>
                <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', borderRadius: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', border: '1px solid var(--border-bright)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ width: 22, height: 22, borderRadius: '50%', border: '1px solid var(--border)' }} /></div>
                  <div style={{ ...S.bebas, fontSize: 10, letterSpacing: '0.1em', color: 'var(--border-bright)' }}>OPEN MAT</div>
                </div>
                <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', transform: 'rotateY(180deg)', borderRadius: 6, display: 'flex', flexDirection: 'column', padding: 14, background: '#2a0810', border: '1px solid var(--red)' }}>
                  <div style={{ ...S.mono, fontSize: 8, color: 'var(--red)', textTransform: 'uppercase', marginBottom: 4 }}>You played</div>
                  <div style={{ ...S.mono, fontSize: 7, padding: '2px 5px', border: '1px solid var(--red)', borderRadius: 2, color: 'var(--red)', textTransform: 'uppercase', alignSelf: 'flex-start', marginBottom: 8 }}>{TYPE_SHORT[revealData?.myMoveType] || 'move'}</div>
                  <div style={{ ...S.bebas, fontSize: 22, color: '#fff', lineHeight: 1.1, flex: 1, display: 'flex', alignItems: 'center' }}>{revealData?.myMoveName || 'Your Move'}</div>
                  <div style={{ ...S.mono, fontSize: 8, color: 'var(--muted)' }}>{myStanceVal}</div>
                </div>
              </div>
            </div>

            <div style={{ ...S.bebas, fontSize: 11, color: 'var(--dim)', zIndex: 2 }}>VS</div>

            {/* Opp card */}
            <div style={{ width: 130, height: 155, perspective: 700 }}>
              <div style={{ width: '100%', height: '100%', position: 'relative', transformStyle: 'preserve-3d', transition: 'transform 0.6s cubic-bezier(0.4,0,0.2,1)', transform: oppFlipped ? 'rotateY(180deg)' : 'none' }}>
                <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', borderRadius: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', border: '1px solid var(--border-bright)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ width: 22, height: 22, borderRadius: '50%', border: '1px solid var(--border)' }} /></div>
                  <div style={{ ...S.bebas, fontSize: 10, letterSpacing: '0.1em', color: 'var(--border-bright)' }}>OPEN MAT</div>
                </div>
                <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', transform: 'rotateY(180deg)', borderRadius: 6, display: 'flex', flexDirection: 'column', padding: 14, background: '#050d1a', border: '1px solid var(--blue)' }}>
                  <div style={{ ...S.mono, fontSize: 8, color: 'var(--blue)', textTransform: 'uppercase', marginBottom: 4 }}>Opponent</div>
                  <div style={{ ...S.mono, fontSize: 7, padding: '2px 5px', border: '1px solid var(--blue)', borderRadius: 2, color: 'var(--blue)', textTransform: 'uppercase', alignSelf: 'flex-start', marginBottom: 8 }}>{oppStanceVal === 'attack' ? 'ATK' : oppStanceVal === 'defend' ? 'DEF' : 'SET'}</div>
                  <div style={{ ...S.bebas, fontSize: 22, color: '#7aaee0', lineHeight: 1.1, flex: 1, display: 'flex', alignItems: 'center' }}>{opp.display_name}</div>
                  <div style={{ ...S.mono, fontSize: 8, color: 'var(--muted)' }}>{ARCHETYPES[opp.archetype]?.label}</div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ zIndex: 2, textAlign: 'center', opacity: showResult ? 1 : 0, transform: showResult ? 'translateY(0)' : 'translateY(12px)', transition: 'opacity 0.4s, transform 0.4s' }}>
            <div style={{ ...S.bebas, fontSize: 28, lineHeight: 1, marginBottom: 4, color: revealData.result === 'submission_win' ? '#e63946' : revealData.result === 'sweep' ? '#4aba80' : '#f0a050' }}>{revealData.description}</div>
            <div style={{ ...S.mono, fontSize: 8, color: 'var(--dim)', marginTop: 10 }}>Tap anywhere to continue</div>
          </div>
        </div>
      )}

      <style>{`@keyframes pulseOut { 0% { transform: scale(1); opacity: 0.6; } 100% { transform: scale(2.4); opacity: 0; } }`}</style>
    </div>
  );
}

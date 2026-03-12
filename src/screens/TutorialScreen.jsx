import React from 'react';
const { useState, useEffect, useRef, useCallback } = React;
import { sb, dbg, G, getStatus, getMoves } from '../lib/supabase';
import { GP_COSTS } from '../lib/constants';
import { T, MTColors, MTLabels, TierDisplay } from '../lib/tokens';
import { MoveIcon, StanceIcon } from '../lib/icons';
import { Btn, Spinner, Center } from '../components/UI';
import BotEngine from '../lib/botEngine';

// ═══════════════════════════════════════════════════════════
// TUTORIAL SCREEN — Guided match vs Coach (Iron Mike bot)
// Real Supabase match with overlay instructions
// ═══════════════════════════════════════════════════════════

const COACH_UUID = '00000001-0000-0000-0000-000000000001';

// Tutorial step definitions
const STEPS = {
  LOADING: 'loading',
  T1_STANCE_INTRO: 't1_stance_intro',
  T1_STANCE_PICK: 't1_stance_pick',
  T2_MOVE_INTRO: 't2_move_intro',
  T2_MOVE_PICK: 't2_move_pick',
  T2_REVEAL: 't2_reveal',
  T3_GP_INTRO: 't3_gp_intro',
  T3_FREE: 't3_free',
  T4_FREE: 't4_free',
  T5_SUB_INTRO: 't5_sub_intro',
  T5_SUB_PICK: 't5_sub_pick',
  FINISH: 'finish',
};

export default function TutorialScreen({ profile, user, onComplete }) {
  const [matchId, setMatchId] = useState(null);
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
  const [variantMap, setVariantMap] = useState({});

  // Survive
  const [noMovesConfirmed, setNoMovesConfirmed] = useState(false);
  const [surviveBusy, setSurviveBusy] = useState(false);
  const [surviveResult, setSurviveResult] = useState(null);
  const [caughtBySub, setCaughtBySub] = useState(false);

  // Reveal
  const [showReveal, setShowReveal] = useState(false);
  const [revealData, setRevealData] = useState(null);
  const [yourFlipped, setYourFlipped] = useState(false);
  const [oppFlipped, setOppFlipped] = useState(false);
  const [showResult, setShowResult] = useState(false);

  // Tutorial step
  const [step, setStep] = useState(STEPS.LOADING);
  const [overlayDismissed, setOverlayDismissed] = useState(false);
  const [subFallbackShown, setSubFallbackShown] = useState(false);
  const subEverTriggeredRef = useRef(false);

  const lastLockedMoveRef = useRef(null);
  const matchRef = useRef(null);
  const prevTurnRef = useRef(0);
  const revealTimerRef = useRef(null);
  const endedRef = useRef(false);

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
  const myGp = amP1 ? (match?.player1_gp ?? 10) : (match?.player2_gp ?? 10);
  const oppGp = amP1 ? (match?.player2_gp ?? 10) : (match?.player1_gp ?? 10);
  const myChain = amP1 ? (match?.player1_chain ?? 0) : (match?.player2_chain ?? 0);
  const currentTurn = match?.current_turn ?? 1;

  const F = {
    display: { fontFamily: T.display },
    mono: { fontFamily: T.mono },
    body: { fontFamily: T.body },
  };

  // ── CREATE TUTORIAL MATCH ───────────────────────────────
  useEffect(() => {
    (async () => {
      dbg('Tutorial: creating match vs Coach...', 'ok');
      try {
        const { data: mId, error } = await sb.rpc('challenge_bot', {
          p_player_id: user.id,
          p_bot_id: COACH_UUID,
        });
        if (error) { dbg('Tutorial match error: ' + error.message, 'err'); return; }
        if (!mId) { dbg('Tutorial: no match ID returned', 'err'); return; }
        dbg('Tutorial match created: ' + mId, 'ok');
        setMatchId(mId);

        // Load match
        const { data: m } = await sb.from('matches').select('*').eq('id', mId).single();
        if (m) { setMatch(m); matchRef.current = m; prevTurnRef.current = m.current_turn; }

        // Load opponent (Coach)
        const oppId = m?.player1_id === profile.id ? m?.player2_id : m?.player1_id;
        const { data: o } = await sb.from('profiles').select('*').eq('id', oppId).single();
        if (o) setOpp(o);

        // Load deck
        const { data: d } = await sb.from('player_move_stacks').select('technique_id, tier, equipped_variant').eq('profile_id', profile.id);
        if (d) {
          setDeck(d);
          // Auto-drill first 3 moves
          const drillIds = d.slice(0, 3).map(r => r.technique_id);
          await sb.rpc('set_drilled_moves', { p_match_id: mId, p_moves: drillIds });
        }

        // Load turns
        const { data: t } = await sb.from('match_turns').select('*').eq('match_id', mId).order('turn_number');
        if (t) { setTurnHistory(t); if (t.length > 0) setLastTurn(t[t.length - 1]); }

        setStep(STEPS.T1_STANCE_INTRO);
      } catch (e) {
        dbg('Tutorial setup failed: ' + e.message, 'err');
      }
    })();
  }, []);

  // ── REALTIME + POLLING ──────────────────────────────────
  const refreshMatch = useCallback(async () => {
    if (!matchId) return;
    const { data: m } = await sb.from('matches').select('*').eq('id', matchId).single();
    if (!m) return;

    const { data: t } = await sb.from('match_turns').select('*').eq('match_id', matchId).order('turn_number');
    if (t) { setTurnHistory(t); if (t.length > 0) setLastTurn(t[t.length - 1]); }

    if (m.current_turn > prevTurnRef.current && t && t.length > 0) {
      triggerReveal(t[t.length - 1]);
      prevTurnRef.current = m.current_turn;
    }

    setMatch(m);
    setSel(null); setSelectedStance(null);
    setNoMovesConfirmed(false); setSurviveResult(null); setCaughtBySub(false);

    // Advance tutorial step based on turn
    const mPhase = m.turn_phase || 'stance';
    if (m.current_turn === 2 && mPhase === 'stance') setStep(STEPS.T2_MOVE_INTRO);
    if (m.current_turn === 3 && mPhase === 'stance') setStep(STEPS.T3_GP_INTRO);
    if (m.current_turn >= 4 && mPhase === 'stance' && step !== STEPS.FINISH && step !== STEPS.T5_SUB_INTRO && step !== STEPS.T5_SUB_PICK) setStep(STEPS.T4_FREE);
    if (m.sub_minigame_active && step !== STEPS.T5_SUB_PICK) {
      subEverTriggeredRef.current = true;
      setStep(STEPS.T5_SUB_INTRO);
    }
    // Fallback: if turn >= 5 and no sub ever triggered, show scripted sub explanation
    if (m.current_turn >= 5 && !subEverTriggeredRef.current && !subFallbackShown && mPhase === 'stance' && step !== STEPS.FINISH) {
      setSubFallbackShown(true);
    }

    if (m.status === 'finished' && !endedRef.current) {
      endedRef.current = true;
      localStorage.setItem('openmat_tutorial_done', 'true');
      setStep(STEPS.FINISH);
    }
  }, [matchId]);

  useEffect(() => {
    if (!matchId) return;
    const ch = sb.channel('tut-match-' + matchId).on('postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'matches', filter: 'id=eq.' + matchId },
      () => refreshMatch()
    ).subscribe();

    const poll = setInterval(async () => {
      if (!matchRef.current) return;
      const { data: m } = await sb.from('matches').select('current_turn, turn_phase, status, player1_move_locked, player2_move_locked, player1_stance_locked, player2_stance_locked, sub_minigame_active').eq('id', matchId).single();
      if (!m) return;
      const prev = matchRef.current;
      if (m.current_turn !== prev.current_turn || m.turn_phase !== prev.turn_phase || m.status !== prev.status ||
          m.player1_move_locked !== prev.player1_move_locked || m.player2_move_locked !== prev.player2_move_locked ||
          m.player1_stance_locked !== prev.player1_stance_locked || m.player2_stance_locked !== prev.player2_stance_locked ||
          m.sub_minigame_active !== prev.sub_minigame_active) {
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
    // Extract coach's move from turn data
    const oppTechId = amP1 ? turn.player2_technique_id : turn.player1_technique_id;
    const oppTech = oppTechId ? G.techniques[oppTechId] : null;
    const oppMoveName = oppTech?.name || 'Defended';
    const oppMoveType = oppTech?.type || 'unknown';
    setRevealData({ description: cleanDesc, result: turn.result, turn: turn.turn_number, myMoveName: myMove.name, myMoveType: myMove.type, variantName, oppMoveName, oppMoveType });
    setYourFlipped(false); setOppFlipped(false); setShowResult(false);
    setShowReveal(true);
    setTimeout(() => setYourFlipped(true), 400);
    setTimeout(() => setOppFlipped(true), 750);
    setTimeout(() => setShowResult(true), 1200);
    if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    revealTimerRef.current = setTimeout(dismissReveal, 5000);
    lastLockedMoveRef.current = null;
  }

  function dismissReveal() {
    if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    setShowReveal(false); setRevealData(null);
    setYourFlipped(false); setOppFlipped(false); setShowResult(false);
    setOverlayDismissed(false);
  }

  // ── MOVES ───────────────────────────────────────────────
  const deckIds = deck.map(d => d.technique_id);
  const deckTiers = {};
  deck.forEach(d => { deckTiers[d.technique_id] = d.tier || 'trained'; });

  useEffect(() => {
    if (myPos && deck.length > 0) {
      let m = getMoves(myPos, profile.belt, deckIds, false, profile.archetype);
      if (m.length === 0) {
        for (const dp of ['defending_clinch', 'defending_passing', 'defending_leg_entanglement', 'defending_back', 'defending_mount']) {
          const defMoves = getMoves(dp, profile.belt, deckIds, false, profile.archetype);
          if (defMoves.length > 0) { m = defMoves; break; }
        }
      }
      setMoves(m);
    }
  }, [myPos, deck]);

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

  const counters = Object.values(G.counters).filter(c => {
    const cPos = c.from_position || c.position || c.applicable_position;
    return cPos && cPos === myPos;
  });

  // ── ACTIONS ─────────────────────────────────────────────
  async function lockStance(stance) {
    if (busy) return; setSelectedStance(stance); setBusy(true);
    const { error } = await sb.rpc('submit_stance', { p_match_id: matchId, p_stance: stance });
    if (error) dbg('Stance error: ' + error.message, 'err');
    if (!error) {
      // Bot responds immediately in tutorial (no delay)
      setTimeout(() => {
        BotEngine.respondToStance(matchRef.current, COACH_UUID, 'wrestler', 'easy');
      }, 300);
    }
    setBusy(false);
    if (step === STEPS.T1_STANCE_PICK) setStep(STEPS.T2_MOVE_INTRO);
    setOverlayDismissed(false);
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
    if (!error) {
      const m = matchRef.current;
      const botDrills = m?.player1_id === COACH_UUID ? (m?.player1_drilled_moves || []) : (m?.player2_drilled_moves || []);
      const botPos = m?.player1_id === COACH_UUID ? m?.player1_position : m?.player2_position;
      const { data: botHand } = await sb.rpc('draw_hand', {
        p_profile_id: COACH_UUID,
        p_position: botPos || m?.current_position,
        p_archetype: 'wrestler',
        p_drilled_moves: botDrills,
      });
      await BotEngine.respondToMove(m, COACH_UUID, 'wrestler', botHand, botDrills, myStanceVal, 'easy');
      setTimeout(() => refreshMatch(), 500);
    }
    setBusy(false);
  }

  async function handleSurvive() {
    if (surviveBusy) return;
    setSurviveBusy(true);
    // Player survive first
    const { data, error } = await sb.rpc('resolve_survive', { p_match_id: matchId, p_player_id: profile.id });
    if (error) dbg('Survive error: ' + error.message, 'err');
    const result = Array.isArray(data) ? data[0] : data;
    setSurviveResult(result || { success: false, message: 'Position held.' });

    const m = matchRef.current;
    const botDrills = m?.player1_id === COACH_UUID ? (m?.player1_drilled_moves || []) : (m?.player2_drilled_moves || []);
    const botPos = m?.player1_id === COACH_UUID ? (m?.player1_position || m?.current_position) : (m?.player2_position || m?.current_position);
    const { data: botHand } = await sb.rpc('draw_hand', {
      p_profile_id: COACH_UUID,
      p_position: botPos || m?.current_position,
      p_archetype: 'wrestler',
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
      await BotEngine.respondToMove(m, COACH_UUID, 'wrestler', botHand, botDrills, myStanceVal, 'easy');
      setTimeout(() => refreshMatch(), 500);
      return;
    }
    await BotEngine.respondToMove(m, COACH_UUID, 'wrestler', botHand, botDrills, myStanceVal, 'easy');
    setTimeout(() => refreshMatch(), 500);
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
      if (match?.sub_minigame_active) {
        const botIsAttacker = match.sub_attacker_id !== profile.id;
        BotEngine.respondToSubMinigame(match, COACH_UUID, botIsAttacker, 'easy');
      }
    }
    setBusy(false);
    if (step === STEPS.T5_SUB_PICK) setStep(STEPS.T4_FREE);
  }

  function getEffGP(m) {
    const base = m.gp_cost || GP_COSTS[m.type] || 1;
    const tier = deckTiers[m.id];
    if (tier === 'drilled') return Math.max(1, base - 1);
    if (tier === 'known') return base + 1;
    return base;
  }

  function handleTutorialComplete() {
    localStorage.setItem('openmat_tutorial_done', 'true');
    onComplete();
  }

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════
  if (step === STEPS.LOADING || !match || !opp) {
    return (
      <Center>
        <Spinner size={30} />
        <div style={{ ...F.mono, color: T.muted, fontSize: 12, marginTop: 8 }}>Setting up tutorial match...</div>
      </Center>
    );
  }

  // ── FINISH SCREEN ───────────────────────────────────────
  if (step === STEPS.FINISH) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 28px', gap: 16, background: T.bg }}>
        <div style={{ ...F.display, fontSize: 28, color: T.text, textAlign: 'center' }}>Everyone Gets Tapped</div>
        <div style={{ ...F.mono, fontSize: 12, color: T.muted, textAlign: 'center', lineHeight: 1.6 }}>
          That's your first lesson. Now go train.
        </div>

        <div style={{ width: '100%', maxWidth: 300, display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
          {[
            { label: 'Stances', desc: 'Attack, Defend, or Setup each turn', color: T.red },
            { label: 'GP Energy', desc: 'Moves cost GP. Setup recovers it.', color: T.green },
            { label: 'Moves', desc: 'Pick from your hand based on position', color: T.blue },
            { label: 'Submissions', desc: 'A minigame when a sub lands', color: T.amber },
          ].map(card => (
            <div key={card.label} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
              borderRadius: 8, background: T.surface, border: `1px solid ${T.border}`,
            }}>
              <div style={{ width: 6, height: 28, borderRadius: 3, background: card.color, flexShrink: 0 }} />
              <div>
                <div style={{ ...F.body, fontSize: 13, fontWeight: 600, color: T.text }}>{card.label}</div>
                <div style={{ ...F.mono, fontSize: 9, color: T.muted }}>{card.desc}</div>
              </div>
            </div>
          ))}
        </div>

        <Btn onClick={handleTutorialComplete} style={{ marginTop: 16, width: '100%', maxWidth: 300 }}>
          Ready to Train
        </Btn>
      </div>
    );
  }

  // ── MATCH UI (mirrors MatchScreen) ──────────────────────
  const gpPct = (myGp / 12) * 100;
  const gpColor = myGp <= 2 ? T.red : myGp <= 5 ? T.amber : T.green;
  const myStatus = getStatus(myPos, profile.archetype);
  const statusColor = { dominant: T.green, neutral: T.muted, defending: T.amber, disadvantaged: T.red };

  const showingStancePick = phase === 'stance' && !myStanceLocked && match.status !== 'finished';
  const showingStanceWait = phase === 'stance' && myStanceLocked && match.status !== 'finished';
  const showingMovePick = phase === 'move' && !myLocked && match.status !== 'finished';
  const showingMoveWait = phase === 'move' && myLocked && match.status !== 'finished';
  const showingSub = phase === 'sub_minigame' && match.sub_minigame_active;

  // Tutorial step logic
  const showStanceOverlay = (step === STEPS.T1_STANCE_INTRO) && !overlayDismissed;
  const forceAttack = step === STEPS.T1_STANCE_INTRO || step === STEPS.T1_STANCE_PICK;
  const showMoveOverlay = step === STEPS.T2_MOVE_INTRO && !overlayDismissed;
  const showGpOverlay = step === STEPS.T3_GP_INTRO && !overlayDismissed;
  const showSubOverlay = step === STEPS.T5_SUB_INTRO && !overlayDismissed;

  // Stance config
  const stancesCfg = [
    { id: 'attack', label: 'Attack', desc: 'Commit to offense -- base GP cost', gp: 'Base GP', color: T.red },
    { id: 'defend', label: 'Defend', desc: '+15% defense -- counters free', gp: '0 GP', color: T.blue },
    { id: 'setup',  label: 'Setup',  desc: 'Recover grip, reset -- +2 GP',   gp: '+2 GP', color: T.amber },
  ];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', background: T.bg }}>

      {/* ═══ COACH HEADER ═══ */}
      <div style={{ padding: '6px 18px', borderBottom: `1px solid ${T.border}`, background: T.surface, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ ...F.mono, fontSize: 9, color: T.muted, textTransform: 'uppercase' }}>Tutorial -- Turn {currentTurn}</div>
          <div style={{ ...F.display, fontSize: 16, color: T.text }}>vs Coach</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ ...F.display, fontSize: 22, color: T.text, lineHeight: 1 }}>{myPts || 0}</div>
            <div style={{ ...F.mono, fontSize: 7, color: T.dim }}>YOU</div>
          </div>
          <div style={{ ...F.mono, fontSize: 10, color: T.dim }}>-</div>
          <div>
            <div style={{ ...F.display, fontSize: 22, color: T.muted, lineHeight: 1 }}>{oppPts || 0}</div>
            <div style={{ ...F.mono, fontSize: 7, color: T.dim }}>OPP</div>
          </div>
        </div>
      </div>

      {/* ═══ GP BAR ═══ */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '5px 18px', gap: 8, borderBottom: `1px solid ${T.border}`, background: T.surface, position: 'relative' }}>
        <span style={{ ...F.display, fontSize: 16, color: gpColor, lineHeight: 1 }}>{myGp}</span>
        <span style={{ ...F.mono, fontSize: 8, color: T.dim }}>/12 GP</span>
        <div style={{ flex: 1, height: 3, background: T.border, borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: gpPct + '%', background: gpColor, borderRadius: 2, transition: 'width 0.3s' }} />
        </div>
        {showGpOverlay && <div style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, border: `2px solid ${T.amber}`, borderRadius: 4, pointerEvents: 'none', animation: 'tutPulse 1.5s ease infinite' }} />}
      </div>

      {/* ═══ POSITION ═══ */}
      <div style={{ flexShrink: 0, height: 44, borderBottom: `1px solid ${T.border}`, background: T.surface, display: 'flex', alignItems: 'center', padding: '0 18px', justifyContent: 'space-between' }}>
        <div style={{ ...F.display, fontSize: 15, color: T.text }}>{pos?.name?.replace(/ \(.*\)/, '') || 'Standing'}</div>
        <span style={{ ...F.mono, fontSize: 8, padding: '2px 6px', borderRadius: 3, textTransform: 'uppercase', color: statusColor[myStatus] || T.muted, background: (statusColor[myStatus] || T.muted) + '14' }}>{myStatus}</span>
      </div>

      {/* ═══ PHASE CONTENT ═══ */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>

        {/* STANCE PICK */}
        {showingStancePick && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 18px', gap: 12 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              {stancesCfg.map(s => {
                const isSel = selectedStance === s.id;
                const dimmed = forceAttack && s.id !== 'attack';
                return (
                  <div key={s.id} onClick={() => {
                    if (dimmed || busy) return;
                    if (forceAttack) { setStep(STEPS.T1_STANCE_PICK); }
                    lockStance(s.id);
                  }} style={{
                    flex: 1, padding: '14px 8px', borderRadius: 10, textAlign: 'center',
                    cursor: dimmed ? 'default' : 'pointer', opacity: dimmed ? 0.25 : 1,
                    border: `1px solid ${isSel ? s.color : T.border}`,
                    background: isSel ? s.color + '12' : T.surface,
                    transition: 'all 0.18s', position: 'relative',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
                      <StanceIcon stance={s.id} size={24} />
                    </div>
                    <div style={{ ...F.display, fontSize: 13, color: isSel ? T.text : T.muted }}>{s.label}</div>
                    <div style={{ ...F.mono, fontSize: 8, color: T.dim, marginTop: 2 }}>{s.desc}</div>
                    <div style={{ ...F.mono, fontSize: 10, fontWeight: 600, color: isSel ? s.color : T.dim, marginTop: 4 }}>{s.gp}</div>
                    {forceAttack && s.id === 'attack' && (
                      <div style={{ position: 'absolute', inset: -2, border: `2px solid ${T.red}`, borderRadius: 12, pointerEvents: 'none', animation: 'tutPulse 1.5s ease infinite' }} />
                    )}
                  </div>
                );
              })}
            </div>
            {forceAttack && (
              <div style={{ ...F.mono, fontSize: 10, color: T.amber, textAlign: 'center' }}>
                Tap Attack to continue
              </div>
            )}
            {busy && <div style={{ textAlign: 'center' }}><Spinner /></div>}
          </div>
        )}

        {showingStanceWait && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Spinner />
            <div style={{ ...F.mono, fontSize: 11, color: T.muted }}>Coach is deciding...</div>
          </div>
        )}

        {/* MOVE PICK */}
        {showingMovePick && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Stance reveal */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, padding: '6px 18px', borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
              {[['You', myStanceVal], ['Coach', oppStanceVal]].map(([who, stance], idx) => (
                <React.Fragment key={who}>
                  {idx === 1 && <span style={{ ...F.mono, fontSize: 8, color: T.dim }}>vs</span>}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <StanceIcon stance={stance} size={12} />
                    <span style={{ ...F.mono, fontSize: 8, color: T.dim }}>{who}</span>
                    <span style={{ ...F.mono, fontSize: 9, padding: '2px 6px', borderRadius: 3, fontWeight: 600, textTransform: 'uppercase',
                      background: stance === 'attack' ? T.red + '18' : stance === 'setup' ? T.blue + '14' : T.muted + '18',
                      color: stance === 'attack' ? T.red : stance === 'setup' ? T.blue : T.muted,
                    }}>{stance === 'attack' ? 'ATK' : stance === 'defend' ? 'DEF' : 'SET'}</span>
                  </div>
                </React.Fragment>
              ))}
            </div>

            {/* Survive UI */}
            {noMovesConfirmed && !caughtBySub && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 24px', gap: 14 }}>
                <StanceIcon stance="defend" size={48} />
                <div style={{ ...F.display, fontSize: 22, color: T.text }}>No Moves Available</div>
                {surviveResult ? (
                  <div style={{ width: '100%', padding: 14, borderRadius: 10, border: `1px solid ${surviveResult.success ? T.green + '50' : T.red + '50'}`, background: surviveResult.success ? T.green + '0A' : T.red + '0A', textAlign: 'center' }}>
                    <div style={{ ...F.display, fontSize: 20, color: surviveResult.success ? T.green : T.red }}>{surviveResult.success ? 'SURVIVED' : 'HELD DOWN'}</div>
                    <div style={{ ...F.mono, fontSize: 10, color: T.text }}>{surviveResult.message || ''}</div>
                  </div>
                ) : (
                  <Btn onClick={handleSurvive} disabled={surviveBusy} style={{ width: '100%' }}>
                    {surviveBusy ? <Spinner /> : 'Survive'}
                  </Btn>
                )}
              </div>
            )}

            {noMovesConfirmed && caughtBySub && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 24px', gap: 14 }}>
                <svg viewBox="0 0 48 48" width={48} height={48} fill="none">
                  <circle cx="24" cy="24" r="20" stroke={T.red} strokeWidth="2" fill={T.red + '10'} />
                  <path d="M16 16L32 32M32 16L16 32" stroke={T.red} strokeWidth="2.5" strokeLinecap="round" />
                </svg>
                <div style={{ ...F.display, fontSize: 26, color: T.red }}>CAUGHT!</div>
                <div style={{ ...F.mono, fontSize: 11, color: T.muted, textAlign: 'center' }}>Coach has you in a submission!</div>
              </div>
            )}

            {/* Hand */}
            {!noMovesConfirmed && (
              <div style={{ flex: 1, overflowY: 'auto', padding: '6px 18px 0', minHeight: 0, position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ ...F.mono, fontSize: 9, color: T.muted, textTransform: 'uppercase' }}>Your Hand</span>
                  <span style={{ ...F.mono, fontSize: 9, color: T.dim }}>{moves.length} moves</span>
                </div>

                {moves.map((m, idx) => {
                  const tier = deckTiers[m.id] || 'trained';
                  const effGP = getEffGP(m);
                  const canAfford = myGp >= effGP;
                  const isSel = sel?.id === m.id && !sel?.isCounter;
                  const td = TierDisplay[tier] || TierDisplay.trained;
                  const typeColor = MTColors[m.type] || T.muted;

                  return (
                    <div key={m.id} onClick={() => canAfford && setSel({ id: m.id, isCounter: false })} style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, marginBottom: 4,
                      cursor: canAfford ? 'pointer' : 'default', opacity: canAfford ? 1 : 0.3, transition: 'all 0.15s',
                      position: 'relative', overflow: 'hidden',
                      border: `1px solid ${isSel ? typeColor : tier === 'drilled' ? T.gold + '40' : T.border}`,
                      background: isSel ? typeColor + '10' : T.surface,
                    }}>
                      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: isSel ? typeColor : 'transparent', opacity: 0.6 }} />
                      <div style={{ width: 26, height: 26, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: typeColor + '14' }}>
                        <MoveIcon type={m.type} size={16} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, fontFamily: T.body, color: isSel ? T.white : T.text }}>{m.name}</span>
                          <span style={{ fontSize: 9, color: td.c }}>{td.sym}</span>
                        </div>
                        <div style={{ ...F.mono, fontSize: 8, color: T.muted, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
                          <span style={{ fontSize: 7, padding: '1px 4px', borderRadius: 2, background: typeColor + '18', color: typeColor }}>{MTLabels[m.type] || 'MOVE'}</span>
                          <span style={{ color: T.dim }}>{m.to_position ? G.positions[m.to_position]?.name?.replace(/ \(.*\)/, '') : 'SUBMISSION'}</span>
                        </div>
                      </div>
                      <div style={{ textAlign: 'center', flexShrink: 0, minWidth: 32 }}>
                        <div style={{ ...F.display, fontSize: 16, lineHeight: 1, color: tier === 'drilled' ? T.gold : T.muted }}>{effGP}</div>
                        <div style={{ ...F.mono, fontSize: 7, color: T.dim }}>GP</div>
                      </div>
                      {isSel && (
                        <div style={{ position: 'absolute', top: 6, right: 8, width: 16, height: 16, borderRadius: '50%', background: typeColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <svg viewBox="0 0 12 12" width={8} height={8}><path d="M2 6L5 9L10 3" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        </div>
                      )}
                    </div>
                  );
                })}

                {counters.length > 0 && (
                  <>
                    <div style={{ ...F.mono, fontSize: 8, color: T.dim, textTransform: 'uppercase', margin: '8px 0 4px', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <MoveIcon type="counter" size={12} /> Counters <span style={{ color: T.green }}>0GP</span>
                    </div>
                    {counters.map(c => {
                      const cSel = sel?.id === c.id && sel?.isCounter;
                      return (
                        <div key={c.id} onClick={() => setSel({ id: c.id, isCounter: true })} style={{
                          display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 6, marginBottom: 3, cursor: 'pointer',
                          border: `1px solid ${cSel ? T.gray : T.border}`, background: cSel ? T.gray + '10' : T.surface,
                        }}>
                          <MoveIcon type="counter" size={14} />
                          <span style={{ ...F.body, fontSize: 11, color: cSel ? T.text : T.muted }}>{c.name}</span>
                          <span style={{ ...F.mono, fontSize: 9, color: T.green, marginLeft: 'auto' }}>0GP</span>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            )}

            {/* Lock button */}
            {!noMovesConfirmed && (
              <div style={{ flexShrink: 0, padding: '8px 18px 28px', borderTop: `1px solid ${T.border}` }}>
                <Btn onClick={lockMove} disabled={!sel || busy}>
                  {busy ? <Spinner /> : sel ? 'Lock In Move' : 'Select a Move'}
                </Btn>
              </div>
            )}
          </div>
        )}

        {showingMoveWait && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Spinner />
            <div style={{ ...F.mono, fontSize: 11, color: T.muted }}>Coach is choosing...</div>
          </div>
        )}

        {phase === 'resolving' && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Spinner size={24} />
            <span style={{ ...F.mono, fontSize: 12, color: T.muted, marginLeft: 8 }}>Resolving...</span>
          </div>
        )}

        {/* SUB MINIGAME */}
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
                    <div key={i} style={{ width: 28, height: 7, borderRadius: 3, background: i <= tighten ? T.red : T.dim + '30', transition: 'background 0.3s' }} />
                  ))}
                </div>
                <span style={{ ...F.mono, fontSize: 9, color: tighten >= 4 ? T.red : T.muted, width: 30 }}>{tighten}/5</span>
              </div>

              {/* Round indicators */}
              <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 14 }}>
                {[1, 2, 3].map(r => (
                  <div key={r} style={{
                    width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 600, fontFamily: T.mono,
                    background: r < subRound ? T.red : 'transparent',
                    border: `1.5px solid ${r <= subRound ? T.red : T.dim}`,
                    color: r < subRound ? '#fff' : r === subRound ? T.text : T.dim,
                  }}>{r}</div>
                ))}
              </div>

              {!myLk && opts.map(o => {
                const oSel = subSel === o.id;
                return (
                  <div key={o.id} onClick={() => myGp >= o.cost && setSubSel(o.id)} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 14px', marginBottom: 5, borderRadius: 8, cursor: myGp >= o.cost ? 'pointer' : 'default',
                    opacity: myGp >= o.cost ? 1 : 0.35,
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

              {myLk && <div style={{ textAlign: 'center', padding: 20 }}><Spinner /><div style={{ ...F.mono, fontSize: 11, color: T.muted, marginTop: 8 }}>Locked -- waiting...</div></div>}

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

        {match.status === 'finished' && !showReveal && step !== STEPS.FINISH && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
            <div style={{ ...F.display, fontSize: 18, color: T.text }}>Match Complete</div>
            <Spinner />
          </div>
        )}
      </div>

      {/* ═══ REVEAL OVERLAY ═══ */}
      {showReveal && revealData && (
        <div onClick={dismissReveal} style={{ position: 'absolute', inset: 0, zIndex: 60, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: T.bg, cursor: 'pointer' }}>
          <div style={{ position: 'absolute', inset: 0, backgroundImage: `linear-gradient(${T.border} 1px, transparent 1px), linear-gradient(90deg, ${T.border} 1px, transparent 1px)`, backgroundSize: '20px 20px', opacity: 0.1 }} />
          <div style={{ ...F.mono, fontSize: 9, letterSpacing: '0.2em', color: T.muted, textTransform: 'uppercase', marginBottom: 20, zIndex: 2 }}>Turn {revealData.turn} -- Reveal</div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 20, zIndex: 2 }}>
            {/* Your card */}
            <div style={{ width: 120, height: 145, perspective: 700 }}>
              <div style={{ width: '100%', height: '100%', position: 'relative', transformStyle: 'preserve-3d', transition: 'transform 0.6s cubic-bezier(0.4,0,0.2,1)', transform: yourFlipped ? 'rotateY(180deg)' : 'none' }}>
                <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', borderRadius: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, background: T.surface2, border: `1px solid ${T.border}` }}>
                  <div style={{ ...F.display, fontSize: 10, color: T.borderB }}>OPEN MAT</div>
                </div>
                <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', transform: 'rotateY(180deg)', borderRadius: 6, display: 'flex', flexDirection: 'column', padding: 12, background: '#2a0810', border: `1px solid ${T.red}` }}>
                  <div style={{ ...F.mono, fontSize: 8, color: T.red, textTransform: 'uppercase', marginBottom: 4 }}>You played</div>
                  <div style={{ ...F.mono, fontSize: 7, padding: '2px 5px', border: `1px solid ${T.red}`, borderRadius: 2, color: T.red, textTransform: 'uppercase', alignSelf: 'flex-start', marginBottom: 8 }}>{MTLabels[revealData?.myMoveType] || 'MOVE'}</div>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                    <div style={{ ...F.display, fontSize: 18, color: '#fff', lineHeight: 1.1 }}>{revealData?.myMoveName || 'Your Move'}</div>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ ...F.display, fontSize: 11, color: T.dim, zIndex: 2 }}>VS</div>

            {/* Coach card */}
            <div style={{ width: 120, height: 145, perspective: 700 }}>
              <div style={{ width: '100%', height: '100%', position: 'relative', transformStyle: 'preserve-3d', transition: 'transform 0.6s cubic-bezier(0.4,0,0.2,1)', transform: oppFlipped ? 'rotateY(180deg)' : 'none' }}>
                <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', borderRadius: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, background: T.surface2, border: `1px solid ${T.border}` }}>
                  <div style={{ ...F.display, fontSize: 10, color: T.borderB }}>OPEN MAT</div>
                </div>
                <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', transform: 'rotateY(180deg)', borderRadius: 6, display: 'flex', flexDirection: 'column', padding: 12, background: '#050d1a', border: `1px solid ${T.blue}` }}>
                  <div style={{ ...F.mono, fontSize: 8, color: T.blue, textTransform: 'uppercase', marginBottom: 4 }}>Coach played</div>
                  <div style={{ ...F.mono, fontSize: 7, padding: '2px 5px', border: `1px solid ${T.blue}`, borderRadius: 2, color: T.blue, textTransform: 'uppercase', alignSelf: 'flex-start', marginBottom: 6 }}>{revealData?.oppMoveType ? (MTLabels[revealData.oppMoveType] || 'MOVE') : 'MOVE'}</div>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                    <div style={{ ...F.display, fontSize: 16, color: '#7aaee0', lineHeight: 1.1 }}>{revealData?.oppMoveName || 'Coach'}</div>
                  </div>
                  <div style={{ ...F.mono, fontSize: 8, color: T.muted }}>Coach</div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ zIndex: 2, textAlign: 'center', opacity: showResult ? 1 : 0, transform: showResult ? 'translateY(0)' : 'translateY(12px)', transition: 'opacity 0.4s, transform 0.4s' }}>
            <div style={{ ...F.display, fontSize: 24, lineHeight: 1, marginBottom: 4, color: revealData.result === 'submission_win' ? T.red : revealData.result === 'sweep' ? T.green : T.amber }}>{revealData.description}</div>
            {currentTurn === 2 && (
              <div style={{ ...F.mono, fontSize: 10, color: T.amber, marginTop: 8, padding: '6px 12px', background: T.amber + '10', borderRadius: 6, display: 'inline-block' }}>
                You both chose at the same time -- this is the reveal
              </div>
            )}
            <div style={{ ...F.mono, fontSize: 8, color: T.dim, marginTop: 10 }}>Tap to continue</div>
          </div>
        </div>
      )}

      {/* ═══ TUTORIAL OVERLAYS ═══ */}

      {/* Turn 1: Stance intro */}
      {showStanceOverlay && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 50, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', paddingTop: 80, background: 'rgba(0,0,0,0.75)', cursor: 'pointer' }} onClick={() => { setOverlayDismissed(true); setStep(STEPS.T1_STANCE_PICK); }}>
          <div style={{ maxWidth: 300, textAlign: 'center', padding: '20px 24px', background: T.surface2, border: `1px solid ${T.amber}40`, borderRadius: 14 }}>
            <div style={{ ...F.display, fontSize: 22, color: T.text, marginBottom: 8 }}>Every Turn Starts Here</div>
            <div style={{ ...F.mono, fontSize: 11, color: T.muted, lineHeight: 1.6 }}>
              Choose your approach for this turn. Each stance changes what moves you can play and how much energy you spend.
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                <StanceIcon stance="attack" size={20} />
                <div style={{ ...F.mono, fontSize: 8, color: T.red, marginTop: 2 }}>Offense</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <StanceIcon stance="defend" size={20} />
                <div style={{ ...F.mono, fontSize: 8, color: T.blue, marginTop: 2 }}>Counters</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <StanceIcon stance="setup" size={20} />
                <div style={{ ...F.mono, fontSize: 8, color: T.amber, marginTop: 2 }}>Recovery</div>
              </div>
            </div>
            <div style={{ ...F.mono, fontSize: 9, color: T.dim, marginTop: 12 }}>Tap to continue</div>
          </div>
        </div>
      )}

      {/* Turn 2: Move intro */}
      {showMoveOverlay && showingMovePick && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 50, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 140, background: 'rgba(0,0,0,0.7)', cursor: 'pointer' }} onClick={() => { setOverlayDismissed(true); setStep(STEPS.T2_MOVE_PICK); }}>
          <div style={{ maxWidth: 300, textAlign: 'center', padding: '20px 24px', background: T.surface2, border: `1px solid ${T.amber}40`, borderRadius: 14 }}>
            <div style={{ ...F.display, fontSize: 22, color: T.text, marginBottom: 8 }}>Pick a Move</div>
            <div style={{ ...F.mono, fontSize: 11, color: T.muted, lineHeight: 1.6 }}>
              Each move costs GP (the green bar). Gold starred moves are your best -- they cost less and hit harder.
            </div>
            <div style={{ ...F.mono, fontSize: 9, color: T.dim, marginTop: 12 }}>Tap to continue</div>
          </div>
        </div>
      )}

      {/* Turn 3: GP intro */}
      {showGpOverlay && showingStancePick && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 50, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 60, background: 'rgba(0,0,0,0.7)', cursor: 'pointer' }} onClick={() => { setOverlayDismissed(true); setStep(STEPS.T3_FREE); }}>
          <div style={{ maxWidth: 300, textAlign: 'center', padding: '20px 24px', background: T.surface2, border: `1px solid ${T.amber}40`, borderRadius: 14 }}>
            <div style={{ ...F.display, fontSize: 22, color: T.text, marginBottom: 8 }}>Watch Your Energy</div>
            <div style={{ ...F.mono, fontSize: 11, color: T.muted, lineHeight: 1.6 }}>
              Attack moves cost GP. Setup stance recovers it. Run out and you're stuck with no options.
            </div>
            <div style={{ ...F.mono, fontSize: 9, color: T.dim, marginTop: 12 }}>Tap to continue</div>
          </div>
        </div>
      )}

      {/* Sub minigame intro */}
      {showSubOverlay && showingSub && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', cursor: 'pointer' }} onClick={() => { setOverlayDismissed(true); setStep(STEPS.T5_SUB_PICK); }}>
          <div style={{ maxWidth: 300, textAlign: 'center', padding: '20px 24px', background: T.surface2, border: `1px solid ${T.red}40`, borderRadius: 14 }}>
            <div style={{ ...F.display, fontSize: 22, color: T.red, marginBottom: 8 }}>You're Caught!</div>
            <div style={{ ...F.mono, fontSize: 11, color: T.muted, lineHeight: 1.6 }}>
              When a submission lands, it becomes a minigame. Choose how to defend each round. The meter shows how deep the sub is.
            </div>
            <div style={{ ...F.mono, fontSize: 9, color: T.dim, marginTop: 12 }}>Tap to continue</div>
          </div>
        </div>
      )}

      {/* Scripted sub fallback — if no real sub triggered by turn 5 */}
      {subFallbackShown && !subEverTriggeredRef.current && step !== STEPS.FINISH && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.8)', cursor: 'pointer' }} onClick={() => setSubFallbackShown(false)}>
          <div style={{ maxWidth: 320, textAlign: 'center', padding: '24px 28px', background: T.surface2, border: `1px solid ${T.red}40`, borderRadius: 14 }}>
            <svg viewBox="0 0 48 48" width={40} height={40} fill="none" style={{ marginBottom: 10 }}>
              <circle cx="24" cy="24" r="20" stroke={T.red} strokeWidth="2" fill={T.red + '10'} />
              <path d="M16 16L32 32M32 16L16 32" stroke={T.red} strokeWidth="2.5" strokeLinecap="round" />
            </svg>
            <div style={{ ...F.display, fontSize: 22, color: T.red, marginBottom: 8 }}>About Submissions</div>
            <div style={{ ...F.mono, fontSize: 11, color: T.muted, lineHeight: 1.7 }}>
              When a submission technique lands, it triggers a minigame. The attacker tries to tighten the hold while the defender picks escape options.
            </div>
            <div style={{ ...F.mono, fontSize: 11, color: T.muted, lineHeight: 1.7, marginTop: 10 }}>
              A tighten meter tracks progress. At 5/5, it's a tap! Defenders can escape, explode out, or even reverse.
            </div>
            <div style={{ display: 'flex', gap: 3, justifyContent: 'center', marginTop: 12 }}>
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} style={{ width: 28, height: 7, borderRadius: 3, background: i <= 3 ? T.red : T.dim + '30' }} />
              ))}
            </div>
            <div style={{ ...F.mono, fontSize: 8, color: T.dim, marginTop: 4 }}>Tighten meter example (3/5)</div>
            <div style={{ ...F.mono, fontSize: 9, color: T.dim, marginTop: 14 }}>Tap to continue playing</div>
          </div>
        </div>
      )}

      {/* ═══ KEYFRAMES ═══ */}
      <style>{`
        @keyframes pulseOut { 0% { transform: scale(1); opacity: 0.6; } 100% { transform: scale(2.4); opacity: 0; } }
        @keyframes tutPulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }
        @keyframes shimmer { 0%, 100% { opacity: 1; filter: brightness(1); } 50% { opacity: 0.85; filter: brightness(1.3); } }
      `}</style>
    </div>
  );
}

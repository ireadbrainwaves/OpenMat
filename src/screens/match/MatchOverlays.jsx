// ═══════════════════════════════════════════════════════════
// MATCH — OVERLAYS
// Color field overlays: TAP, ESCAPED, CAUGHT, Finish
// Turn reveal with stillness beats
// Uses refs for animation to prevent re-render races.
// ═══════════════════════════════════════════════════════════

import React from 'react';
const { useRef, useEffect, useState } = React;
import { T } from '../../lib/tokens';
import { FlipCard } from '../../components/MoveCard';
import { impactFlash, blackout, screenShake } from '../../lib/animations';
import { getOutcomeColor } from '../../lib/atmospheres';

const F = {
  display: { fontFamily: T.display },
  mono: { fontFamily: T.mono },
};

// ── COLOR PALETTE ────────────────────────────────────────
const FINISH_COLORS = {
  tap_loss:  { bg: '#3D0C10', text: '#E8C4B8', divider: '#E8C4B820' },
  tap_win:   { bg: '#1A0A02', text: '#D4A847', divider: '#D4A84720' },
  escaped:   { bg: '#0A1F1A', text: '#A8E0D0', divider: '#A8E0D020' },
  caught:    { bg: '#0D0306', text: '#C23028', divider: '#C2302820' },
  victory:   { bg: '#0A1F1A', text: '#A8E0D0', divider: '#A8E0D020' },
  defeat:    { bg: '#3D0C10', text: '#E8C4B8', divider: '#E8C4B820' },
};

// ── Helper: ref-based sequential reveal ──────────────────
function playSequence(refs, delays) {
  refs.forEach((ref, i) => {
    if (!ref.current) return;
    ref.current.style.opacity = '0';
    ref.current.style.transform = '';
  });
  refs.forEach((ref, i) => {
    if (!ref.current) return;
    const { delay, duration, transform } = delays[i] || {};
    setTimeout(() => {
      if (!ref.current) return;
      ref.current.style.transition = `opacity ${duration || 300}ms ease, transform ${duration || 300}ms cubic-bezier(0.34, 1.56, 0.64, 1)`;
      ref.current.style.opacity = '1';
      if (transform) ref.current.style.transform = transform;
    }, delay || 0);
  });
}

// ── REVEAL OVERLAY ───────────────────────────────────────
export function RevealOverlay({ revealData, yourFlipped, oppFlipped, showResult, onDismiss, matchContainerRef }) {
  if (!revealData) return null;

  const outcomeColor = getOutcomeColor(revealData.result);

  useEffect(() => {
    if (!revealData) return;
    if (matchContainerRef?.current) {
      screenShake(matchContainerRef.current);
      impactFlash(matchContainerRef.current, outcomeColor, 0.10, 200);
    }
  }, [revealData]);

  return (
    <div onClick={onDismiss} style={{
      position: 'absolute', inset: 0, zIndex: 60,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: T.bg, cursor: 'pointer',
    }}>
      <div style={{ position: 'absolute', inset: 0, backgroundImage: `linear-gradient(${T.border} 1px, transparent 1px), linear-gradient(90deg, ${T.border} 1px, transparent 1px)`, backgroundSize: '20px 20px', opacity: 0.1 }} />

      <div style={{ ...F.mono, fontSize: 9, letterSpacing: '0.2em', color: T.muted, textTransform: 'uppercase', marginBottom: 20, zIndex: 2 }}>
        Turn {revealData.turn} — Reveal
      </div>

      <div style={{ display: 'flex', gap: 20, alignItems: 'center', marginBottom: 20, zIndex: 2 }}>
        <FlipCard move={{ name: revealData?.myMoveName || 'Your Move', from_position: null, to_position: null }} type={revealData?.myMoveType || 'transition'} isOpponent={false} flipped={yourFlipped} />
        <div style={{ ...F.display, fontSize: 11, color: T.dim, zIndex: 2 }}>VS</div>
        <FlipCard move={{ name: revealData?.oppMoveName || 'Defended', from_position: null, to_position: null }} type={revealData?.oppMoveType || 'transition'} isOpponent={true} flipped={oppFlipped} />
      </div>

      <div style={{ zIndex: 2, textAlign: 'center', opacity: showResult ? 1 : 0, transition: 'opacity 0.15s' }}>
        {revealData.variantName && (
          <div style={{ marginBottom: 6 }}>
            <div style={{ ...F.display, fontSize: 24, color: T.gold, animation: 'shimmer 2s ease-in-out infinite', lineHeight: 1 }}>{revealData.variantName}</div>
            <div style={{ ...F.mono, fontSize: 8, color: T.muted, marginTop: 2 }}>Variant of {revealData.myMoveName || 'technique'}</div>
          </div>
        )}
        <div style={{ ...F.display, fontSize: 36, lineHeight: 1, marginBottom: 4, color: outcomeColor, wordBreak: 'keep-all' }}>
          {revealData.description}
        </div>
        {revealData.newPosName && (
          <div style={{ ...F.mono, fontSize: 10, color: T.muted, marginTop: 6 }}>&rarr; {revealData.newPosName}</div>
        )}
        <div style={{ ...F.mono, fontSize: 8, color: T.dim, marginTop: 10 }}>Tap anywhere to continue</div>
      </div>
    </div>
  );
}

// ── TAP OVERLAY — The Surrender ──────────────────────────
export function TapOverlay({ tapOverlay, matchContainerRef, onContinue }) {
  if (!tapOverlay) return null;

  const [phase, setPhase] = useState(0); // 0=black, 1=field
  const colors = tapOverlay.won ? FINISH_COLORS.tap_win : FINISH_COLORS.tap_loss;
  const headline = tapOverlay.won ? 'SUBMITTED' : 'TAPPED';

  // Refs for sequential reveal — prevents re-render races
  const tagRef = useRef(null);
  const headlineRef = useRef(null);
  const techniqueRef = useRef(null);
  const statsRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    if (!tapOverlay) return;
    if (matchContainerRef?.current) screenShake(matchContainerRef.current, 'big');
    // 100ms black blink, then color field + sequence
    setTimeout(() => setPhase(1), 100);
  }, [tapOverlay]);

  // Play the sequence AFTER phase 1 renders
  useEffect(() => {
    if (phase !== 1) return;
    playSequence(
      [tagRef, headlineRef, techniqueRef, statsRef, buttonRef],
      [
        { delay: 200, duration: 300 },
        { delay: 300, duration: 150, transform: 'scale(1)' },
        { delay: 600, duration: 600 },
        { delay: 1000, duration: 400 },
        { delay: 1400, duration: 300 },
      ]
    );
  }, [phase]);

  if (phase === 0) {
    return <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: '#000000' }} />;
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: colors.bg,
    }}>
      {/* Tag */}
      <div ref={tagRef} style={{
        opacity: 0, fontFamily: T.mono, fontSize: 10,
        letterSpacing: '0.2em', color: colors.text,
        marginBottom: 12,
      }}>
        SUBMISSION
      </div>

      {/* Headline — starts scaled up, slams to scale(1) */}
      <div ref={headlineRef} style={{
        opacity: 0, transform: 'scale(1.4)',
        fontFamily: T.display, fontSize: 'clamp(56px, 15vw, 80px)',
        lineHeight: 1, textAlign: 'center', letterSpacing: '-0.02em',
        color: colors.text, textShadow: '0 2px 40px rgba(0,0,0,0.3)',
        wordBreak: 'keep-all',
      }}>
        {headline}
      </div>

      {/* Divider — always visible */}
      <div style={{ width: 80, height: 1, background: colors.text, opacity: 0.15, margin: '16px 0' }} />

      {/* Technique name */}
      <div ref={techniqueRef} style={{
        opacity: 0, fontFamily: T.display, fontSize: 18, fontStyle: 'italic',
        color: colors.text,
      }}>
        {tapOverlay.subName}
      </div>

      {/* Stats */}
      <div ref={statsRef} style={{
        opacity: 0, fontFamily: T.mono, fontSize: 10, letterSpacing: '0.15em',
        color: colors.text, marginTop: 8,
      }}>
        {tapOverlay.won ? 'Submission Victory' : 'You got tapped'} · {tapOverlay.winnerName} wins
      </div>

      {/* Continue — the ONLY way to leave */}
      <button ref={buttonRef} onClick={onContinue} style={{
        opacity: 0, marginTop: 32, padding: '14px 40px',
        background: 'transparent', border: `1px solid ${colors.divider}`,
        borderRadius: 10, fontFamily: T.mono, fontSize: 10,
        letterSpacing: '0.15em', textTransform: 'uppercase',
        cursor: 'pointer', color: colors.text,
      }}>
        Continue
      </button>
    </div>
  );
}

// ── FINISH OVERLAY — Points Victory/Defeat ───────────────
export function FinishOverlay({ finishOverlay, matchContainerRef, onContinue }) {
  if (!finishOverlay) return null;

  const colors = finishOverlay.won ? FINISH_COLORS.victory : FINISH_COLORS.defeat;
  const headline = finishOverlay.won ? 'VICTORY' : 'DEFEAT';

  const tagRef = useRef(null);
  const headlineRef = useRef(null);
  const scoreRef = useRef(null);
  const methodRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    if (!finishOverlay) return;
    if (matchContainerRef?.current) screenShake(matchContainerRef.current);
  }, [finishOverlay]);

  useEffect(() => {
    if (!finishOverlay) return;
    playSequence(
      [tagRef, headlineRef, scoreRef, methodRef, buttonRef],
      [
        { delay: 200, duration: 300 },
        { delay: 300, duration: 150, transform: 'scale(1)' },
        { delay: 600, duration: 400 },
        { delay: 900, duration: 400 },
        { delay: 1400, duration: 300 },
      ]
    );
  }, [finishOverlay]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: colors.bg,
    }}>
      <div ref={tagRef} style={{ opacity: 0, fontFamily: T.mono, fontSize: 10, letterSpacing: '0.2em', color: colors.text, marginBottom: 12 }}>
        {finishOverlay.method?.toUpperCase() || 'POINTS'}
      </div>

      <div ref={headlineRef} style={{
        opacity: 0, transform: 'scale(1.4)',
        fontFamily: T.display, fontSize: 'clamp(56px, 15vw, 80px)',
        lineHeight: 1, textAlign: 'center', letterSpacing: '-0.02em',
        color: colors.text, textShadow: '0 2px 40px rgba(0,0,0,0.3)',
        wordBreak: 'keep-all',
      }}>
        {headline}
      </div>

      <div style={{ width: 80, height: 1, background: colors.text, opacity: 0.15, margin: '16px 0' }} />

      <div ref={scoreRef} style={{ opacity: 0, fontFamily: T.display, fontSize: 28, color: colors.text }}>
        {finishOverlay.myPoints} – {finishOverlay.oppPoints}
      </div>

      <div ref={methodRef} style={{ opacity: 0, fontFamily: T.mono, fontSize: 10, letterSpacing: '0.15em', color: colors.text, marginTop: 8 }}>
        Won by {finishOverlay.method}
      </div>

      <button ref={buttonRef} onClick={onContinue} style={{
        opacity: 0, marginTop: 32, padding: '14px 40px',
        background: 'transparent', border: `1px solid ${colors.divider}`,
        borderRadius: 10, fontFamily: T.mono, fontSize: 10,
        letterSpacing: '0.15em', textTransform: 'uppercase',
        cursor: 'pointer', color: colors.text,
      }}>
        Continue
      </button>
    </div>
  );
}

// ── ESCAPED OVERLAY — The First Breath ───────────────────
export function EscapedOverlay({ visible, subTechName, matchContainerRef }) {
  if (!visible) return null;

  const [phase, setPhase] = useState(0);
  const colors = FINISH_COLORS.escaped;

  const headlineRef = useRef(null);
  const techniqueRef = useRef(null);

  useEffect(() => {
    if (!visible) return;
    setTimeout(() => setPhase(1), 150);
  }, [visible]);

  useEffect(() => {
    if (phase !== 1) return;
    playSequence(
      [headlineRef, techniqueRef],
      [
        { delay: 0, duration: 150, transform: 'scale(1)' },
        { delay: 550, duration: 600 },
      ]
    );
  }, [phase]);

  if (phase === 0) {
    return <div style={{ position: 'fixed', inset: 0, zIndex: 99, background: '#FFFFFF', opacity: 0.3 }} />;
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: colors.bg, pointerEvents: 'none',
    }}>
      <div ref={headlineRef} style={{
        opacity: 0, transform: 'scale(1.4)',
        fontFamily: T.display, fontSize: 'clamp(56px, 15vw, 80px)',
        lineHeight: 1, textAlign: 'center', letterSpacing: '-0.02em',
        color: colors.text, textShadow: '0 2px 40px rgba(0,0,0,0.3)',
        wordBreak: 'keep-all',
      }}>
        ESCAPED
      </div>

      <div style={{ width: 80, height: 1, background: colors.text, opacity: 0.15, margin: '16px 0' }} />

      <div ref={techniqueRef} style={{
        opacity: 0, fontFamily: T.display, fontSize: 18, fontStyle: 'italic', color: colors.text,
      }}>
        {subTechName || 'Submission'} Defended
      </div>
    </div>
  );
}

// ── CAUGHT OVERLAY — The Trap Closes ─────────────────────
export function CaughtOverlay({ visible, positionName, onComplete }) {
  if (!visible) return null;

  const colors = FINISH_COLORS.caught;
  const containerRef = useRef(null);
  const headlineRef = useRef(null);
  const iconRef = useRef(null);
  const msgRef = useRef(null);
  const posRef = useRef(null);
  const penaltyRef = useRef(null);
  const continueRef = useRef(null);

  useEffect(() => {
    if (!visible) return;

    // Slow dim the container over 800ms
    if (containerRef.current) {
      containerRef.current.style.opacity = '0';
      requestAnimationFrame(() => {
        if (containerRef.current) containerRef.current.style.opacity = '0.85';
      });
    }

    // Headline fades from darkness at 400ms
    setTimeout(() => {
      if (headlineRef.current) {
        headlineRef.current.style.transition = 'opacity 0.8s ease';
        headlineRef.current.style.opacity = '1';
      }
    }, 400);

    // Details at 1200ms
    const detailRefs = [iconRef, msgRef, posRef, penaltyRef, continueRef];
    const detailDelays = [1200, 1400, 1600, 2000, 2500];
    detailRefs.forEach((ref, i) => {
      setTimeout(() => {
        if (ref.current) {
          ref.current.style.transition = 'opacity 0.4s ease';
          ref.current.style.opacity = '1';
        }
      }, detailDelays[i]);
    });

    // Auto-transition
    const t = setTimeout(() => { if (onComplete) onComplete(); }, 3500);
    return () => clearTimeout(t);
  }, [visible]);

  return (
    <div ref={containerRef} style={{
      position: 'fixed', inset: 0, zIndex: 98,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: colors.bg, opacity: 0,
      transition: 'opacity 0.8s ease',
    }}>
      {/* Red seep */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', boxShadow: 'inset 0 0 120px rgba(194,48,40,0.08)', opacity: 0, transition: 'opacity 2s ease 1.2s', ...(visible ? { opacity: 1 } : {}) }} />

      <div ref={headlineRef} style={{
        opacity: 0, fontFamily: T.display, fontSize: 'clamp(48px, 14vw, 56px)',
        color: colors.text, letterSpacing: '-0.02em', wordBreak: 'keep-all',
      }}>
        CAUGHT
      </div>

      <div ref={iconRef} style={{ opacity: 0, marginTop: 16 }}>
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
          <path d="M12 2L2 22h20L12 2z" stroke={colors.text} strokeWidth="1.5" fill={colors.text + '10'} />
          <line x1="12" y1="9" x2="12" y2="15" stroke={colors.text} strokeWidth="2" strokeLinecap="round" />
          <circle cx="12" cy="18" r="1" fill={colors.text} />
        </svg>
      </div>

      <div ref={msgRef} style={{ opacity: 0, fontFamily: T.mono, fontSize: 10, color: colors.text, marginTop: 12 }}>
        No escapes from this position
      </div>

      {positionName && (
        <div ref={posRef} style={{ opacity: 0, fontFamily: T.display, fontSize: 14, color: colors.text, marginTop: 6 }}>
          {positionName}
        </div>
      )}

      <div ref={penaltyRef} style={{ opacity: 0, fontFamily: T.mono, fontSize: 9, color: colors.text, marginTop: 12 }}>
        -30% escape · 0% reversal
      </div>

      <div ref={continueRef} style={{ opacity: 0, fontFamily: T.body, fontSize: 13, color: colors.text, fontStyle: 'italic', marginTop: 16 }}>
        The submission begins...
      </div>
    </div>
  );
}

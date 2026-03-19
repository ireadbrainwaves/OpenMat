// ═══════════════════════════════════════════════════════════
// MATCH — OVERLAYS
// Color field overlays: TAP, ESCAPED, CAUGHT, Finish
// Turn reveal with stillness beats
// The screen IS the emotion. Color replaces the world.
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
  sweep:     { bg: '#F0E8D8', text: '#1A0F04', divider: '#1A0F0420' },
};

// ── REVEAL OVERLAY ───────────────────────────────────────
export function RevealOverlay({ revealData, yourFlipped, oppFlipped, showResult, onDismiss, matchContainerRef }) {
  if (!revealData) return null;

  const outcomeColor = getOutcomeColor(revealData.result);

  // Impact flash + shake on mount
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
      {/* Grid bg */}
      <div style={{ position: 'absolute', inset: 0, backgroundImage: `linear-gradient(${T.border} 1px, transparent 1px), linear-gradient(90deg, ${T.border} 1px, transparent 1px)`, backgroundSize: '20px 20px', opacity: 0.1 }} />

      {/* Turn label — just there */}
      <div style={{ ...F.mono, fontSize: 9, letterSpacing: '0.2em', color: T.muted, textTransform: 'uppercase', marginBottom: 20, zIndex: 2 }}>
        Turn {revealData.turn} — Reveal
      </div>

      {/* Cards */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'center', marginBottom: 20, zIndex: 2 }}>
        <FlipCard
          move={{ name: revealData?.myMoveName || 'Your Move', from_position: null, to_position: null }}
          type={revealData?.myMoveType || 'transition'}
          isOpponent={false}
          flipped={yourFlipped}
        />
        <div style={{ ...F.display, fontSize: 11, color: T.dim, zIndex: 2 }}>VS</div>
        <FlipCard
          move={{ name: revealData?.oppMoveName || 'Defended', from_position: null, to_position: null }}
          type={revealData?.oppMoveType || 'transition'}
          isOpponent={true}
          flipped={oppFlipped}
        />
      </div>

      {/* Result — appears, no animation. Like a scoreboard update. */}
      <div style={{
        zIndex: 2, textAlign: 'center',
        opacity: showResult ? 1 : 0,
        transition: 'opacity 0.15s',
      }}>
        {revealData.variantName && (
          <div style={{ marginBottom: 6 }}>
            <div style={{ ...F.display, fontSize: 24, color: T.gold, animation: 'shimmer 2s ease-in-out infinite', lineHeight: 1 }}>{revealData.variantName}</div>
            <div style={{ ...F.mono, fontSize: 8, color: T.muted, marginTop: 2 }}>Variant of {revealData.myMoveName || 'technique'}</div>
          </div>
        )}
        <div style={{
          ...F.display, fontSize: 36, lineHeight: 1, marginBottom: 4,
          color: outcomeColor,
          wordBreak: 'keep-all',
        }}>
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
export function TapOverlay({ tapOverlay, matchContainerRef }) {
  if (!tapOverlay) return null;

  const [phase, setPhase] = useState(0); // 0=black, 1=field
  const colors = tapOverlay.won ? FINISH_COLORS.tap_win : FINISH_COLORS.tap_loss;
  const headline = tapOverlay.won ? 'SUBMITTED' : 'TAPPED';

  useEffect(() => {
    if (!tapOverlay) return;
    // Big shake
    if (matchContainerRef?.current) screenShake(matchContainerRef.current, 'big');
    // 100ms black blink, then color field
    setTimeout(() => setPhase(1), 100);
  }, [tapOverlay]);

  // Phase 0: pure black
  if (phase === 0) {
    return <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: '#000000' }} />;
  }

  // Phase 1: color field
  return (
    <div className="finish-overlay" style={{ background: colors.bg }}>
      <div className="headline" style={{ color: colors.text }}>{headline}</div>
      <div className="divider" style={{ background: colors.text }} />
      <div style={{
        fontFamily: T.display, fontSize: 18, fontStyle: 'italic',
        color: colors.text, opacity: 0,
        animation: 'fadeIn 0.6s ease 0.6s forwards',
      }}>
        {tapOverlay.subName}
      </div>
      <div style={{
        fontFamily: T.mono, fontSize: 10, letterSpacing: '0.15em',
        color: colors.text, opacity: 0,
        animation: 'fadeIn 0.4s ease 1.1s forwards',
      }}>
        {tapOverlay.won ? 'Submission Victory' : 'You got tapped'} · {tapOverlay.winnerName} wins
      </div>
      <button onClick={() => {}} style={{
        marginTop: 32, padding: '14px 40px', background: 'transparent',
        border: `1px solid ${colors.divider}`, borderRadius: 10,
        fontFamily: T.mono, fontSize: 10, letterSpacing: '0.15em',
        textTransform: 'uppercase', cursor: 'pointer',
        color: colors.text, opacity: 0,
        animation: 'fadeIn 0.3s ease 1.9s forwards',
      }}>
        Continue
      </button>
    </div>
  );
}

// ── FINISH OVERLAY — Points Victory/Defeat ───────────────
export function FinishOverlay({ finishOverlay, matchContainerRef }) {
  if (!finishOverlay) return null;

  const colors = finishOverlay.won ? FINISH_COLORS.victory : FINISH_COLORS.defeat;
  const headline = finishOverlay.won ? 'VICTORY' : 'DEFEAT';

  useEffect(() => {
    if (matchContainerRef?.current) screenShake(matchContainerRef.current);
  }, [finishOverlay]);

  return (
    <div className="finish-overlay" style={{ background: colors.bg }}>
      <div className="headline" style={{ color: colors.text }}>{headline}</div>
      <div className="divider" style={{ background: colors.text }} />
      <div style={{
        fontFamily: T.display, fontSize: 28, color: colors.text,
        opacity: 0, animation: 'fadeIn 0.4s ease 0.4s forwards',
      }}>
        {finishOverlay.myPoints} – {finishOverlay.oppPoints}
      </div>
      <div style={{
        fontFamily: T.mono, fontSize: 10, letterSpacing: '0.15em',
        color: colors.text, opacity: 0,
        animation: 'fadeIn 0.4s ease 0.8s forwards',
      }}>
        Won by {finishOverlay.method}
      </div>
      <button onClick={() => {}} style={{
        marginTop: 32, padding: '14px 40px', background: 'transparent',
        border: `1px solid ${colors.divider}`, borderRadius: 10,
        fontFamily: T.mono, fontSize: 10, letterSpacing: '0.15em',
        textTransform: 'uppercase', cursor: 'pointer',
        color: colors.text, opacity: 0,
        animation: 'fadeIn 0.3s ease 1.5s forwards',
      }}>
        Continue
      </button>
    </div>
  );
}

// ── ESCAPED OVERLAY — The First Breath ───────────────────
export function EscapedOverlay({ visible, subTechName, matchContainerRef }) {
  if (!visible) return null;

  const [phase, setPhase] = useState(0); // 0=flash, 1=field
  const colors = FINISH_COLORS.escaped;

  useEffect(() => {
    if (!visible) return;
    // White flash then settle to teal
    setTimeout(() => setPhase(1), 150);
  }, [visible]);

  // Phase 0: white flash — the gasp
  if (phase === 0) {
    return <div style={{ position: 'fixed', inset: 0, zIndex: 99, background: '#FFFFFF', opacity: 0.3 }} />;
  }

  return (
    <div className="finish-overlay" style={{ background: colors.bg, pointerEvents: 'none' }}>
      <div className="headline" style={{ color: colors.text }}>ESCAPED</div>
      <div className="divider" style={{ background: colors.text }} />
      <div style={{
        fontFamily: T.display, fontSize: 18, fontStyle: 'italic',
        color: colors.text, opacity: 0,
        animation: 'fadeIn 0.6s ease 0.55s forwards',
      }}>
        {subTechName || 'Submission'} Defended
      </div>
    </div>
  );
}

// ── CAUGHT OVERLAY — The Trap Closes ─────────────────────
export function CaughtOverlay({ visible, positionName, onComplete }) {
  if (!visible) return null;

  const [dimOpacity, setDimOpacity] = useState(0);
  const [showText, setShowText] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const colors = FINISH_COLORS.caught;

  useEffect(() => {
    if (!visible) return;
    // Slow dim — 800ms, like a choke sinking in
    requestAnimationFrame(() => setDimOpacity(0.85));
    // "CAUGHT" fades in halfway through the dim
    setTimeout(() => setShowText(true), 400);
    // Screen shake when fully dark
    setTimeout(() => setShowDetails(true), 1200);
    // Auto-transition to sub minigame
    const t = setTimeout(() => { if (onComplete) onComplete(); }, 3500);
    return () => clearTimeout(t);
  }, [visible]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 98,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: colors.bg,
      opacity: dimOpacity,
      transition: 'opacity 0.8s ease',
    }}>
      {/* Red seep from edges */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        boxShadow: showDetails ? 'inset 0 0 120px rgba(194,48,40,0.08)' : 'none',
        transition: 'box-shadow 2s ease',
      }} />

      {/* CAUGHT */}
      <div style={{
        fontFamily: T.display,
        fontSize: 'clamp(48px, 14vw, 56px)',
        color: colors.text,
        opacity: showText ? 1 : 0,
        transition: 'opacity 0.8s ease',
        letterSpacing: '-0.02em',
        wordBreak: 'keep-all',
      }}>
        CAUGHT
      </div>

      {/* Details */}
      {showDetails && (
        <>
          {/* Danger icon */}
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" style={{ marginTop: 16, opacity: 0, animation: 'fadeIn 0.4s ease forwards' }}>
            <path d="M12 2L2 22h20L12 2z" stroke={colors.text} strokeWidth="1.5" fill={colors.text + '10'} />
            <line x1="12" y1="9" x2="12" y2="15" stroke={colors.text} strokeWidth="2" strokeLinecap="round" />
            <circle cx="12" cy="18" r="1" fill={colors.text} />
          </svg>

          <div style={{ fontFamily: T.mono, fontSize: 10, color: colors.text, opacity: 0.5, marginTop: 12, animation: 'fadeIn 0.4s ease 0.2s forwards' }}>
            No escapes from this position
          </div>
          {positionName && (
            <div style={{ fontFamily: T.display, fontSize: 14, color: colors.text, opacity: 0.3, marginTop: 6, animation: 'fadeIn 0.4s ease 0.4s forwards' }}>
              {positionName}
            </div>
          )}
          <div style={{ fontFamily: T.mono, fontSize: 9, color: colors.text, opacity: 0.25, marginTop: 12, animation: 'fadeIn 0.4s ease 0.8s forwards' }}>
            -30% escape · 0% reversal
          </div>
          <div style={{ fontFamily: T.body, fontSize: 13, color: colors.text, fontStyle: 'italic', opacity: 0, marginTop: 16, animation: 'fadeIn 0.4s ease 1.3s forwards' }}>
            The submission begins...
          </div>
        </>
      )}
    </div>
  );
}

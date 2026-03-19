// ═══════════════════════════════════════════════════════════
// MATCH — OVERLAYS (Animated)
// Reveal sequence, TAP, Finish, Escaped, Caught overlays
// Uses animations.js helpers for particles, text reveal, shakes
// ═══════════════════════════════════════════════════════════

import React from 'react';
const { useRef, useEffect, useState } = React;
import { T } from '../../lib/tokens';
import { FlipCard } from '../../components/MoveCard';
import { revealText, burstParticles, screenShake } from '../../lib/animations';
import { getOutcomeColor } from '../../lib/atmospheres';

const F = {
  display: { fontFamily: T.display },
  mono: { fontFamily: T.mono },
};

// ── REVEAL OVERLAY ───────────────────────────────────────
export function RevealOverlay({ revealData, yourFlipped, oppFlipped, showResult, onDismiss, matchContainerRef, particleContainerRef }) {
  if (!revealData) return null;

  const outcomeColor = getOutcomeColor(revealData.result);
  const headlineRef = useRef(null);
  const [flashVisible, setFlashVisible] = useState(true);

  // Orchestrate reveal sequence
  useEffect(() => {
    if (!revealData) return;

    // T+0ms: Flash + screen shake
    if (matchContainerRef?.current) screenShake(matchContainerRef.current);
    setFlashVisible(true);
    const t1 = setTimeout(() => setFlashVisible(false), 500);

    // T+450ms: Your card particle burst
    const t2 = setTimeout(() => {
      if (particleContainerRef?.current) {
        const rect = particleContainerRef.current.getBoundingClientRect();
        burstParticles(particleContainerRef.current, rect.width * 0.35, rect.height * 0.45, outcomeColor, 10);
      }
    }, 450);

    // T+820ms: Opp card particle burst
    const t3 = setTimeout(() => {
      if (particleContainerRef?.current) {
        const rect = particleContainerRef.current.getBoundingClientRect();
        burstParticles(particleContainerRef.current, rect.width * 0.65, rect.height * 0.45, T.trans, 8);
      }
    }, 820);

    // T+1300ms: Headline text reveal
    const t4 = setTimeout(() => {
      if (headlineRef.current && revealData.description) {
        revealText(headlineRef.current, revealData.description, outcomeColor, 35);
      }
    }, 1300);

    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, [revealData]);

  return (
    <div onClick={onDismiss} style={{ position: 'absolute', inset: 0, zIndex: 60, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: T.bg, cursor: 'pointer' }}>
      {/* Flash overlay */}
      {flashVisible && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none',
          background: `radial-gradient(ellipse at 50% 40%, ${outcomeColor}10 0%, transparent 70%)`,
          animation: 'fadeIn 0.1s ease-out, fadeSlideUp 0.5s ease-out reverse forwards',
          animationDelay: '0s, 0.1s',
        }} />
      )}

      {/* Grid bg */}
      <div style={{ position: 'absolute', inset: 0, backgroundImage: `linear-gradient(${T.border} 1px, transparent 1px), linear-gradient(90deg, ${T.border} 1px, transparent 1px)`, backgroundSize: '20px 20px', opacity: 0.1 }} />

      {/* Turn label */}
      <div style={{ ...F.mono, fontSize: 9, letterSpacing: '0.2em', color: T.muted, textTransform: 'uppercase', marginBottom: 20, zIndex: 2, animation: 'fadeSlideDown 0.3s var(--ease-out-expo) 0.15s both' }}>
        Turn {revealData.turn} — Reveal
      </div>

      {/* Cards */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'center', marginBottom: 20, zIndex: 2 }}>
        <div style={{ animation: 'fadeSlideUp 0.3s var(--ease-out-expo) 0.2s both' }}>
          <FlipCard
            move={{ name: revealData?.myMoveName || 'Your Move', from_position: null, to_position: null }}
            type={revealData?.myMoveType || 'transition'}
            isOpponent={false}
            flipped={yourFlipped}
          />
        </div>
        <div style={{ ...F.display, fontSize: 11, color: T.dim, zIndex: 2, animation: 'fadeIn 0.2s var(--ease-standard) 0.25s both' }}>VS</div>
        <div style={{ animation: 'fadeSlideUp 0.3s var(--ease-out-expo) 0.3s both' }}>
          <FlipCard
            move={{ name: revealData?.oppMoveName || 'Defended', from_position: null, to_position: null }}
            type={revealData?.oppMoveType || 'transition'}
            isOpponent={true}
            flipped={oppFlipped}
          />
        </div>
      </div>

      {/* Result area */}
      <div style={{ zIndex: 2, textAlign: 'center', opacity: showResult ? 1 : 0, transform: showResult ? 'translateY(0)' : 'translateY(12px)', transition: 'opacity 0.4s, transform 0.4s' }}>
        {revealData.variantName && (
          <div style={{ marginBottom: 6, animation: 'fadeSlideUp 0.4s var(--ease-out-expo)' }}>
            <div style={{ ...F.display, fontSize: 24, color: T.gold, animation: 'shimmer 2s ease-in-out infinite', lineHeight: 1 }}>{revealData.variantName}</div>
            <div style={{ ...F.mono, fontSize: 8, color: T.muted, marginTop: 2 }}>Variant of {revealData.myMoveName || 'technique'}</div>
          </div>
        )}
        {/* Headline — filled by revealText */}
        <div ref={headlineRef} style={{ ...F.display, fontSize: 28, lineHeight: 1, marginBottom: 4, minHeight: 34 }} />
        {revealData.newPosName && (
          <div style={{ ...F.mono, fontSize: 10, color: T.muted, marginTop: 6, animation: 'fadeSlideUp 0.3s var(--ease-out-expo) 1.7s both' }}>&rarr; {revealData.newPosName}</div>
        )}
        <div style={{ ...F.mono, fontSize: 8, color: T.dim, marginTop: 10, animation: 'fadeIn 0.3s ease 2.3s both' }}>Tap anywhere to continue</div>
      </div>
    </div>
  );
}

// ── TAP OVERLAY ──────────────────────────────────────────
export function TapOverlay({ tapOverlay, matchContainerRef, particleContainerRef }) {
  if (!tapOverlay) return null;

  const headlineRef = useRef(null);
  const subNameRef = useRef(null);

  useEffect(() => {
    if (!tapOverlay) return;

    // Screen shake + quad particle bursts
    if (matchContainerRef?.current) screenShake(matchContainerRef.current, true);

    if (particleContainerRef?.current) {
      const rect = particleContainerRef.current.getBoundingClientRect();
      const cx = rect.width / 2, cy = rect.height / 2;
      burstParticles(particleContainerRef.current, cx, cy, T.sub, 20);
      setTimeout(() => burstParticles(particleContainerRef.current, cx, cy, T.sub, 20), 120);
      setTimeout(() => burstParticles(particleContainerRef.current, cx, cy, T.sub, 20), 240);
      setTimeout(() => burstParticles(particleContainerRef.current, cx, cy, T.sub, 15), 360);
    }

    // Second shake at T+650
    setTimeout(() => {
      if (matchContainerRef?.current) screenShake(matchContainerRef.current, true);
    }, 650);

    // Text reveal
    setTimeout(() => {
      if (headlineRef.current) {
        revealText(headlineRef.current, 'TAPPED', T.sub, 50);
      }
    }, 400);

    setTimeout(() => {
      if (subNameRef.current) subNameRef.current.style.opacity = '1';
    }, 850);
  }, [tapOverlay]);

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 100,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: `radial-gradient(ellipse at 50% 40%, rgba(194,48,40,0.15) 0%, ${T.bg} 65%)`,
    }}>
      {/* Submission tag */}
      <div style={{ ...F.mono, fontSize: 10, letterSpacing: '0.2em', color: T.sub, marginBottom: 16, animation: 'fadeSlideDown 0.3s var(--ease-out-expo) 0.25s both' }}>
        SUBMISSION
      </div>

      {/* TAPPED — character reveal */}
      <div ref={headlineRef} style={{ ...F.display, fontSize: 72, lineHeight: 1, letterSpacing: '0.05em', minHeight: 80 }} />

      {/* Technique name */}
      <div ref={subNameRef} style={{ ...F.display, fontSize: 18, color: T.sub, marginTop: 16, fontStyle: 'italic', opacity: 0, transition: 'opacity 0.4s' }}>
        {tapOverlay.subName}
      </div>

      {/* Winner */}
      <div style={{ ...F.mono, fontSize: 11, color: T.muted, marginTop: 12, animation: 'fadeIn 0.3s ease 1.15s both' }}>
        {tapOverlay.won ? 'Submission Victory!' : 'You got tapped'}
      </div>
      <div style={{ ...F.mono, fontSize: 10, color: T.dim, marginTop: 6, animation: 'fadeIn 0.3s ease 1.5s both' }}>
        {tapOverlay.winnerName} wins
      </div>
    </div>
  );
}

// ── FINISH OVERLAY ───────────────────────────────────────
export function FinishOverlay({ finishOverlay, matchContainerRef }) {
  if (!finishOverlay) return null;

  const headlineRef = useRef(null);

  useEffect(() => {
    if (!finishOverlay) return;
    if (matchContainerRef?.current) screenShake(matchContainerRef.current);

    const word = finishOverlay.won ? 'VICTORY' : 'DEFEAT';
    const color = finishOverlay.won ? T.td : T.sub;
    setTimeout(() => {
      if (headlineRef.current) revealText(headlineRef.current, word, color, 45);
    }, 300);
  }, [finishOverlay]);

  const resultColor = finishOverlay.won ? T.td : T.sub;
  const bgColor = finishOverlay.won ? 'rgba(15,123,95,0.08)' : 'rgba(194,48,40,0.08)';

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 100,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: `radial-gradient(ellipse at 50% 40%, ${bgColor} 0%, ${T.bg} 65%)`,
    }}>
      <div style={{ ...F.mono, fontSize: 10, letterSpacing: '0.2em', color: resultColor, marginBottom: 16, animation: 'fadeSlideDown 0.3s var(--ease-out-expo) 0.15s both' }}>
        {finishOverlay.method?.toUpperCase() || 'POINTS'}
      </div>

      <div ref={headlineRef} style={{ ...F.display, fontSize: 56, lineHeight: 1, letterSpacing: '0.05em', minHeight: 64 }} />

      <div style={{ ...F.display, fontSize: 28, color: T.text, marginTop: 12, animation: 'fadeSlideUp 0.3s var(--ease-out-expo) 0.8s both' }}>
        {finishOverlay.myPoints} – {finishOverlay.oppPoints}
      </div>
      <div style={{ ...F.mono, fontSize: 11, color: T.muted, marginTop: 12, animation: 'fadeIn 0.3s ease 1.2s both' }}>
        Won by {finishOverlay.method}
      </div>
    </div>
  );
}

// ── ESCAPED OVERLAY ──────────────────────────────────────
export function EscapedOverlay({ visible, matchContainerRef, particleContainerRef }) {
  if (!visible) return null;

  const headlineRef = useRef(null);

  useEffect(() => {
    if (!visible) return;

    // Green particle bursts
    if (particleContainerRef?.current) {
      const rect = particleContainerRef.current.getBoundingClientRect();
      const cx = rect.width / 2, cy = rect.height / 2;
      burstParticles(particleContainerRef.current, cx, cy, T.td, 18);
      setTimeout(() => burstParticles(particleContainerRef.current, cx, cy, T.td, 12), 150);
      setTimeout(() => burstParticles(particleContainerRef.current, cx, cy, T.td, 10), 300);
    }

    setTimeout(() => {
      if (headlineRef.current) revealText(headlineRef.current, 'ESCAPED', T.td, 50);
    }, 400);
  }, [visible]);

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 99,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: `radial-gradient(ellipse at 50% 40%, rgba(15,123,95,0.10) 0%, ${T.bg} 60%)`,
      pointerEvents: 'none',
    }}>
      <div style={{ ...F.mono, fontSize: 10, letterSpacing: '0.2em', color: T.td, marginBottom: 16, animation: 'fadeSlideDown 0.3s var(--ease-out-expo) 0.25s both' }}>
        SUBMISSION DEFENSE
      </div>
      <div ref={headlineRef} style={{ ...F.display, fontSize: 56, lineHeight: 1, minHeight: 64 }} />
    </div>
  );
}

// ── CAUGHT OVERLAY ───────────────────────────────────────
export function CaughtOverlay({ visible, positionName, onComplete }) {
  if (!visible) return null;

  const headlineRef = useRef(null);

  useEffect(() => {
    if (!visible) return;

    setTimeout(() => {
      if (headlineRef.current) revealText(headlineRef.current, 'CAUGHT', '#8B1A14', 50);
    }, 600);

    // Auto-transition to sub minigame
    const t = setTimeout(() => { if (onComplete) onComplete(); }, 3200);
    return () => clearTimeout(t);
  }, [visible]);

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 98,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: `radial-gradient(ellipse at 50% 40%, rgba(194,48,40,0.18) 0%, ${T.bg} 60%)`,
      animation: 'fadeIn 0.3s ease',
    }}>
      {/* Edge glow */}
      <div style={{ position: 'absolute', inset: 0, boxShadow: 'inset 0 0 100px rgba(194,48,40,0.14)', pointerEvents: 'none' }} />

      {/* Vignette */}
      <div className="vignette-overlay active" />

      {/* Danger icon */}
      <div style={{ animation: 'fadeSlideDown 0.3s var(--ease-out-back) 1.1s both' }}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" style={{ marginBottom: 12 }}>
          <path d="M12 2L2 22h20L12 2z" stroke="#8B1A14" strokeWidth="1.5" fill="rgba(194,48,40,0.08)" />
          <line x1="12" y1="9" x2="12" y2="15" stroke="#8B1A14" strokeWidth="2" strokeLinecap="round" />
          <circle cx="12" cy="18" r="1" fill="#8B1A14" />
        </svg>
      </div>

      <div ref={headlineRef} style={{ ...F.display, fontSize: 56, lineHeight: 1, minHeight: 64 }} />

      <div style={{ ...F.mono, fontSize: 10, color: T.sub, marginTop: 12, animation: 'fadeIn 0.3s ease 1.3s both' }}>
        No escapes from this position
      </div>
      {positionName && (
        <div style={{ ...F.display, fontSize: 18, color: T.muted, marginTop: 6, animation: 'fadeIn 0.3s ease 1.3s both' }}>
          {positionName}
        </div>
      )}
      <div style={{ ...F.mono, fontSize: 9, color: T.sub + '99', marginTop: 12, animation: 'fadeIn 0.3s ease 1.8s both' }}>
        -30% escape chance · 0% reversal
      </div>
      <div style={{ ...F.body, fontSize: 13, color: T.muted, fontStyle: 'italic', marginTop: 16, animation: 'fadeIn 0.3s ease 2.5s both' }}>
        The submission begins...
      </div>
    </div>
  );
}

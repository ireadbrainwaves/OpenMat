// ═══════════════════════════════════════════════════════════
// MATCH — OVERLAYS
// Reveal, TAP, Finish, Escaped overlay components
// ═══════════════════════════════════════════════════════════

import React from 'react';
import { T } from '../../lib/tokens';
import { FlipCard } from '../../components/MoveCard';

const F = {
  display: { fontFamily: T.display },
  mono: { fontFamily: T.mono },
};

// ── REVEAL OVERLAY ───────────────────────────────────────
export function RevealOverlay({ revealData, yourFlipped, oppFlipped, showResult, onDismiss }) {
  if (!revealData) return null;
  return (
    <div onClick={onDismiss} style={{ position: 'absolute', inset: 0, zIndex: 60, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: T.bg, cursor: 'pointer' }}>
      <div style={{ position: 'absolute', inset: 0, backgroundImage: `linear-gradient(${T.border} 1px, transparent 1px), linear-gradient(90deg, ${T.border} 1px, transparent 1px)`, backgroundSize: '20px 20px', opacity: 0.1 }} />

      <div style={{ ...F.mono, fontSize: 9, letterSpacing: '0.2em', color: T.muted, textTransform: 'uppercase', marginBottom: 20, zIndex: 2 }}>Turn {revealData.turn} -- Reveal</div>

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

      <div style={{ zIndex: 2, textAlign: 'center', opacity: showResult ? 1 : 0, transform: showResult ? 'translateY(0)' : 'translateY(12px)', transition: 'opacity 0.4s, transform 0.4s' }}>
        {revealData.variantName && (
          <div style={{ marginBottom: 6 }}>
            <div style={{ ...F.display, fontSize: 24, color: T.gold, animation: 'shimmer 2s ease-in-out infinite', lineHeight: 1 }}>{revealData.variantName}</div>
            <div style={{ ...F.mono, fontSize: 8, color: T.muted, marginTop: 2 }}>Variant of {revealData.myMoveName || 'technique'}</div>
          </div>
        )}
        <div style={{ ...F.display, fontSize: 28, lineHeight: 1, marginBottom: 4, color: revealData.result === 'submission_win' ? T.red : revealData.result === 'sweep' ? T.green : T.amber }}>{revealData.description}</div>
        {revealData.newPosName && (
          <div style={{ ...F.mono, fontSize: 10, color: T.muted, marginTop: 6 }}>&rarr; {revealData.newPosName}</div>
        )}
        <div style={{ ...F.mono, fontSize: 8, color: T.dim, marginTop: 10 }}>Tap anywhere to continue</div>
      </div>
    </div>
  );
}

// ── TAP OVERLAY ──────────────────────────────────────────
export function TapOverlay({ tapOverlay }) {
  if (!tapOverlay) return null;
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 100,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: tapOverlay.won ? '#FFD700' : '#E63946',
      animation: 'tapShake 0.4s ease-out',
    }}>
      <div style={{
        ...F.display, fontSize: 72, fontWeight: 900, color: tapOverlay.won ? '#1a1a1a' : '#fff',
        lineHeight: 1, letterSpacing: '0.05em',
        animation: 'tapBounce 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        textShadow: tapOverlay.won ? 'none' : '0 4px 20px rgba(0,0,0,0.4)',
      }}>TAP!</div>
      <div style={{ ...F.display, fontSize: 20, color: tapOverlay.won ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.9)', marginTop: 16, textAlign: 'center' }}>{tapOverlay.subName}</div>
      <div style={{ ...F.mono, fontSize: 13, color: tapOverlay.won ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.7)', marginTop: 12, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{tapOverlay.won ? 'Submission Victory!' : 'You got tapped'}</div>
      <div style={{ ...F.mono, fontSize: 11, color: tapOverlay.won ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.5)', marginTop: 8 }}>{tapOverlay.winnerName} wins</div>
    </div>
  );
}

// ── FINISH OVERLAY ───────────────────────────────────────
export function FinishOverlay({ finishOverlay }) {
  if (!finishOverlay) return null;
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 100,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: finishOverlay.won ? '#FFD700' : finishOverlay.method === 'draw' ? '#4A90D9' : '#E63946',
      animation: 'tapShake 0.4s ease-out',
    }}>
      <div style={{
        ...F.display, fontSize: 56, fontWeight: 900, color: finishOverlay.won ? '#1a1a1a' : '#fff',
        lineHeight: 1, letterSpacing: '0.05em',
        animation: 'tapBounce 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        textShadow: finishOverlay.won ? 'none' : '0 4px 20px rgba(0,0,0,0.4)',
      }}>{finishOverlay.won ? 'VICTORY' : 'DEFEAT'}</div>
      <div style={{ ...F.display, fontSize: 28, color: finishOverlay.won ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.9)', marginTop: 12 }}>{finishOverlay.myPoints} – {finishOverlay.oppPoints}</div>
      <div style={{ ...F.mono, fontSize: 13, color: finishOverlay.won ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.7)', marginTop: 12, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Won by {finishOverlay.method}</div>
    </div>
  );
}

// ── ESCAPED OVERLAY ──────────────────────────────────────
export function EscapedOverlay({ visible }) {
  if (!visible) return null;
  return (
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
  );
}

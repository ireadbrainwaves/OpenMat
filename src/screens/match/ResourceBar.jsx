// ═══════════════════════════════════════════════════════════
// MATCH — RESOURCE BAR (Animated)
// GP bar with belt-based max, chain counter with glow,
// GP change flash, opponent stamina
// ═══════════════════════════════════════════════════════════

import React from 'react';
const { useRef, useEffect, useState } = React;
import { T } from '../../lib/tokens';

const F = {
  display: { fontFamily: T.display },
  mono: { fontFamily: T.mono },
};

// Belt-based max GP
const GP_MAX_BY_BELT = {
  white: 10,
  blue: 11,
  purple: 12,
  brown: 13,
  black: 14,
};

export default function ResourceBar({
  myGp, gpMax: gpMaxProp, gpColor, gpPct, isDesperation,
  posRecovery, myStanceVal, myChain,
  oppGp, playerBelt,
}) {
  // Use belt-based max GP, fallback to prop, then 10
  const gpMax = GP_MAX_BY_BELT[playerBelt] || gpMaxProp || 10;
  const actualPct = Math.max(0, (myGp / gpMax) * 100);

  // GP change flash
  const [gpFlash, setGpFlash] = useState(null);
  const prevGp = useRef(myGp);
  useEffect(() => {
    if (myGp !== prevGp.current) {
      const diff = myGp - prevGp.current;
      const flashColor = diff > 0 ? T.green : diff < -2 ? T.red : T.amber;
      setGpFlash(flashColor);
      setTimeout(() => setGpFlash(null), 400);
      prevGp.current = myGp;
    }
  }, [myGp]);

  // Chain counter animation
  const [chainPop, setChainPop] = useState(false);
  const prevChain = useRef(myChain);
  useEffect(() => {
    if (myChain > prevChain.current) {
      setChainPop(true);
      setTimeout(() => setChainPop(false), 400);
    }
    prevChain.current = myChain;
  }, [myChain]);

  const oppStaminaLabel = oppGp >= 8 ? 'Fresh' : oppGp >= 4 ? 'Tired' : 'Gassed';
  const oppStaminaColor = oppGp >= 8 ? T.green : oppGp >= 4 ? T.amber : T.red;
  const isSetup = myStanceVal === 'setup';
  const arrow = posRecovery > 0 ? '\u25B2' : posRecovery < 0 ? '\u25BC' : '\u2500';
  const recoveryColor = posRecovery > 0 ? T.green : posRecovery < 0 ? T.red : T.dim;

  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '6px 18px', gap: 8, borderBottom: `1px solid ${T.border}`, flexShrink: 0, background: isDesperation ? '#ff222208' : T.surface }}>
      <span style={{
        ...F.display, fontSize: 18, lineHeight: 1,
        color: gpFlash || gpColor,
        transition: 'color 0.2s',
      }}>{myGp}</span>
      <span style={{ ...F.mono, fontSize: 8, color: T.dim }}>/{gpMax} GP</span>
      <div style={{ flex: 1, height: 3, background: T.border, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: actualPct + '%',
          background: gpColor, borderRadius: 2,
          transition: 'width 0.6s ease',
        }} />
      </div>
      <span style={{ ...F.mono, fontSize: 9, fontWeight: 600, color: recoveryColor }}>
        {posRecovery > 0 ? '+' : ''}{posRecovery}{arrow}
        {isSetup && <span style={{ color: T.amber }}> +2</span>}
      </span>
      <div style={{ width: 1, height: 14, background: T.border }} />
      <span style={{ ...F.mono, fontSize: 7, color: T.dim }}>Chain</span>
      <span style={{
        ...F.display, fontSize: 15, lineHeight: 1,
        color: myChain >= 4 ? T.red : myChain >= 2 ? T.amber : T.dim,
        animation: chainPop ? 'scorePop 0.4s var(--ease-out-back)' : 'none',
        transition: 'color 0.2s',
      }}>{myChain}</span>
      {myChain >= 2 && (
        <div style={{
          display: 'flex', gap: 1,
          boxShadow: myChain >= 3 ? '0 0 12px rgba(184,134,11,0.12)' : 'none',
          padding: '2px 3px', borderRadius: 3,
          transition: 'box-shadow 0.4s',
        }}>
          {Array.from({ length: Math.min(myChain, 5) }).map((_, i) => (
            <div key={i} style={{ width: 4, height: 10, borderRadius: 1, background: myChain >= 4 ? T.red : T.amber, opacity: 0.5 + (i * 0.1) }} />
          ))}
        </div>
      )}
      <div style={{ width: 1, height: 14, background: T.border }} />
      <span style={{ ...F.mono, fontSize: 8, padding: '2px 6px', borderRadius: 3, background: oppStaminaColor + '18', color: oppStaminaColor, fontWeight: 600, textTransform: 'uppercase' }}>{oppStaminaLabel}</span>
    </div>
  );
}

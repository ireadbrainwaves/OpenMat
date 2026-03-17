// ═══════════════════════════════════════════════════════════
// MATCH — RESOURCE BAR
// GP bar, position recovery, chain counter, opponent stamina
// ═══════════════════════════════════════════════════════════

import React from 'react';
import { T } from '../../lib/tokens';

const F = {
  display: { fontFamily: T.display },
  mono: { fontFamily: T.mono },
};

export default function ResourceBar({
  myGp, gpMax, gpColor, gpPct, isDesperation,
  posRecovery, myStanceVal, myChain,
  oppGp,
}) {
  const oppStaminaLabel = oppGp >= 8 ? 'Fresh' : oppGp >= 4 ? 'Tired' : 'Gassed';
  const oppStaminaColor = oppGp >= 8 ? T.green : oppGp >= 4 ? T.amber : T.red;
  const isSetup = myStanceVal === 'setup';
  const arrow = posRecovery > 0 ? '▲' : posRecovery < 0 ? '▼' : '─';
  const recoveryColor = posRecovery > 0 ? T.green : posRecovery < 0 ? T.red : T.dim;

  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '6px 18px', gap: 8, borderBottom: `1px solid ${T.border}`, flexShrink: 0, background: isDesperation ? '#ff222208' : T.surface }}>
      <span style={{ ...F.display, fontSize: 18, color: gpColor, lineHeight: 1 }}>{myGp}</span>
      <span style={{ ...F.mono, fontSize: 8, color: T.dim }}>/{gpMax} GP</span>
      <div style={{ flex: 1, height: 3, background: T.border, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: gpPct + '%', background: gpColor, borderRadius: 2, transition: 'width 0.3s' }} />
      </div>
      <span style={{ ...F.mono, fontSize: 9, fontWeight: 600, color: recoveryColor }}>
        {posRecovery > 0 ? '+' : ''}{posRecovery}{arrow}
        {isSetup && <span style={{ color: T.amber }}> +2</span>}
      </span>
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
  );
}

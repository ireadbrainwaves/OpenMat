// ═══════════════════════════════════════════════════════════
// MATCH — STANCE PHASE
// Stance picker (attack/defend/setup) + wait state
// ═══════════════════════════════════════════════════════════

import React from 'react';
import { T } from '../../lib/tokens';
import { StanceIcon } from '../../lib/icons';
import { Spinner } from '../../components/UI';

const F = {
  display: { fontFamily: T.display },
  mono: { fontFamily: T.mono },
  body: { fontFamily: T.body },
};

const STANCES = [
  { id: 'attack', label: 'Attack', desc: 'Commit to offense -- base GP cost', gp: 'Base GP', color: T.red },
  { id: 'defend', label: 'Defend', desc: '+15% defense -- counters free', gp: '0 GP', color: T.blue },
  { id: 'setup',  label: 'Setup',  desc: 'Recover grip, reset -- +2 GP',   gp: '+2 GP', color: T.amber },
];

export function StancePick({ selectedStance, busy, lockStance, oppTendency }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 18px', gap: 14 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ ...F.mono, fontSize: 9, letterSpacing: '0.1em', color: T.muted, textTransform: 'uppercase' }}>Phase 1</div>
        <div style={{ ...F.display, fontSize: 26, color: T.text }}>Choose Your Stance</div>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        {STANCES.map(s => {
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

      {oppTendency && oppTendency.length > 0 && (
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
  );
}

export function StanceWait() {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
      <Spinner />
      <div style={{ ...F.mono, fontSize: 11, color: T.muted }}>Waiting for opponent's stance...</div>
    </div>
  );
}

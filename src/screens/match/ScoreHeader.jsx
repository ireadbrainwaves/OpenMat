// ═══════════════════════════════════════════════════════════
// MATCH — SCORE HEADER
// Turn counter, score display, archetype matchup
// ═══════════════════════════════════════════════════════════

import React from 'react';
import { T } from '../../lib/tokens';
import { ARCHETYPES } from '../../lib/constants';

const F = {
  display: { fontFamily: T.display },
  mono: { fontFamily: T.mono },
};

export default function ScoreHeader({ match, profile, opp, myPts, oppPts }) {
  return (
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
  );
}

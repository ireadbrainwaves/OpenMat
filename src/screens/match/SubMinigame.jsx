// ═══════════════════════════════════════════════════════════
// MATCH — SUB MINIGAME (Animated)
// Submission attack/defend phase with atmosphere intensification,
// tighten meter with heartbeat, chain subs, counters
// ═══════════════════════════════════════════════════════════

import React from 'react';
const { useRef, useEffect } = React;
import { T, MTColors, MTLabels } from '../../lib/tokens';
import { MoveIcon } from '../../lib/icons';
import { Btn, Spinner } from '../../components/UI';
import { G } from '../../lib/supabase';
import { getTightenAtmosphere, getTightenEdgeGlow } from '../../lib/atmospheres';
import { burstParticles, screenShake } from '../../lib/animations';

const F = {
  display: { fontFamily: T.display },
  mono: { fontFamily: T.mono },
  body: { fontFamily: T.body },
};

// Tighten meter fill gradient by level
function tightenGradient(t) {
  if (t >= 4) return 'linear-gradient(90deg, #8B1A14, #C23028)';
  if (t >= 3) return 'linear-gradient(90deg, #C23028, #8B1A14)';
  if (t >= 2) return 'linear-gradient(90deg, #E8841A, #C23028)';
  if (t >= 1) return 'linear-gradient(90deg, #B8860B, #E8841A)';
  return T.dim;
}

export default function SubMinigame({
  match, profile, isAtt, myGp, oppGp, busy,
  subSel, setSubSel,
  subPickerFor, setSubPickerFor,
  subPickerTechId, setSubPickerTechId,
  lockSubChoice,
  getChainSubOptions, getCounterOptions,
  subReveal, chainSub,
  matchContainerRef, particleContainerRef,
}) {
  const subTech = G.techniques[match.sub_technique_id];
  const myLk = isAtt ? match.sub_attacker_locked : match.sub_defender_locked;
  const tighten = match?.sub_tighten_turns ?? 0;
  const subRound = match?.sub_phase ?? 1;
  const panelRef = useRef(null);

  // Screen shake on sub round resolve
  useEffect(() => {
    if (subReveal && matchContainerRef?.current) {
      screenShake(matchContainerRef.current);
      if (particleContainerRef?.current) {
        const rect = particleContainerRef.current.getBoundingClientRect();
        burstParticles(particleContainerRef.current, rect.width / 2, rect.height * 0.3, T.sub, 8);
      }
    }
  }, [subReveal]);

  const attOpts = [
    { id: 'tighten', label: 'Tighten', desc: 'Commit fully', cost: 2, color: T.red },
    { id: 'adjust', label: 'Adjust', desc: 'Reposition grip', cost: 1, color: T.amber },
    { id: 'chain_sub', label: 'Chain Sub', desc: 'Switch submission', cost: 1, color: T.purple },
  ];
  const defOpts = [
    { id: 'escape', label: 'Tech Escape', desc: 'Strip the grip', cost: 1, color: T.teal },
    { id: 'explode', label: 'Explode', desc: 'All-out burst', cost: 2, color: T.red },
    { id: 'survive', label: 'Survive', desc: 'Weather the storm', cost: 0, color: T.blue },
    { id: 'counter', label: 'Counter', desc: 'Sweep or counter-sub', cost: 2, color: T.gold },
  ];
  const opts = isAtt ? attOpts : defOpts;
  const chainOpts = isAtt ? getChainSubOptions() : [];
  const counterOpts = isAtt ? [] : getCounterOptions();

  const atmoClass = getTightenAtmosphere(tighten);
  const edgeGlow = getTightenEdgeGlow(tighten);
  const showVignette = tighten >= 3;

  return (
    <div ref={panelRef} style={{ flex: 1, overflowY: 'auto', padding: '0 18px 100px', position: 'relative' }}>
      {/* Atmosphere */}
      <div className={`atmosphere ${atmoClass}`} />

      {/* Vignette */}
      <div className={`vignette-overlay ${showVignette ? 'active' : ''}`} />

      {/* Edge glow */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', boxShadow: edgeGlow, transition: 'box-shadow 0.6s', zIndex: 2 }} />

      {/* Sub header */}
      <div style={{ textAlign: 'center', margin: '12px 0', padding: 14, background: T.red + '0A', borderRadius: 10, border: `1px solid ${T.red}30`, position: 'relative', zIndex: 3, animation: 'fadeSlideDown 0.3s var(--ease-out-expo)' }}>
        <div style={{ ...F.mono, fontSize: 11, color: T.red, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Submission</div>
        {chainSub ? (
          <div style={{ marginTop: 2 }}>
            <div style={{ ...F.display, fontSize: 16, color: T.dim, textDecoration: 'line-through', opacity: 0.5 }}>{chainSub.oldName}</div>
            <div style={{ ...F.display, fontSize: 22, color: '#FFD700', animation: 'fadeSlideUp 0.4s var(--ease-out-expo)', textShadow: '0 0 12px #FFD70040' }}>Chain &rarr; {chainSub.newName}!</div>
          </div>
        ) : (
          <div style={{ ...F.display, fontSize: 22, color: T.text, marginTop: 2 }}>{subTech?.name || 'Submission'}</div>
        )}
        <div style={{ ...F.mono, fontSize: 11, color: T.muted, marginTop: 4 }}>{isAtt ? 'Finish it!' : 'Escape or survive!'}</div>
      </div>

      {/* GP drain */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginBottom: 8, position: 'relative', zIndex: 3 }}>
        <span style={{ ...F.mono, fontSize: 9, color: T.red }}>You: GP {myGp} &#9660;-1/rd</span>
        <span style={{ ...F.mono, fontSize: 9, color: T.dim }}>|</span>
        <span style={{ ...F.mono, fontSize: 9, color: T.red }}>Opp: GP {oppGp} &#9660;-1/rd</span>
      </div>

      {/* Tighten meter — enhanced */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: 10, position: 'relative', zIndex: 3 }}>
        <span style={{ ...F.mono, fontSize: 8, color: T.dim, width: 50, textAlign: 'right' }}>TIGHTEN</span>
        <div style={{
          display: 'flex', gap: 3,
          animation: tighten >= 3 ? 'meterHeartbeat 0.8s infinite' : 'none',
        }}>
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} style={{
              width: 28, height: 7, borderRadius: 3, position: 'relative', overflow: 'hidden',
              background: i <= tighten ? tightenGradient(tighten) : T.dim + '30',
              transition: 'background 0.4s, box-shadow 0.4s',
              boxShadow: i === tighten ? `0 0 8px ${T.red}60` : 'none',
            }}>
              {/* Shimmer on active tip */}
              {i === tighten && (
                <div style={{
                  position: 'absolute', inset: 0,
                  background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
                  animation: 'meterPulseGlow 1.2s infinite',
                }} />
              )}
            </div>
          ))}
        </div>
        <span style={{ ...F.mono, fontSize: 9, color: tighten >= 4 ? T.red : T.muted, width: 30, fontWeight: tighten >= 4 ? 700 : 400 }}>{tighten}/5</span>
      </div>

      {/* Sub choice reveal — enhanced */}
      {subReveal && (
        <SubChoiceReveal myChoice={subReveal.myChoice} oppChoice={subReveal.oppChoice} />
      )}

      {/* Round indicators — history pills */}
      <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 14, position: 'relative', zIndex: 3 }}>
        {[1, 2, 3].map(r => (
          <div key={r} style={{
            width: 22, height: 22, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, fontWeight: 600, fontFamily: T.mono,
            background: r < subRound ? T.red : 'transparent',
            border: `1.5px solid ${r <= subRound ? T.red : T.dim}`,
            color: r < subRound ? '#fff' : r === subRound ? T.text : T.dim,
            animation: r === subRound ? 'fadeSlideUp 0.3s var(--ease-out-expo)' : 'none',
          }}>{r}</div>
        ))}
      </div>

      {/* Options */}
      {!myLk && !subPickerFor && opts.map((o, idx) => {
        const oSel = subSel === o.id;
        const needsTech = o.id === 'chain_sub' || o.id === 'counter';
        const techPool = o.id === 'chain_sub' ? chainOpts : o.id === 'counter' ? counterOpts : [];
        const noTechs = needsTech && techPool.length === 0;
        const canUse = myGp >= o.cost && !noTechs;
        return (
          <div key={o.id} onClick={() => canUse && setSubSel(o.id)} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 14px', marginBottom: 5, borderRadius: 8, cursor: canUse ? 'pointer' : 'default',
            opacity: canUse ? 1 : 0.35, transition: 'all 0.15s',
            background: oSel ? o.color + '10' : T.surface,
            border: `1px solid ${oSel ? o.color : T.border}`,
            borderLeft: `3px solid ${oSel ? o.color : T.border}`,
            position: 'relative', zIndex: 3,
            animation: `fadeSlideUp 0.25s var(--ease-out-expo) ${idx * 0.05}s both`,
          }}>
            <div>
              <div style={{ ...F.body, fontSize: 13, fontWeight: 600, color: oSel ? T.text : T.muted }}>{o.label}</div>
              <div style={{ ...F.mono, fontSize: 10, color: T.dim }}>{noTechs ? 'No techniques available' : o.desc}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {needsTech && !noTechs && <span style={{ ...F.mono, fontSize: 8, color: T.dim }}>{techPool.length} opts</span>}
              <span style={{ ...F.mono, fontSize: 10, color: T.amber, fontWeight: 700 }}>{o.cost}GP</span>
            </div>
          </div>
        );
      })}

      {/* Locked wait */}
      {myLk && (
        <div style={{ textAlign: 'center', padding: 20, position: 'relative', zIndex: 3 }}>
          <Spinner />
          <div style={{ ...F.mono, fontSize: 11, color: T.muted, marginTop: 8 }}>Locked — waiting...</div>
        </div>
      )}

      {/* Lock-in button */}
      {!myLk && !subPickerFor && (
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '10px 18px 28px', background: `linear-gradient(180deg, transparent 0%, ${T.bg} 40%)`, zIndex: 4 }}>
          <Btn onClick={lockSubChoice} disabled={!subSel || busy} style={{ background: subSel ? `linear-gradient(135deg, ${T.red}, #c0392b)` : undefined }}>
            {busy ? <Spinner /> : subSel ? 'Lock In' : 'Select an Option'}
          </Btn>
        </div>
      )}

      {/* Technique picker */}
      {subPickerFor && (
        <TechniquePicker
          techs={subPickerFor === 'chain_sub' ? chainOpts : counterOpts}
          label={subPickerFor === 'chain_sub' ? 'Chain To...' : 'Counter With...'}
          color={subPickerFor === 'chain_sub' ? T.purple : T.gold}
          selectedId={subPickerTechId}
          onSelect={setSubPickerTechId}
          onConfirm={lockSubChoice}
          onCancel={() => { setSubPickerFor(null); setSubPickerTechId(null); setSubSel(null); }}
          busy={busy}
        />
      )}
    </div>
  );
}

// ── SUB CHOICE REVEAL ────────────────────────────────────
function SubChoiceReveal({ myChoice, oppChoice }) {
  const choiceColor = (c) => {
    const map = { tighten: T.red, adjust: T.amber, chain_sub: T.purple, escape: T.teal, explode: T.red, counter: T.gold, survive: T.blue };
    return map[c] || T.muted;
  };
  const choiceLabel = (c) => {
    const map = { tighten: 'TIGHTENING', adjust: 'ADJUSTED', chain_sub: 'CHAIN SUB', escape: 'ESCAPED', explode: 'EXPLODE', counter: 'COUNTER', survive: 'SURVIVED' };
    return map[c] || (c || '').replace('_', ' ');
  };

  return (
    <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 12, position: 'relative', zIndex: 3, animation: 'fadeSlideUp 0.3s var(--ease-out-expo)' }}>
      <div style={{ flex: 1, padding: '8px 10px', borderRadius: 8, textAlign: 'center', background: choiceColor(myChoice) + '18', border: `1px solid ${choiceColor(myChoice)}40` }}>
        <div style={{ ...F.mono, fontSize: 8, color: T.muted, marginBottom: 2 }}>YOU</div>
        <div style={{ ...F.body, fontSize: 11, fontWeight: 600, color: choiceColor(myChoice) }}>{choiceLabel(myChoice)}</div>
      </div>
      <div style={{ ...F.mono, fontSize: 9, color: T.dim, alignSelf: 'center' }}>vs</div>
      <div style={{ flex: 1, padding: '8px 10px', borderRadius: 8, textAlign: 'center', background: choiceColor(oppChoice) + '18', border: `1px solid ${choiceColor(oppChoice)}40` }}>
        <div style={{ ...F.mono, fontSize: 8, color: T.muted, marginBottom: 2 }}>OPP</div>
        <div style={{ ...F.body, fontSize: 11, fontWeight: 600, color: choiceColor(oppChoice) }}>{choiceLabel(oppChoice)}</div>
      </div>
    </div>
  );
}

// ── TECHNIQUE PICKER ─────────────────────────────────────
function TechniquePicker({ techs, label, color, selectedId, onSelect, onConfirm, onCancel, busy }) {
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0, top: 0, zIndex: 20,
      background: T.bg + 'F0', display: 'flex', flexDirection: 'column',
      animation: 'fadeSlideUp 0.2s var(--ease-out-expo)',
    }}>
      <div style={{ padding: '14px 18px 10px', borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ ...F.mono, fontSize: 9, color, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{label}</div>
            <div style={{ ...F.mono, fontSize: 10, color: T.dim, marginTop: 2 }}>{techs.length} technique{techs.length !== 1 ? 's' : ''} available</div>
          </div>
          <button onClick={onCancel} style={{
            background: 'none', border: `1px solid ${T.border}`, borderRadius: 4, padding: '4px 10px',
            fontFamily: T.mono, fontSize: 9, color: T.muted, cursor: 'pointer',
          }}>Cancel</button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 18px' }}>
        {techs.map((t, idx) => {
          const tech = G.techniques[t.id];
          if (!tech) return null;
          const isSel = selectedId === t.id;
          const tc = MTColors[tech.type] || T.muted;
          const toPos = tech.to_position ? G.positions[tech.to_position] : null;
          return (
            <div key={t.id} onClick={() => onSelect(t.id)} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
              marginBottom: 4, borderRadius: 8, cursor: 'pointer', transition: 'all 0.15s',
              background: isSel ? color + '12' : T.surface,
              border: `1px solid ${isSel ? color : T.border}`,
              borderLeft: `3px solid ${isSel ? color : T.border}`,
              animation: `fadeSlideUp 0.2s var(--ease-out-expo) ${idx * 0.04}s both`,
            }}>
              <MoveIcon type={tech.type} size={16} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ ...F.body, fontSize: 13, fontWeight: 600, color: isSel ? T.white : T.text }}>{tech.name}</div>
                <div style={{ ...F.mono, fontSize: 8, color: T.dim, display: 'flex', gap: 4, marginTop: 1 }}>
                  <span style={{ padding: '1px 4px', borderRadius: 2, background: tc + '18', color: tc }}>{MTLabels[tech.type] || 'MOVE'}</span>
                  {toPos && <span>&rarr; {toPos.name?.replace(/ \(.*\)/, '')}</span>}
                </div>
              </div>
              {isSel && (
                <div style={{ width: 16, height: 16, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg viewBox="0 0 12 12" width={8} height={8}><path d="M2 6L5 9L10 3" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ flexShrink: 0, padding: '10px 18px 28px', borderTop: `1px solid ${T.border}`, background: `linear-gradient(0deg, ${T.bg}, transparent)` }}>
        <Btn onClick={onConfirm} disabled={!selectedId || busy} style={{ background: selectedId ? `linear-gradient(135deg, ${color}, ${color}CC)` : undefined }}>
          {busy ? <Spinner /> : selectedId ? 'Lock In' : 'Pick a Technique'}
        </Btn>
      </div>
    </div>
  );
}

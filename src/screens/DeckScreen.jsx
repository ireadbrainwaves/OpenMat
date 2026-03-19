// ═══════════════════════════════════════════════════════════
// OPEN MAT — DECK SCREEN (LIGHT MODE REWRITE)
// Two tabs: My Deck | Library. MoveCard row + full modes.
// Position-grouped, collapsible, type-filtered.
// ═══════════════════════════════════════════════════════════

import React, { useState, useEffect, useMemo } from 'react';
import { T, TYPE_COLORS, TIER_STYLES, ARCHETYPES, ArchColors, ARCHETYPE_ANIMALS } from '../lib/tokens';
import { ArchIcon } from '../lib/icons';
import { RowCard, FullCard, TypeIcon, TierBadge } from '../components/MoveCard';
import { sb, G } from '../lib/supabase';
import { GP_COSTS } from '../lib/constants';
import { beltOrder } from '../lib/supabase';

const F = { display: T.display, mono: T.mono, body: T.body };

const FAMILY_ORDER = [
  'standing', 'clinch', 'guard', 'half_guard', 'passing',
  'side_control', 'mount', 'back', 'turtle', 'leg_entanglement',
];

const FAMILY_LABELS = {
  standing: 'Standing', clinch: 'Clinch', guard: 'Guard', half_guard: 'Half Guard',
  passing: 'Passing', side_control: 'Side Control', mount: 'Mount',
  back: 'Back', turtle: 'Turtle', leg_entanglement: 'Legs',
};

const TYPE_FILTERS = [
  { key: 'all', label: 'ALL', color: '#111827' },
  { key: 'submission', label: 'SUB', color: '#C23028' },
  { key: 'sweep', label: 'SWP', color: '#B8860B' },
  { key: 'transition', label: 'TRNS', color: '#2563EB' },
  { key: 'takedown', label: 'TD', color: '#0F7B5F' },
  { key: 'escape', label: 'ESC', color: '#7C3AED' },
];

export default function DeckScreen({ profile, onProfileUpdate }) {
  const [tab, setTab] = useState('deck');
  const [filter, setFilter] = useState('all');
  const [moves, setMoves] = useState([]);
  const [collapsed, setCollapsed] = useState({});
  const [showArchPicker, setShowArchPicker] = useState(false);
  const [switchingArch, setSwitchingArch] = useState(false);
  const [pendingArch, setPendingArch] = useState(null);
  const [expandedMove, setExpandedMove] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!profile) return;
    sb.from('player_move_stacks').select('*, techniques(*)').eq('profile_id', profile.id)
      .then(({ data }) => data && setMoves(data));
  }, [profile]);

  const deckMoves = useMemo(() => moves.map(m => ({
    ...m, ...(m.techniques || {}),
    tier: (profile?.drilled_moves || []).includes(m.technique_id) ? 'drilled'
      : m.times_used >= 25 ? 'mastered'
      : m.times_used >= 5 ? 'trained'
      : 'known',
  })), [moves, profile]);

  const deckTechIds = useMemo(() => new Set(deckMoves.map(m => m.technique_id)), [deckMoves]);

  const allTechs = useMemo(() => {
    const beltOrder = { white: 1, blue: 2, purple: 3, brown: 4, black: 5 };
    const lvl = beltOrder[profile?.belt] || 1;
    return Object.values(G.techniques).map(t => ({
      ...t,
      locked: (beltOrder[t.belt_unlock] || 1) > lvl,
    }));
  }, [profile?.belt]);

  const beltMax = { white: 25, blue: 35, purple: 45, brown: 55, black: 65 }[profile?.belt] || 25;

  // Type distribution counts
  const typeCounts = useMemo(() => {
    const counts = { submission: 0, sweep: 0, transition: 0, takedown: 0, escape: 0 };
    for (const m of deckMoves) { if (counts[m.type] !== undefined) counts[m.type]++; }
    return counts;
  }, [deckMoves]);

  const tierCounts = useMemo(() => {
    const counts = { drilled: 0, trained: 0, known: 0, mastered: 0 };
    for (const m of deckMoves) { if (counts[m.tier] !== undefined) counts[m.tier]++; }
    return counts;
  }, [deckMoves]);

  // Dead end detection: positions reachable via deck moves but with no exit moves
  const deadEnds = useMemo(() => {
    const reachable = new Set();
    const hasExitFrom = new Set();
    for (const m of deckMoves) {
      if (m.from_position) hasExitFrom.add(m.from_position);
      if (m.to_position && m.to_position !== 'tap') reachable.add(m.to_position);
    }
    // Dead end = reachable but no exit
    const ends = [];
    for (const posId of reachable) {
      if (!hasExitFrom.has(posId)) {
        const pos = G.positions?.[posId];
        ends.push({ posId, name: pos?.name || posId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), family: pos?.family || 'other' });
      }
    }
    return ends;
  }, [deckMoves]);

  function getFilteredTechs(techs) {
    let filtered = techs;
    if (filter !== 'all') filtered = filtered.filter(t => t.type === filter);
    if (tab === 'library' && search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(t => (t.name || '').toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q));
    }
    return filtered;
  }

  function groupByFamily(techs) {
    const groups = {};
    for (const t of getFilteredTechs(techs)) {
      const pos = G.positions[t.from_position];
      const family = pos?.family || 'other';
      if (!groups[family]) groups[family] = { positions: {} };
      const posId = t.from_position;
      const posName = pos?.name || 'Unknown';
      if (!groups[family].positions[posId]) groups[family].positions[posId] = { name: posName, techs: [] };
      groups[family].positions[posId].techs.push(t);
    }
    return groups;
  }

  const grouped = useMemo(
    () => groupByFamily(tab === 'deck' ? deckMoves : allTechs),
    [tab, deckMoves, allTechs, filter, search]
  );

  const toggle = (key) => setCollapsed(c => ({ ...c, [key]: !c[key] }));
  const currentArch = ARCHETYPES.find(a => a.id === profile?.archetype) || ARCHETYPES[0];

  async function addToDeck(techId) {
    const { error } = await sb.rpc('add_technique_to_deck', {
      p_player_id: parseInt(profile.id),
      p_technique_id: parseInt(techId),
    });
    if (!error) {
      const { data } = await sb.from('player_move_stacks').select('*, techniques(*)').eq('profile_id', profile.id);
      if (data) setMoves(data);
    }
    setExpandedMove(null);
  }

  async function removeFromDeck(techId) {
    const { error } = await sb.rpc('remove_technique_from_deck', {
      p_player_id: parseInt(profile.id),
      p_technique_id: parseInt(techId),
    });
    if (!error) {
      const { data } = await sb.from('player_move_stacks').select('*, techniques(*)').eq('profile_id', profile.id);
      if (data) setMoves(data);
    }
    setExpandedMove(null);
  }

  async function confirmArchSwitch() {
    if (!pendingArch || switchingArch) return;
    setSwitchingArch(true);
    const { error } = await sb.from('profiles').update({ archetype: pendingArch }).eq('id', profile.id);
    if (!error) {
      const { data: fresh } = await sb.from('profiles').select('*').eq('id', profile.id).single();
      if (fresh && onProfileUpdate) onProfileUpdate(fresh);
    }
    setSwitchingArch(false);
    setShowArchPicker(false);
    setPendingArch(null);
  }

  return (
    <div style={{ padding: '20px 16px' }}>
      {/* Archetype bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 14px', background: '#FFFFFF', border: `1px solid ${T.border}`,
        borderRadius: 10, marginBottom: 14, boxShadow: T.shadowSm,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
          background: `${currentArch.color}10`, border: `1.5px solid ${currentArch.color}25`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <ArchIcon id={currentArch.id} s={20} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: F.display, fontSize: 16, color: T.text }}>{currentArch.name}</div>
          <div style={{ fontFamily: F.mono, fontSize: 8, color: T.dim }}>
            {currentArch.animal} — {currentArch.strength}
          </div>
        </div>
        <button onClick={() => { setShowArchPicker(true); setPendingArch(null); }} style={{
          padding: '5px 12px', fontFamily: F.mono, fontSize: 9, letterSpacing: '0.08em',
          textTransform: 'uppercase', cursor: 'pointer', borderRadius: 6,
          background: '#F9FAFB', border: `1px solid ${T.border}`, color: T.muted,
        }}>Switch</button>
      </div>

      {/* Tab toggle */}
      <div style={{ display: 'flex', marginBottom: 14, border: `1.5px solid ${T.border}`, borderRadius: 8, overflow: 'hidden' }}>
        {[{ key: 'deck', label: 'My Deck' }, { key: 'library', label: 'Library' }].map(v => (
          <button key={v.key} onClick={() => { setTab(v.key); setSearch(''); }} style={{
            flex: 1, padding: '10px', fontFamily: F.mono, fontSize: 10,
            letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer',
            border: 'none', fontWeight: tab === v.key ? 600 : 400,
            background: tab === v.key ? '#111827' : '#FFFFFF',
            color: tab === v.key ? '#FFFFFF' : T.dim,
            transition: 'all 0.15s',
          }}>{v.label}</button>
        ))}
      </div>

      {/* Deck stats bar */}
      {tab === 'deck' && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 14px', background: '#FFFFFF', border: `1px solid ${T.border}`,
          borderRadius: 8, marginBottom: 12, boxShadow: T.shadowSm,
        }}>
          <div style={{ fontFamily: F.display, fontSize: 20, color: T.text }}>
            {deckMoves.length}<span style={{ fontSize: 13, color: T.dim }}>/{beltMax}</span>
          </div>
          <div style={{ flex: 1, display: 'flex', gap: 4, alignItems: 'center' }}>
            {Object.entries(typeCounts).map(([type, count]) => {
              const tc = TYPE_COLORS[type];
              if (!count) return null;
              return (
                <div key={type} style={{
                  flex: count, height: 6, background: tc?.color || T.dim,
                  borderRadius: 3, minWidth: 4,
                }} title={`${tc?.label}: ${count}`} />
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 8, fontFamily: F.mono, fontSize: 9, color: T.dim }}>
            <span><span style={{ color: '#B8860B' }}>{tierCounts.drilled}</span> drilled</span>
            <span><span style={{ color: '#6B7280' }}>{tierCounts.trained}</span> trained</span>
          </div>
          {/* Dead end count */}
          <div style={{
            padding: '3px 8px', borderRadius: 4, fontFamily: F.mono, fontSize: 9, fontWeight: 600,
            background: deadEnds.length > 0 ? T.sub + '10' : T.td + '10',
            color: deadEnds.length > 0 ? T.sub : T.td,
            animation: deadEnds.length > 0 ? 'deadEndPulse 1.5s ease-in-out infinite' : 'none',
          }}>
            {deadEnds.length > 0 ? `${deadEnds.length} gap${deadEnds.length > 1 ? 's' : ''}` : '0 gaps'}
          </div>
        </div>
      )}

      {/* Search bar (library only) */}
      {tab === 'library' && (
        <div style={{ marginBottom: 12 }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search moves..."
            style={{
              width: '100%', padding: '10px 14px',
              background: '#FFFFFF', border: `1.5px solid ${T.border}`,
              borderRadius: 8, fontFamily: F.body, fontSize: 14,
              color: T.text, outline: 'none',
            }}
          />
        </div>
      )}

      {/* Type filters */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, overflowX: 'auto', paddingBottom: 2 }}>
        {TYPE_FILTERS.map(f => {
          const active = filter === f.key;
          const tc = f.key !== 'all' ? TYPE_COLORS[f.key] : null;
          const count = f.key === 'all' ? null : typeCounts[f.key];
          return (
            <button key={f.key} onClick={() => setFilter(f.key)} style={{
              padding: '5px 12px', fontFamily: F.mono, fontSize: 9, letterSpacing: '0.06em',
              cursor: 'pointer', borderRadius: 6, flexShrink: 0, fontWeight: 500,
              background: active ? (tc ? tc.bg : '#111827') : '#F9FAFB',
              border: `1.5px solid ${active ? (tc ? tc.border : '#111827') : '#E5E7EB'}`,
              color: active ? (tc ? tc.dark : '#FFFFFF') : '#9CA3AF',
              transition: 'all 0.15s',
            }}>
              {f.label}
              {count != null && tab === 'deck' && <span style={{ marginLeft: 4, opacity: 0.7 }}>{count}</span>}
            </button>
          );
        })}
      </div>

      {/* Grouped techniques */}
      {FAMILY_ORDER.filter(f => grouped[f]).map(family => {
        const fg = grouped[family];
        const familyKey = `${tab}-${family}`;
        const isCollapsed = collapsed[familyKey];
        const techCount = Object.values(fg.positions).reduce((s, p) => s + p.techs.length, 0);
        const unlockedCount = tab === 'library'
          ? Object.values(fg.positions).reduce((s, p) => s + p.techs.filter(t => !t.locked).length, 0)
          : null;

        return (
          <div key={family} style={{ marginBottom: 6 }}>
            <button onClick={() => toggle(familyKey)} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 14px', background: '#FFFFFF', border: `1px solid ${T.border}`,
              borderRadius: 8, cursor: 'pointer', textAlign: 'left',
              boxShadow: T.shadowSm,
            }}>
              <span style={{ fontFamily: F.display, fontSize: 15, color: T.text, flex: 1 }}>
                {FAMILY_LABELS[family] || family}
              </span>
              {tab === 'library' && unlockedCount != null && (
                <span style={{ fontFamily: F.mono, fontSize: 9, color: T.dim }}>
                  {unlockedCount}/{techCount}
                </span>
              )}
              {tab === 'deck' && (
                <span style={{ fontFamily: F.mono, fontSize: 10, color: T.dim }}>{techCount}</span>
              )}
              <span style={{ fontFamily: F.mono, fontSize: 10, color: T.dim }}>{isCollapsed ? '▸' : '▾'}</span>
            </button>
            {!isCollapsed && (
              <div style={{
                border: `1.5px solid ${T.border}`, borderRadius: 10, overflow: 'hidden',
                marginTop: 4, background: '#FFFFFF',
              }}>
                {Object.entries(fg.positions).map(([posId, posGroup]) => (
                  <div key={posId}>
                    <div style={{
                      fontFamily: F.mono, fontSize: 9, color: T.dim, padding: '8px 16px',
                      letterSpacing: '0.06em', textTransform: 'uppercase',
                      background: '#F9FAFB', borderBottom: '1px solid #F3F4F6',
                    }}>
                      {posGroup.name}
                    </div>
                    {posGroup.techs.map((t, i) => {
                      const techId = t.technique_id || t.id;
                      const isIn = tab === 'deck' || deckTechIds.has(t.id || t.technique_id);
                      return (
                        <RowCard
                          key={techId || i}
                          move={t}
                          type={t.type}
                          tier={t.tier || 'known'}
                          gp={GP_COSTS[t.type] || 1}
                          isInDeck={isIn}
                          locked={t.locked}
                          onClick={() => setExpandedMove({ ...t, techId })}
                          belt={profile?.belt}
                          playerArchetype={profile?.archetype}
                          timesUsed={t.times_used}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {grouped['other'] && (
        <div style={{ marginBottom: 6 }}>
          <div style={{
            padding: '10px 14px', fontFamily: F.display, fontSize: 15,
            color: T.text, background: '#FFFFFF', border: `1px solid ${T.border}`,
            borderRadius: 8, boxShadow: T.shadowSm,
          }}>Other</div>
          <div style={{ border: `1.5px solid ${T.border}`, borderRadius: 10, overflow: 'hidden', marginTop: 4, background: '#FFFFFF' }}>
            {Object.entries(grouped['other'].positions).map(([posId, posGroup]) => (
              <div key={posId}>
                <div style={{ fontFamily: F.mono, fontSize: 9, color: T.dim, padding: '8px 16px', background: '#F9FAFB', borderBottom: '1px solid #F3F4F6' }}>{posGroup.name}</div>
                {posGroup.techs.map((t, i) => (
                  <RowCard
                    key={t.technique_id || t.id || i}
                    move={t} type={t.type} tier={t.tier || 'known'}
                    gp={GP_COSTS[t.type] || 1}
                    isInDeck={tab === 'deck' || deckTechIds.has(t.id || t.technique_id)}
                    locked={t.locked}
                    onClick={() => setExpandedMove(t)}
                    belt={profile?.belt}
                    playerArchetype={profile?.archetype}
                    timesUsed={t.times_used}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {Object.keys(grouped).length === 0 && (
        <div style={{ fontFamily: F.body, fontSize: 14, color: T.dim, textAlign: 'center', padding: 40 }}>
          {tab === 'deck' ? 'No moves in deck' : 'No techniques found'}
        </div>
      )}

      {/* ═══ EXPANDED MOVE OVERLAY ═══ */}
      {expandedMove && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 20, animation: 'fadeUp 0.2s ease-out',
        }} onClick={() => setExpandedMove(null)}>
          <div onClick={e => e.stopPropagation()}>
            <FullCard
              move={expandedMove}
              type={expandedMove.type}
              tier={expandedMove.tier || 'known'}
              gp={GP_COSTS[expandedMove.type] || 1}
              locked={expandedMove.locked}
              requiredBelt={expandedMove.belt_unlock}
              isInDeck={deckTechIds.has(expandedMove.id || expandedMove.technique_id)}
              onClose={() => setExpandedMove(null)}
              onAddToDeck={!expandedMove.locked ? () => addToDeck(expandedMove.id || expandedMove.technique_id) : undefined}
              onRemoveFromDeck={() => removeFromDeck(expandedMove.id || expandedMove.technique_id)}
              belt={profile?.belt}
              playerArchetype={profile?.archetype}
              timesUsed={expandedMove.times_used}
            />
          </div>
        </div>
      )}

      {/* ═══ ARCHETYPE PICKER OVERLAY ═══ */}
      {showArchPicker && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(248,248,251,0.97)',
          display: 'flex', flexDirection: 'column',
          animation: 'fadeUp 0.2s ease-out',
        }}>
          <div style={{ padding: '18px 20px 10px', borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
            <div style={{ fontFamily: F.display, fontSize: 24, color: T.text }}>Switch Archetype</div>
            <div style={{ fontFamily: F.mono, fontSize: 9, color: T.dim, marginTop: 4 }}>
              Your deck stays the same. Mastery bonuses change.
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>
            {ARCHETYPES.map(a => {
              const isCurrent = a.id === profile?.archetype;
              const isPending = a.id === pendingArch;
              return (
                <div key={a.id} onClick={() => !isCurrent && setPendingArch(a.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '14px', marginBottom: 6, borderRadius: 10, cursor: isCurrent ? 'default' : 'pointer',
                  background: isPending ? `${a.color}08` : '#FFFFFF',
                  border: `1.5px solid ${isPending ? a.color : isCurrent ? `${a.color}30` : T.border}`,
                  transition: 'all 0.15s', boxShadow: T.shadowSm,
                }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                    background: `${a.color}10`, border: `1.5px solid ${a.color}20`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <ArchIcon id={a.id} s={22} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontFamily: F.display, fontSize: 17, color: T.text }}>
                        {a.name}
                      </span>
                      <span style={{ fontFamily: F.mono, fontSize: 9, color: T.dim }}>
                        {a.animal}
                      </span>
                      {isCurrent && (
                        <span style={{ fontFamily: F.mono, fontSize: 7, color: a.color, background: `${a.color}12`, padding: '1px 6px', borderRadius: 3, letterSpacing: '0.08em' }}>
                          CURRENT
                        </span>
                      )}
                    </div>
                    <div style={{ fontFamily: F.mono, fontSize: 9, color: T.dim, marginTop: 2 }}>
                      {a.strength} · {a.weakness}
                    </div>
                    <div style={{ fontFamily: F.body, fontSize: 11, color: T.muted, marginTop: 2 }}>{a.desc}</div>
                  </div>
                  {isPending && (
                    <div style={{ width: 20, height: 20, borderRadius: '50%', background: a.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svg viewBox="0 0 12 12" width={10} height={10}><path d="M2 6L5 9L10 3" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ flexShrink: 0, padding: '12px 20px 28px', borderTop: `1px solid ${T.border}`, display: 'flex', gap: 8, background: T.bg }}>
            <button onClick={() => { setShowArchPicker(false); setPendingArch(null); }} style={{
              flex: 1, padding: '12px', fontFamily: F.mono, fontSize: 10, letterSpacing: '0.1em',
              textTransform: 'uppercase', cursor: 'pointer', borderRadius: 8,
              background: '#FFFFFF', border: `1.5px solid ${T.border}`, color: T.muted,
            }}>Cancel</button>
            <button onClick={confirmArchSwitch} disabled={!pendingArch || switchingArch} style={{
              flex: 1, padding: '12px', fontFamily: F.mono, fontSize: 10, letterSpacing: '0.1em',
              textTransform: 'uppercase', cursor: pendingArch ? 'pointer' : 'default', borderRadius: 8,
              background: pendingArch ? '#111827' : '#F3F4F6', border: 'none',
              color: pendingArch ? '#fff' : T.dim,
              opacity: switchingArch ? 0.5 : 1,
            }}>{switchingArch ? '...' : 'Confirm Switch'}</button>
          </div>
        </div>
      )}
    </div>
  );
}

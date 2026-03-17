// ═══════════════════════════════════════════════════════════
// OPEN MAT — GAME PLAN SCREEN (LIGHT MODE)
// Pre-match: scout opponent, pick drilled moves
// ═══════════════════════════════════════════════════════════

import React, { useState, useEffect, useMemo } from 'react';
import { T, ArchColors, MTColors, TierDisplay, ARCHETYPE_ANIMALS } from '../lib/tokens';
import { ArchIcon, MoveIcon } from '../lib/icons';
import { Btn } from '../components/UI';
import { sb } from '../lib/supabase';

const F = { display: T.display, mono: T.mono, body: T.body };
const GP_COSTS = { submission: 3, sweep: 2, takedown: 2, transition: 1, escape: 1, counter: 0 };

function fmtPosition(pos) {
  if (!pos) return "Unknown Position";
  return pos.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

export default function GamePlanScreen({ profile, matchId, opponent: oppProp, onReady }) {
  const [match, setMatch] = useState(null);
  const [opponent, setOpponent] = useState(oppProp || null);
  const [moves, setMoves] = useState([]);
  const [drilled, setDrilled] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState({});

  const maxDrills = { white: 3, blue: 4, purple: 5, brown: 5, black: 5 }[profile?.belt] || 3;

  useEffect(() => {
    if (!matchId || !profile) return;
    sb.from("matches").select("*").eq("id", matchId).single().then(({ data }) => {
      if (data) {
        setMatch(data);
        if (!oppProp) {
          const oppId = data.player1_id === profile.id ? data.player2_id : data.player1_id;
          sb.from("profiles").select("*").eq("id", oppId).single().then(({ data: o }) => o && setOpponent(o));
        }
      }
    });
    sb.from("player_move_stacks").select("*, techniques(*)").eq("profile_id", profile.id)
      .then(({ data }) => data && setMoves(data.map(m => ({ ...m, ...(m.techniques || {}) }))));
  }, [matchId, profile]);

  const positionGroups = useMemo(() => {
    const groups = {};
    for (const m of moves) {
      const pos = m.from_position || "unknown";
      if (!groups[pos]) groups[pos] = [];
      groups[pos].push(m);
    }
    const entries = Object.entries(groups);
    entries.sort(([posA, movesA], [posB, movesB]) => {
      const aHasDrill = movesA.some(m => drilled.includes(m.technique_id || m.id));
      const bHasDrill = movesB.some(m => drilled.includes(m.technique_id || m.id));
      if (aHasDrill && !bHasDrill) return -1;
      if (!aHasDrill && bHasDrill) return 1;
      return fmtPosition(posA).localeCompare(fmtPosition(posB));
    });
    return entries;
  }, [moves, drilled]);

  useEffect(() => {
    const autoExpand = {};
    for (const [pos, posMoves] of positionGroups) {
      if (posMoves.some(m => drilled.includes(m.technique_id || m.id))) autoExpand[pos] = true;
    }
    setExpanded(prev => ({ ...prev, ...autoExpand }));
  }, [drilled, positionGroups]);

  const toggleExpand = (pos) => setExpanded(prev => ({ ...prev, [pos]: !prev[pos] }));
  const toggleDrill = (techId) => {
    if (drilled.includes(techId)) setDrilled(d => d.filter(x => x !== techId));
    else if (drilled.length < maxDrills) setDrilled(d => [...d, techId]);
  };

  const handleReady = async () => {
    setSaving(true); setError(null);
    try {
      const { error: rpcError } = await sb.rpc("set_drilled_moves", { p_match_id: matchId, p_moves: drilled });
      if (rpcError) throw rpcError;
      onReady && onReady(drilled);
    } catch (e) { console.error("Set drills error:", e); setError("Failed to save drills — try again."); }
    setSaving(false);
  };

  const oppAnimal = opponent ? ARCHETYPE_ANIMALS[opponent.archetype] || '' : '';

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", animation: "fadeUp 0.3s ease-out", background: T.bg }}>
      <div style={{ flex: 1, padding: "20px 20px 100px", overflowY: "auto" }}>
        <div style={{ fontFamily: F.display, fontSize: 24, color: T.text, marginBottom: 16 }}>Game Plan</div>

        {opponent && (
          <div style={{ padding: "14px", background: `${T.blue}06`, border: `1px solid ${T.blue}15`, borderRadius: 10, marginBottom: 16 }}>
            <div style={{ fontFamily: F.mono, fontSize: 9, color: T.blue, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Opponent</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 40, height: 40, borderRadius: "50%", background: `${ArchColors[opponent.archetype] || T.muted}08`, border: `1px solid ${ArchColors[opponent.archetype] || T.muted}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <ArchIcon id={opponent.archetype} s={24}/>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: F.display, fontSize: 18, color: T.text }}>{(opponent.display_name || opponent.username || "Opponent")}</div>
                <div style={{ fontFamily: F.mono, fontSize: 10, color: ArchColors[opponent.archetype] || T.muted }}>
                  {oppAnimal && `${oppAnimal} · `}{(opponent.archetype || "").replace(/_/g, " ")} · {opponent.elo || 1200} Elo
                </div>
              </div>
            </div>
          </div>
        )}

        <div style={{ fontFamily: F.mono, fontSize: 11, color: T.muted, marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
          <span>{moves.length} moves across {positionGroups.length} positions</span>
          <span style={{ color: T.dim }}>·</span>
          <span style={{ color: drilled.length >= maxDrills ? T.gold : T.muted }}>
            {drilled.length}/{maxDrills} drill slots used
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {positionGroups.map(([pos, posMoves]) => {
            const isOpen = !!expanded[pos];
            const hasDrilled = posMoves.some(m => drilled.includes(m.technique_id || m.id));
            const drilledCount = posMoves.filter(m => drilled.includes(m.technique_id || m.id)).length;

            return (
              <div key={pos} style={{ border: `1px solid ${hasDrilled ? T.gold + '20' : T.border}`, borderRadius: 10, overflow: "hidden", background: '#FFFFFF', boxShadow: T.shadowSm }}>
                <button onClick={() => toggleExpand(pos)} style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 10,
                  padding: "12px 14px", background: "transparent", border: "none",
                  cursor: "pointer", textAlign: "left",
                }}>
                  <span style={{ fontFamily: F.mono, fontSize: 11, color: T.dim, width: 14, textAlign: "center" }}>
                    {isOpen ? "\u25BC" : "\u25B6"}
                  </span>
                  <span style={{ fontFamily: F.display, fontSize: 14, color: hasDrilled ? T.gold : T.text, flex: 1 }}>
                    {fmtPosition(pos)}
                  </span>
                  {drilledCount > 0 && (
                    <span style={{ fontFamily: F.mono, fontSize: 9, color: T.gold, background: `${T.gold}10`, padding: "2px 6px", borderRadius: 4 }}>
                      {drilledCount} drilled
                    </span>
                  )}
                  <span style={{ fontFamily: F.mono, fontSize: 9, color: T.dim }}>
                    {posMoves.length} {posMoves.length === 1 ? "move" : "moves"}
                  </span>
                </button>

                {isOpen && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 1, borderTop: `1px solid ${T.border}` }}>
                    {posMoves.map(m => {
                      const techId = m.technique_id || m.id;
                      const isDrilled = drilled.includes(techId);
                      const tc = MTColors[m.type] || T.muted;
                      const tier = m.tier || "trained";
                      const td = TierDisplay[tier] || TierDisplay.trained;
                      const gpCost = m.gp_cost || GP_COSTS[m.type] || 1;
                      const atMax = !isDrilled && drilled.length >= maxDrills;

                      return (
                        <button key={techId} onClick={() => toggleDrill(techId)} style={{
                          display: "flex", alignItems: "center", gap: 10,
                          padding: "10px 14px 10px 38px",
                          background: isDrilled ? `${T.gold}06` : "transparent",
                          border: "none", borderBottom: `1px solid ${T.borderLight || '#F3F4F6'}`,
                          cursor: atMax ? "default" : "pointer",
                          textAlign: "left", opacity: atMax ? 0.4 : 1,
                          transition: "background 0.15s",
                        }}>
                          <span style={{ fontFamily: F.mono, fontSize: 13, color: T.gold, width: 16, textAlign: "center" }}>
                            {isDrilled ? "\u2605" : ""}
                          </span>
                          <MoveIcon type={m.type} size={14}/>
                          <span style={{ fontFamily: F.display, fontSize: 13, color: isDrilled ? T.text : T.muted, flex: 1 }}>
                            {m.name}
                          </span>
                          <span style={{ fontFamily: F.mono, fontSize: 9, color: td.c, marginRight: 6 }}>{td.sym}</span>
                          <span style={{ fontFamily: F.mono, fontSize: 9, color: tc, minWidth: 30, textAlign: "center" }}>
                            {(m.type || "").slice(0, 3).toUpperCase()}
                          </span>
                          <span style={{ fontFamily: F.mono, fontSize: 10, color: T.dim, minWidth: 20, textAlign: "right" }}>{gpCost}gp</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {error && (
          <div style={{ padding: "10px 12px", background: `${T.red}08`, border: `1px solid ${T.red}20`, borderRadius: 8, marginTop: 12, fontFamily: F.mono, fontSize: 10, color: T.red }}>{error}</div>
        )}
      </div>

      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        padding: "14px 20px", paddingBottom: "calc(14px + env(safe-area-inset-bottom, 0px))",
        background: T.bg, borderTop: `1px solid ${T.border}`,
      }}>
        <Btn full variant="primary" onClick={handleReady} disabled={saving}>
          {saving ? "Saving..." : "Ready \u2014 Start Match"}
        </Btn>
      </div>
    </div>
  );
}

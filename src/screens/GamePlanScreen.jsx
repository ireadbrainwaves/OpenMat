// ═══════════════════════════════════════════════════════════
// OPEN MAT — GAME PLAN SCREEN
// Pre-match: scout opponent, pick drilled moves
// Moves grouped by from_position with collapsible sections
// ═══════════════════════════════════════════════════════════

import React, { useState, useEffect, useMemo } from 'react';
import { T, ArchColors, MTColors, TierDisplay } from '../lib/tokens';
import { ArchIcon, MoveIcon } from '../lib/icons';
import { Btn } from '../components/UI';
import { sb } from '../lib/supabase';

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

  // Group moves by from_position, sorted: sections with drilled moves first, then alphabetical
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

  // Auto-expand sections that contain drilled moves
  useEffect(() => {
    const autoExpand = {};
    for (const [pos, posMoves] of positionGroups) {
      if (posMoves.some(m => drilled.includes(m.technique_id || m.id))) {
        autoExpand[pos] = true;
      }
    }
    setExpanded(prev => ({ ...prev, ...autoExpand }));
  }, [drilled, positionGroups]);

  const uniquePositions = positionGroups.length;

  const toggleExpand = (pos) => {
    setExpanded(prev => ({ ...prev, [pos]: !prev[pos] }));
  };

  const toggleDrill = (techId) => {
    if (drilled.includes(techId)) {
      setDrilled(d => d.filter(x => x !== techId));
    } else if (drilled.length < maxDrills) {
      setDrilled(d => [...d, techId]);
    }
  };

  const handleReady = async () => {
    setSaving(true);
    setError(null);
    try {
      console.log('drill params:', { matchId, drilled });
      const { error: rpcError } = await sb.rpc("set_drilled_moves", { p_match_id: matchId, p_moves: drilled });
      if (rpcError) throw rpcError;
      onReady && onReady(drilled);
    } catch (e) {
      console.error("Set drills error:", e);
      setError("Failed to save drills — try again.");
    }
    setSaving(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", animation: "fadeUp 0.3s ease-out" }}>
      <div style={{ flex: 1, padding: "20px 20px 100px", overflowY: "auto" }}>
        <div style={{ fontFamily: T.display, fontSize: 24, color: T.white, letterSpacing: "0.06em", marginBottom: 16 }}>Game Plan</div>

        {/* Opponent scout */}
        {opponent && (
          <div style={{ padding: "14px", background: `${T.opp}08`, border: `1px solid ${T.opp}20`, borderRadius: 6, marginBottom: 16 }}>
            <div style={{ fontFamily: T.mono, fontSize: 9, color: T.opp, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>Opponent</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 40, height: 40, borderRadius: "50%", background: `${ArchColors[opponent.archetype] || T.muted}12`, border: `1px solid ${ArchColors[opponent.archetype] || T.muted}25`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <ArchIcon id={opponent.archetype} s={24}/>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: T.display, fontSize: 18, color: T.white }}>{(opponent.display_name || opponent.username || "Opponent").toUpperCase()}</div>
                <div style={{ fontFamily: T.mono, fontSize: 10, color: ArchColors[opponent.archetype] || T.muted }}>
                  {(opponent.archetype || "").replace("_", " ")} · {opponent.elo || 1200} Elo
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Summary bar */}
        <div style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
          <span>{moves.length} moves across {uniquePositions} positions</span>
          <span style={{ color: T.dim }}>·</span>
          <span style={{ color: drilled.length >= maxDrills ? T.gold : T.muted }}>
            {drilled.length}/{maxDrills} drill slots used
          </span>
        </div>

        {/* Position groups */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {positionGroups.map(([pos, posMoves]) => {
            const isOpen = !!expanded[pos];
            const hasDrilled = posMoves.some(m => drilled.includes(m.technique_id || m.id));
            const drilledCount = posMoves.filter(m => drilled.includes(m.technique_id || m.id)).length;

            return (
              <div key={pos} style={{ border: `1px solid ${hasDrilled ? T.gold + "25" : T.border}`, borderRadius: 6, overflow: "hidden", background: T.surface }}>
                {/* Section header */}
                <button
                  onClick={() => toggleExpand(pos)}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 10,
                    padding: "12px 14px", background: "transparent", border: "none",
                    cursor: "pointer", textAlign: "left",
                  }}
                >
                  <span style={{ fontFamily: T.mono, fontSize: 11, color: T.dim, width: 14, textAlign: "center" }}>
                    {isOpen ? "\u25BC" : "\u25B6"}
                  </span>
                  <span style={{ fontFamily: T.mono, fontSize: 12, color: hasDrilled ? T.gold : T.white, flex: 1, letterSpacing: "0.02em" }}>
                    {fmtPosition(pos)}
                  </span>
                  {drilledCount > 0 && (
                    <span style={{ fontFamily: T.mono, fontSize: 9, color: T.gold, background: `${T.gold}15`, padding: "2px 6px", borderRadius: 3 }}>
                      {drilledCount} drilled
                    </span>
                  )}
                  <span style={{ fontFamily: T.mono, fontSize: 9, color: T.dim }}>
                    {posMoves.length} {posMoves.length === 1 ? "move" : "moves"}
                  </span>
                </button>

                {/* Expanded move list */}
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
                        <button
                          key={techId}
                          onClick={() => toggleDrill(techId)}
                          style={{
                            display: "flex", alignItems: "center", gap: 10,
                            padding: "10px 14px 10px 38px",
                            background: isDrilled ? `${T.gold}08` : "transparent",
                            border: "none", borderBottom: `1px solid ${T.border}`,
                            cursor: atMax ? "default" : "pointer",
                            textAlign: "left", opacity: atMax ? 0.4 : 1,
                            transition: "background 0.15s",
                          }}
                        >
                          <span style={{ fontFamily: T.mono, fontSize: 13, color: T.gold, width: 16, textAlign: "center" }}>
                            {isDrilled ? "\u2605" : ""}
                          </span>
                          <MoveIcon type={m.type} size={14}/>
                          <span style={{ fontFamily: T.mono, fontSize: 11, color: isDrilled ? T.white : T.muted, flex: 1 }}>
                            {m.name}
                          </span>
                          <span style={{ fontFamily: T.mono, fontSize: 9, color: td.c, marginRight: 6 }}>
                            {td.sym}
                          </span>
                          <span style={{ fontFamily: T.mono, fontSize: 9, color: tc, minWidth: 30, textAlign: "center" }}>
                            {(m.type || "").slice(0, 3).toUpperCase()}
                          </span>
                          <span style={{ fontFamily: T.mono, fontSize: 10, color: T.dim, minWidth: 20, textAlign: "right" }}>
                            {gpCost}gp
                          </span>
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
          <div style={{ padding: "10px 12px", background: `${T.red}10`, border: `1px solid ${T.red}30`, borderRadius: 4, marginTop: 12, fontFamily: T.mono, fontSize: 10, color: T.red }}>
            {error}
          </div>
        )}
      </div>

      {/* Fixed bottom button */}
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

// ═══════════════════════════════════════════════════════════
// OPEN MAT — GAME PLAN SCREEN
// Pre-match: scout opponent, pick drilled moves
// ═══════════════════════════════════════════════════════════

import React, { useState, useEffect } from 'react';
import { T, ArchColors, MTColors } from '../lib/tokens';
import { ArchIcon, MoveIcon } from '../lib/icons';
import { Btn } from '../components/UI';
import { sb } from '../lib/supabase';

export default function GamePlanScreen({ profile, matchId, opponent: oppProp, onReady }) {
  const [match, setMatch] = useState(null);
  const [opponent, setOpponent] = useState(oppProp || null);
  const [moves, setMoves] = useState([]);
  const [drilled, setDrilled] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const maxDrills = { white: 3, blue: 4, purple: 5, brown: 5, black: 5 }[profile?.belt] || 3;

  useEffect(() => {
    if (!matchId || !profile) return;
    // Load match data
    sb.from("matches").select("*").eq("id", matchId).single().then(({ data }) => {
      if (data) {
        setMatch(data);
        // Load opponent if not passed as prop
        if (!oppProp) {
          const oppId = data.player1_id === profile.id ? data.player2_id : data.player1_id;
          sb.from("profiles").select("*").eq("id", oppId).single().then(({ data: o }) => o && setOpponent(o));
        }
      }
    });
    // Load player's moves for drill selection
    sb.from("player_move_stacks").select("*, techniques(*)").eq("profile_id", profile.id)
      .then(({ data }) => data && setMoves(data.map(m => ({ ...m, ...(m.techniques || {}) }))));
  }, [matchId, profile]);

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
    <div style={{ padding: "20px", animation: "fadeUp 0.3s ease-out" }}>
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

      {/* Drill slots */}
      <div style={{ fontFamily: T.mono, fontSize: 10, color: T.dim, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>
        Drilled Moves ({drilled.length}/{maxDrills} slots)
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
        {moves.map(m => {
          const isDrilled = drilled.includes(m.technique_id || m.id);
          const tc = MTColors[m.type] || T.muted;
          return (
            <button key={m.technique_id || m.id} onClick={() => toggleDrill(m.technique_id || m.id)} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
              background: isDrilled ? `${T.gold}08` : T.surface,
              border: `1px solid ${isDrilled ? T.gold + "30" : T.border}`,
              borderRadius: 4, cursor: "pointer", textAlign: "left",
            }}>
              {isDrilled && <span style={{ fontFamily: T.mono, fontSize: 13, color: T.gold }}>★</span>}
              <MoveIcon type={m.type} size={14}/>
              <span style={{ fontFamily: T.mono, fontSize: 11, color: isDrilled ? T.white : T.muted, flex: 1 }}>{m.name}</span>
              <span style={{ fontFamily: T.mono, fontSize: 9, color: tc }}>{(m.type || "").slice(0, 3).toUpperCase()}</span>
            </button>
          );
        })}
      </div>

      {error && <div style={{ padding: "10px 12px", background: `${T.red}10`, border: `1px solid ${T.red}30`, borderRadius: 4, marginBottom: 12, fontFamily: T.mono, fontSize: 10, color: T.red }}>{error}</div>}

      <Btn full variant="primary" onClick={handleReady} disabled={saving}>
        {saving ? "Saving..." : "Ready — Start Match"}
      </Btn>
    </div>
  );
}

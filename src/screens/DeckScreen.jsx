// ═══════════════════════════════════════════════════════════
// OPEN MAT — DECK SCREEN
// My Deck / Library tabs with real Supabase data
// ═══════════════════════════════════════════════════════════

import React, { useState, useEffect } from 'react';
import { T, MTColors, TierDisplay } from '../lib/tokens';
import { MoveIcon } from '../lib/icons';
import { sb } from '../lib/supabase';

export default function DeckScreen({ profile }) {
  const [tab, setTab] = useState("deck");
  const [filter, setFilter] = useState("all");
  const [moves, setMoves] = useState([]);
  const [library, setLibrary] = useState([]);

  useEffect(() => {
    if (!profile) return;
    // Load player's deck
    sb.from("player_move_stacks").select("*, techniques(*)").eq("profile_id", profile.id)
      .then(({ data }) => data && setMoves(data));
    // Load full technique library
    sb.from("techniques").select("*").order("belt_unlock").order("type").order("name")
      .then(({ data }) => data && setLibrary(data));
  }, [profile]);

  const types = ["all", "submission", "sweep", "transition", "escape", "takedown"];
  const deckMoves = moves.map(m => ({
    ...m, ...(m.techniques || {}),
    tier: m.times_used >= 25 ? "mastered" : m.times_used >= 5 ? "trained" : "known",
  }));
  const filtered = filter === "all" ? deckMoves : deckMoves.filter(m => m.type === filter);

  // Deck stats
  const drilled = deckMoves.filter(m => (profile?.drilled_moves || []).includes(m.technique_id)).length;
  const trained = deckMoves.filter(m => m.tier === "trained" || m.tier === "mastered").length;
  const known = deckMoves.length - trained;
  const beltMax = { white: 25, blue: 35, purple: 45, brown: 55, black: 65 }[profile?.belt] || 25;

  return (
    <div style={{ padding: "20px", animation: "fadeUp 0.3s ease-out" }}>
      {/* Tabs */}
      <div style={{ display: "flex", marginBottom: 14, border: `1px solid ${T.border}`, borderRadius: 4, overflow: "hidden" }}>
        {["deck", "library"].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: "9px", fontFamily: T.mono, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", cursor: "pointer", border: "none", background: tab === t ? T.surface2 : "transparent", color: tab === t ? T.you : T.dim }}>{t === "deck" ? "My Deck" : "Library"}</button>
        ))}
      </div>

      {/* Deck stats */}
      <div style={{ display: "flex", gap: 12, padding: "10px 12px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 4, marginBottom: 12, fontFamily: T.mono, fontSize: 10 }}>
        <div style={{ textAlign: "center" }}><div style={{ color: T.white, fontWeight: 600, fontSize: 16 }}>{deckMoves.length}</div><div style={{ color: T.dim, fontSize: 9 }}>Total</div></div>
        <div style={{ width: 1, background: T.border }}/>
        <div style={{ textAlign: "center" }}><div style={{ color: T.gold, fontWeight: 600 }}>{drilled}</div><div style={{ color: T.dim, fontSize: 9 }}>Drilled</div></div>
        <div style={{ textAlign: "center" }}><div style={{ color: T.muted, fontWeight: 600 }}>{trained}</div><div style={{ color: T.dim, fontSize: 9 }}>Trained</div></div>
        <div style={{ textAlign: "center" }}><div style={{ color: T.dim, fontWeight: 600 }}>{known}</div><div style={{ color: T.dim, fontSize: 9 }}>Known</div></div>
        <div style={{ marginLeft: "auto", textAlign: "right" }}><div style={{ color: T.text, fontSize: 11 }}>{deckMoves.length}/{beltMax}</div><div style={{ color: T.dim, fontSize: 9 }}>{profile?.belt} max</div></div>
      </div>

      {/* Type filters */}
      <div style={{ display: "flex", gap: 4, marginBottom: 12, overflowX: "auto" }}>
        {types.map(t => {
          const c = MTColors[t] || T.muted;
          return (
            <button key={t} onClick={() => setFilter(t)} style={{
              padding: "5px 10px", fontFamily: T.mono, fontSize: 9, letterSpacing: "0.08em",
              textTransform: "uppercase", cursor: "pointer", borderRadius: 2, flexShrink: 0,
              background: filter === t ? `${c}12` : "transparent",
              border: `1px solid ${filter === t ? c : T.border}`,
              color: filter === t ? c : T.dim,
            }}>{t === "all" ? "All" : t.slice(0, 3)}</button>
          );
        })}
      </div>

      {/* Move list */}
      {tab === "deck" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {filtered.length === 0 && <div style={{ fontFamily: T.mono, fontSize: 11, color: T.dim, textAlign: "center", padding: 20 }}>No moves in deck yet</div>}
          {filtered.map((m, i) => {
            const tc = MTColors[m.type] || T.muted;
            const ti = TierDisplay[m.tier] || TierDisplay.known;
            return (
              <div key={m.technique_id || i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 4 }}>
                <MoveIcon type={m.type} size={16}/>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: T.mono, fontSize: 11, color: T.text }}>{m.name}</div>
                  <div style={{ fontFamily: T.mono, fontSize: 9, color: T.dim }}>{m.from || "—"}</div>
                </div>
                <span style={{ fontFamily: T.mono, fontSize: 11, color: ti.c }}>{ti.sym}</span>
                <span style={{ fontFamily: T.mono, fontSize: 9, color: tc, textTransform: "uppercase" }}>{(m.type || "").slice(0, 3)}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Library */}
      {tab === "library" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {library.filter(t => filter === "all" || t.type === filter).slice(0, 30).map((t, i) => {
            const inDeck = moves.some(m => m.technique_id === t.id);
            const tc = MTColors[t.type] || T.muted;
            return (
              <div key={t.id || i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: inDeck ? `${T.green}06` : T.surface, border: `1px solid ${inDeck ? T.green + "20" : T.border}`, borderRadius: 4, opacity: inDeck ? 1 : 0.7 }}>
                <MoveIcon type={t.type} size={16}/>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: T.mono, fontSize: 11, color: T.text }}>{t.name}</div>
                  <div style={{ fontFamily: T.mono, fontSize: 9, color: T.dim }}>{t.from} → {t.to || "finish"}</div>
                </div>
                <span style={{ fontFamily: T.mono, fontSize: 9, color: tc, textTransform: "uppercase" }}>{t.type?.slice(0, 3)}</span>
                {inDeck && <span style={{ fontFamily: T.mono, fontSize: 9, color: T.green }}>IN DECK</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

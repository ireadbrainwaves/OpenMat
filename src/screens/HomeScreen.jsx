// ═══════════════════════════════════════════════════════════
// OPEN MAT — HOME SCREEN
// Hero card, belt progress, CTAs, recent matches
// Loads real data from Supabase profile + match history
// ═══════════════════════════════════════════════════════════

import React, { useState, useEffect } from 'react';
import { T, ArchColors, BeltColors } from '../lib/tokens';
import { ArchIcon } from '../lib/icons';
import { Bar } from '../components/UI';
import { sb } from '../lib/supabase';

export default function HomeScreen({ user, profile, onNavigate }) {
  const [matches, setMatches] = useState([]);

  useEffect(() => {
    if (!user) return;
    // Load recent matches
    sb.from("matches")
      .select("*, match_turns(*)")
      .or(`player1_id.eq.${user.id},player2_id.eq.${user.id}`)
      .not("winner_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(5)
      .then(({ data }) => data && setMatches(data));
  }, [user]);

  if (!profile) return null;

  const beltPct = profile.belt === "white" ? 25 : profile.belt === "blue" ? 62 : profile.belt === "purple" ? 40 : 80;
  const nextBelt = { white: "Blue", blue: "Purple", purple: "Brown", brown: "Black", black: "MAX" }[profile.belt];

  return (
    <div style={{ padding: "20px", animation: "fadeUp 0.3s ease-out" }}>
      {/* Hero card */}
      <div style={{ padding: "20px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
          <div style={{ width: 52, height: 52, borderRadius: "50%", background: `${ArchColors[profile.archetype] || T.muted}12`, border: `2px solid ${ArchColors[profile.archetype] || T.muted}30`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ArchIcon id={profile.archetype} s={30}/>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: T.display, fontSize: 24, color: T.white, letterSpacing: "0.06em" }}>{(profile.display_name || profile.username || "Player").toUpperCase()}</div>
            <div style={{ fontFamily: T.mono, fontSize: 10, color: ArchColors[profile.archetype] || T.muted, letterSpacing: "0.1em" }}>{(profile.archetype || "").replace("_", " ")}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: T.display, fontSize: 36, color: T.gold, letterSpacing: "0.04em", lineHeight: 1 }}>{profile.elo || 1200}</div>
            <div style={{ fontFamily: T.mono, fontSize: 9, color: T.dim, letterSpacing: "0.1em" }}>ELO</div>
          </div>
        </div>

        {/* Belt */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <div style={{ width: 32, height: 7, background: BeltColors[profile.belt] || BeltColors.white, borderRadius: 2, border: profile.belt === "black" ? `1px solid ${T.dim}` : "none" }}/>
          <span style={{ fontFamily: T.mono, fontSize: 10, color: BeltColors[profile.belt], letterSpacing: "0.1em" }}>{profile.belt} Belt</span>
          <span style={{ fontFamily: T.mono, fontSize: 9, color: T.dim, marginLeft: "auto" }}>{beltPct}% → {nextBelt}</span>
        </div>
        <Bar pct={beltPct} color={BeltColors[profile.belt] || T.muted}/>

        {/* Quick stats */}
        <div style={{ display: "flex", gap: 16, marginTop: 14, fontFamily: T.mono, fontSize: 10 }}>
          {[
            { label: "W-L", value: `${profile.matches_won || 0}-${(profile.matches_played || 0) - (profile.matches_won || 0)}`, color: T.green },
            { label: "Subs", value: `${profile.submissions_earned || 0}`, color: T.red },
            { label: "Matches", value: `${profile.matches_played || 0}`, color: T.muted },
          ].map(s => (
            <div key={s.label} style={{ textAlign: "center" }}>
              <div style={{ color: s.color, fontWeight: 600, fontSize: 13 }}>{s.value}</div>
              <div style={{ color: T.dim, fontSize: 9 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* CTAs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button onClick={() => onNavigate("lobby")} style={{ flex: 1, padding: "16px", background: T.you, border: "none", borderRadius: 4, fontFamily: T.display, fontSize: 18, letterSpacing: "0.1em", color: "#fff", cursor: "pointer" }}>Find Match</button>
        <button onClick={() => onNavigate("lobby")} style={{ flex: 1, padding: "16px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 4, fontFamily: T.display, fontSize: 18, letterSpacing: "0.1em", color: T.muted, cursor: "pointer" }}>Solo Training</button>
      </div>

      {/* Recent matches */}
      {matches.length > 0 && (
        <>
          <div style={{ fontFamily: T.mono, fontSize: 10, color: T.dim, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>Recent Matches</div>
          {matches.slice(0, 3).map((m, i) => {
            const isP1 = m.player1_id === user.id;
            const won = m.winner_id === user.id;
            const method = m.win_method || "points";
            return (
              <div key={m.id || i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 4, marginBottom: 6 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: T.mono, fontSize: 11, color: T.text }}>vs Opponent</div>
                  <div style={{ fontFamily: T.mono, fontSize: 9, color: T.dim }}>{method} · {m.current_turn || "?"}t</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontFamily: T.display, fontSize: 16, color: won ? T.green : T.red }}>{won ? "W" : "L"}</div>
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

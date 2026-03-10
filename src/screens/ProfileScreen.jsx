// ═══════════════════════════════════════════════════════════
// OPEN MAT — PROFILE SCREEN
// Stats, belt progress, career data
// ═══════════════════════════════════════════════════════════

import React, { useState, useEffect } from 'react';
import { T, ArchColors, BeltColors } from '../lib/tokens';
import { ArchIcon } from '../lib/icons';
import { Bar } from '../components/UI';
import { sb } from '../lib/supabase';

export default function ProfileScreen({ user, profile }) {
  const [beltProgress, setBeltProgress] = useState(null);

  useEffect(() => {
    if (!user) return;
    sb.rpc("check_belt_promotion", { p_profile_id: user.id })
      .then(({ data }) => data && setBeltProgress(data));
  }, [user]);

  if (!profile) return null;

  const nextBelt = { white: "Blue", blue: "Purple", purple: "Brown", brown: "Black", black: "MAX" }[profile.belt];

  return (
    <div style={{ padding: "20px", animation: "fadeUp 0.3s ease-out" }}>
      {/* Avatar */}
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <div style={{ display: "inline-flex", width: 64, height: 64, borderRadius: "50%", background: `${ArchColors[profile.archetype] || T.muted}12`, border: `2px solid ${ArchColors[profile.archetype] || T.muted}30`, alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
          <ArchIcon id={profile.archetype} s={36}/>
        </div>
        <div style={{ fontFamily: T.display, fontSize: 28, color: T.white, letterSpacing: "0.06em" }}>{(profile.display_name || profile.username || "Player").toUpperCase()}</div>
        <div style={{ fontFamily: T.mono, fontSize: 10, color: ArchColors[profile.archetype], letterSpacing: "0.1em" }}>
          {(profile.archetype || "").replace("_", " ")} · {profile.belt} Belt · {profile.elo} Elo
        </div>
      </div>

      {/* Belt progress */}
      {nextBelt !== "MAX" && beltProgress && (
        <>
          <div style={{ fontFamily: T.mono, fontSize: 10, color: T.dim, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>Progress to {nextBelt} Belt</div>
          {[
            { label: "Wins", current: profile.matches_won || 0, goal: beltProgress.wins_required || 15 },
            { label: "Matches", current: profile.matches_played || 0, goal: beltProgress.matches_required || 30 },
            { label: "Subs", current: profile.submissions_earned || 0, goal: beltProgress.subs_required || 8 },
          ].map(b => (
            <div key={b.label} style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontFamily: T.mono, fontSize: 9, color: T.dim, marginBottom: 3 }}>
                <span>{b.label}</span><span>{Math.min(b.current, b.goal)}/{b.goal}</span>
              </div>
              <Bar pct={(b.current / b.goal) * 100} color={BeltColors[nextBelt.toLowerCase()] || T.purple}/>
            </div>
          ))}
        </>
      )}

      {/* Career stats */}
      <div style={{ fontFamily: T.mono, fontSize: 10, color: T.dim, letterSpacing: "0.12em", textTransform: "uppercase", marginTop: 16, marginBottom: 8 }}>Career Stats</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        {[
          { label: "Win Rate", value: profile.matches_played ? `${Math.round((profile.matches_won / profile.matches_played) * 100)}%` : "—", color: T.green },
          { label: "Sub Rate", value: profile.matches_won ? `${Math.round((profile.submissions_earned / profile.matches_won) * 100)}%` : "—", color: T.red },
          { label: "Matches", value: `${profile.matches_played || 0}`, color: T.muted },
          { label: "Submissions", value: `${profile.submissions_earned || 0}`, color: T.red },
        ].map(s => (
          <div key={s.label} style={{ padding: "10px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 4, textAlign: "center" }}>
            <div style={{ fontFamily: T.mono, fontSize: 13, color: s.color, fontWeight: 600 }}>{s.value}</div>
            <div style={{ fontFamily: T.mono, fontSize: 9, color: T.dim }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Sign out */}
      <button onClick={() => sb.auth.signOut()} style={{
        width: "100%", marginTop: 24, padding: "12px", background: "transparent",
        border: `1px solid ${T.border}`, borderRadius: 4, fontFamily: T.mono, fontSize: 10,
        color: T.dim, cursor: "pointer", letterSpacing: "0.12em", textTransform: "uppercase",
      }}>Sign Out</button>
    </div>
  );
}

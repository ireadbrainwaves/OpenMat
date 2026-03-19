// ═══════════════════════════════════════════════════════════
// OPEN MAT — PROFILE SCREEN (LIGHT MODE)
// Stats, belt progress, career data
// ═══════════════════════════════════════════════════════════

import React, { useState, useEffect } from 'react';
import { T, ArchColors, BeltColors, ARCHETYPE_ANIMALS } from '../lib/tokens';
import { ArchIcon } from '../lib/icons';
import { Bar } from '../components/UI';
import { sb } from '../lib/supabase';

const F = { display: T.display, mono: T.mono, body: T.body };

export default function ProfileScreen({ user, profile }) {
  const [beltProgress, setBeltProgress] = useState(null);

  useEffect(() => {
    if (!user) return;
    sb.rpc("check_belt_promotion", { p_profile_id: user.id })
      .then(({ data }) => data && setBeltProgress(data));
  }, [user]);

  if (!profile) return null;

  const nextBelt = { white: "Blue", blue: "Purple", purple: "Brown", brown: "Black", black: "MAX" }[profile.belt];
  const archColor = ArchColors[profile.archetype] || T.muted;
  const animal = ARCHETYPE_ANIMALS[profile.archetype] || '';

  return (
    <div style={{ padding: "20px",  }}>
      {/* Avatar */}
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <div style={{
          display: "inline-flex", width: 72, height: 72, borderRadius: "50%",
          background: `${archColor}08`, border: `2px solid ${archColor}20`,
          alignItems: "center", justifyContent: "center", marginBottom: 10,
        }}>
          <ArchIcon id={profile.archetype} s={40}/>
        </div>
        <div style={{ fontFamily: F.display, fontSize: 28, color: T.text }}>
          {(profile.display_name || profile.username || "Player")}
        </div>
        <div style={{ fontFamily: F.mono, fontSize: 10, color: archColor, letterSpacing: "0.08em" }}>
          {animal && `${animal} · `}{(profile.archetype || "").replace(/_/g, " ")} · {profile.belt} belt · {profile.elo} Elo
        </div>
      </div>

      {/* Belt progress */}
      {nextBelt !== "MAX" && beltProgress && (
        <div style={{ padding: "14px", background: '#FFFFFF', border: `1px solid ${T.border}`, borderRadius: 10, marginBottom: 16, boxShadow: T.shadowSm }}>
          <div style={{ fontFamily: F.mono, fontSize: 10, color: T.dim, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
            Progress to {nextBelt} Belt
          </div>
          {[
            { label: "Wins", current: profile.matches_won || 0, goal: beltProgress.wins_required || 15 },
            { label: "Matches", current: profile.matches_played || 0, goal: beltProgress.matches_required || 30 },
            { label: "Subs", current: profile.submissions_earned || 0, goal: beltProgress.subs_required || 8 },
          ].map(b => (
            <div key={b.label} style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontFamily: F.mono, fontSize: 9, color: T.dim, marginBottom: 3 }}>
                <span>{b.label}</span><span>{Math.min(b.current, b.goal)}/{b.goal}</span>
              </div>
              <Bar pct={(b.current / b.goal) * 100} color={BeltColors[nextBelt.toLowerCase()] || T.purple}/>
            </div>
          ))}
        </div>
      )}

      {/* Career stats */}
      <div style={{ fontFamily: F.mono, fontSize: 10, color: T.dim, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Career Stats</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        {[
          { label: "Win Rate", value: profile.matches_played ? `${Math.round((profile.matches_won / profile.matches_played) * 100)}%` : "—", color: T.green },
          { label: "Sub Rate", value: profile.matches_won ? `${Math.round((profile.submissions_earned / profile.matches_won) * 100)}%` : "—", color: T.red },
          { label: "Matches", value: `${profile.matches_played || 0}`, color: T.muted },
          { label: "Submissions", value: `${profile.submissions_earned || 0}`, color: T.red },
        ].map(s => (
          <div key={s.label} style={{ padding: "12px", background: '#FFFFFF', border: `1px solid ${T.border}`, borderRadius: 8, textAlign: "center", boxShadow: T.shadowSm }}>
            <div style={{ fontFamily: F.display, fontSize: 18, color: s.color }}>{s.value}</div>
            <div style={{ fontFamily: F.mono, fontSize: 9, color: T.dim }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Sign out */}
      <button onClick={() => sb.auth.signOut()} style={{
        width: "100%", marginTop: 24, padding: "12px", background: "#FFFFFF",
        border: `1.5px solid ${T.border}`, borderRadius: 8, fontFamily: F.mono, fontSize: 10,
        color: T.muted, cursor: "pointer", letterSpacing: "0.1em", textTransform: "uppercase",
      }}>Sign Out</button>
    </div>
  );
}

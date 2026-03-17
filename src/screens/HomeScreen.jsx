// ═══════════════════════════════════════════════════════════
// OPEN MAT — HOME SCREEN (LIGHT MODE)
// Hero card, belt/stripe progression, CTAs, recent matches
// ═══════════════════════════════════════════════════════════

import React, { useState, useEffect } from 'react';
import { T, ArchColors, BeltColors, ARCHETYPE_ANIMALS } from '../lib/tokens';
import { ArchIcon } from '../lib/icons';
import { Bar } from '../components/UI';
import { sb } from '../lib/supabase';

const F = { display: T.display, mono: T.mono, body: T.body };

const STRIPE_REQUIREMENTS = {
  white: [
    { stripe: 1, wins: 2, subs: 0, label: 'Beat Iron Mike twice' },
    { stripe: 2, wins: 4, subs: 1, label: 'Win 4 matches, land 1 submission' },
    { stripe: 3, wins: 6, subs: 3, label: 'Win 6 matches, land 3 submissions' },
    { stripe: 4, wins: 10, subs: 5, label: 'Win 10 matches, land 5 submissions' },
  ],
  blue: [
    { stripe: 1, wins: 15, subs: 8, label: 'Win 15 matches, land 8 submissions' },
    { stripe: 2, wins: 22, subs: 12, label: 'Win 22 matches, land 12 submissions' },
    { stripe: 3, wins: 30, subs: 18, label: 'Win 30 matches, land 18 submissions' },
    { stripe: 4, wins: 40, subs: 25, label: 'Win 40 matches, land 25 submissions' },
  ],
  purple: [
    { stripe: 1, wins: 55, subs: 35 }, { stripe: 2, wins: 70, subs: 45 },
    { stripe: 3, wins: 90, subs: 60 }, { stripe: 4, wins: 110, subs: 75 },
  ],
  brown: [
    { stripe: 1, wins: 130, subs: 90 }, { stripe: 2, wins: 155, subs: 110 },
    { stripe: 3, wins: 175, subs: 125 }, { stripe: 4, wins: 195, subs: 138 },
  ],
};

const BELT_PROMOTION = {
  white: { nextBelt: 'blue', wins: 12, subs: 6 },
  blue: { nextBelt: 'purple', wins: 50, subs: 30 },
  purple: { nextBelt: 'brown', wins: 120, subs: 80 },
  brown: { nextBelt: 'black', wins: 200, subs: 140 },
};

export default function HomeScreen({ user, profile, onNavigate }) {
  const [matches, setMatches] = useState([]);

  useEffect(() => {
    if (!user) return;
    sb.from("matches").select("*, match_turns(*)").or(`player1_id.eq.${user.id},player2_id.eq.${user.id}`)
      .not("winner_id", "is", null).order("created_at", { ascending: false }).limit(5)
      .then(({ data }) => data && setMatches(data));
  }, [user]);

  if (!profile) return null;

  const currentStripe = profile.belt_stripe || 0;
  const belt = profile.belt || 'white';
  const wins = profile.matches_won || 0;
  const subs = profile.submissions_earned || 0;
  const archColor = ArchColors[profile.archetype] || T.muted;
  const animal = ARCHETYPE_ANIMALS[profile.archetype] || '';

  const stripeReqs = STRIPE_REQUIREMENTS[belt] || [];
  const nextStripeReq = stripeReqs.find(r => r.stripe === currentStripe + 1);
  const beltPromo = BELT_PROMOTION[belt];
  const atMaxStripes = !nextStripeReq;

  let progressTarget, progressWins, progressSubs;
  if (atMaxStripes && beltPromo) {
    progressTarget = `${beltPromo.nextBelt.charAt(0).toUpperCase() + beltPromo.nextBelt.slice(1)} Belt`;
    progressWins = beltPromo.wins; progressSubs = beltPromo.subs;
  } else if (nextStripeReq) {
    progressTarget = `Stripe ${currentStripe + 1}`;
    progressWins = nextStripeReq.wins; progressSubs = nextStripeReq.subs;
  } else { progressTarget = null; }

  const winPct = progressWins ? Math.min(100, Math.round((wins / progressWins) * 100)) : 100;
  const subPct = progressSubs ? Math.min(100, Math.round((subs / progressSubs) * 100)) : 100;
  const overallPct = progressWins ? Math.round(((winPct + subPct) / 2)) : 100;

  return (
    <div style={{ padding: "20px", animation: "fadeUp 0.3s ease-out" }}>
      {/* Hero card */}
      <div style={{ padding: "20px", background: '#FFFFFF', border: `1px solid ${T.border}`, borderRadius: 14, marginBottom: 16, boxShadow: T.shadowMd }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: `${archColor}08`, border: `2px solid ${archColor}20`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ArchIcon id={profile.archetype} s={32}/>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: F.display, fontSize: 24, color: T.text }}>{(profile.display_name || profile.username || "Player")}</div>
            <div style={{ fontFamily: F.mono, fontSize: 10, color: archColor, letterSpacing: "0.08em" }}>
              {animal && `${animal} — `}{(profile.archetype || "").replace(/_/g, " ")}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: F.display, fontSize: 36, color: T.gold, lineHeight: 1 }}>{profile.elo || 1200}</div>
            <div style={{ fontFamily: F.mono, fontSize: 9, color: T.dim, letterSpacing: "0.1em" }}>ELO</div>
          </div>
        </div>

        {/* Belt + stripes */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <BeltStripeDisplay belt={belt} stripes={currentStripe} />
          {progressTarget && (
            <span style={{ fontFamily: F.mono, fontSize: 9, color: T.dim, marginLeft: "auto" }}>{overallPct}% to {progressTarget}</span>
          )}
        </div>
        <Bar pct={overallPct} color={BeltColors[belt] || T.muted}/>

        {/* Quick stats */}
        <div style={{ display: "flex", gap: 16, marginTop: 14, fontFamily: F.mono, fontSize: 10 }}>
          {[
            { label: "W-L", value: `${wins}-${(profile.matches_played || 0) - wins}`, color: T.green },
            { label: "Subs", value: `${subs}`, color: T.red },
            { label: "Matches", value: `${profile.matches_played || 0}`, color: T.muted },
          ].map(s => (
            <div key={s.label} style={{ textAlign: "center" }}>
              <div style={{ color: s.color, fontWeight: 600, fontSize: 14 }}>{s.value}</div>
              <div style={{ color: T.dim, fontSize: 9 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Progression */}
      {progressTarget && (
        <div style={{ padding: "14px", background: '#FFFFFF', border: `1px solid ${T.border}`, borderRadius: 10, marginBottom: 16, boxShadow: T.shadowSm }}>
          <div style={{ fontFamily: F.mono, fontSize: 9, color: T.dim, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
            Next: {progressTarget}
          </div>
          {progressWins > 0 && <ProgressRow label={`Win ${progressWins} bot matches`} current={wins} goal={progressWins} color={T.green} />}
          {progressSubs > 0 && <ProgressRow label={`Land ${progressSubs} submissions`} current={subs} goal={progressSubs} color={T.red} />}
        </div>
      )}

      {/* CTAs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button onClick={() => onNavigate("lobby")} style={{
          flex: 1, padding: "16px", background: '#111827', border: "none", borderRadius: 10,
          fontFamily: F.display, fontSize: 18, color: "#fff", cursor: "pointer",
        }}>Find Match</button>
        <button onClick={() => onNavigate("lobby")} style={{
          flex: 1, padding: "16px", background: '#FFFFFF', border: `1.5px solid ${T.border}`, borderRadius: 10,
          fontFamily: F.display, fontSize: 18, color: T.muted, cursor: "pointer",
        }}>Solo Training</button>
      </div>

      {/* Recent matches */}
      {matches.length > 0 && (
        <>
          <div style={{ fontFamily: F.mono, fontSize: 10, color: T.dim, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Recent Matches</div>
          {matches.slice(0, 3).map((m, i) => {
            const won = m.winner_id === user.id;
            const method = m.win_method || "points";
            return (
              <div key={m.id || i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: '#FFFFFF', border: `1px solid ${T.border}`, borderRadius: 8, marginBottom: 6, boxShadow: T.shadowSm }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: F.display, fontSize: 14, color: T.text }}>vs Opponent</div>
                  <div style={{ fontFamily: F.mono, fontSize: 9, color: T.dim }}>{method} · {m.current_turn || "?"}t</div>
                </div>
                <div style={{ fontFamily: F.display, fontSize: 18, color: won ? T.green : T.red }}>{won ? "W" : "L"}</div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

function BeltStripeDisplay({ belt, stripes }) {
  const beltColor = BeltColors[belt] || '#E8E8E8';
  const stripeColor = belt === 'white' ? '#374151' : '#F0F0F0';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{
        width: 100, height: 16, borderRadius: 4,
        background: beltColor,
        border: belt === 'white' ? '1px solid #D1D5DB' : 'none',
        display: 'flex', alignItems: 'center',
        justifyContent: 'flex-end', paddingRight: 6, gap: 2,
      }}>
        {Array.from({ length: stripes }).map((_, i) => (
          <div key={i} style={{ width: 3, height: 11, background: stripeColor, borderRadius: 1 }} />
        ))}
      </div>
      <span style={{ fontFamily: F.mono, fontSize: 10, color: beltColor === '#E8E8E8' ? T.muted : beltColor, letterSpacing: '0.08em' }}>
        {belt.charAt(0).toUpperCase() + belt.slice(1)}
        {stripes > 0 ? ` · ${stripes}` : ''}
      </span>
    </div>
  );
}

function ProgressRow({ label, current, goal, color }) {
  const done = current >= goal;
  const pct = Math.min(100, Math.round((current / goal) * 100));
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: F.mono, fontSize: 10, marginBottom: 3 }}>
        <span style={{ color: done ? T.green : T.muted }}>{done ? '+ ' : '· '}{label}</span>
        <span style={{ color: done ? T.green : T.dim }}>({current}/{goal})</span>
      </div>
      <div style={{ height: 3, background: T.border, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: done ? T.green : color, borderRadius: 2, transition: 'width 0.3s' }} />
      </div>
    </div>
  );
}

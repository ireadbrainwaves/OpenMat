// ═══════════════════════════════════════════════════════════
// OPEN MAT — POST MATCH SCREEN (Animated)
// Results with character reveal, count-up stats, progress bars,
// confetti on victory, belt progress animation
// ═══════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef } from 'react';
import { T, BeltColors, MTColors, MTLabels } from '../lib/tokens';
import { MoveIcon } from '../lib/icons';
import { Bar, Btn } from '../components/UI';
import { sb, G } from '../lib/supabase';
import { revealText, countUp, confettiBurst } from '../lib/animations';

const F = { display: T.display, mono: T.mono, body: T.body };

const STRIPE_REQUIREMENTS = {
  white: [{ stripe: 1, wins: 2, subs: 0 }, { stripe: 2, wins: 4, subs: 1 }, { stripe: 3, wins: 6, subs: 3 }, { stripe: 4, wins: 10, subs: 5 }],
  blue: [{ stripe: 1, wins: 15, subs: 8 }, { stripe: 2, wins: 22, subs: 12 }, { stripe: 3, wins: 30, subs: 18 }, { stripe: 4, wins: 40, subs: 25 }],
  purple: [{ stripe: 1, wins: 55, subs: 35 }, { stripe: 2, wins: 70, subs: 45 }, { stripe: 3, wins: 90, subs: 60 }, { stripe: 4, wins: 110, subs: 75 }],
  brown: [{ stripe: 1, wins: 130, subs: 90 }, { stripe: 2, wins: 155, subs: 110 }, { stripe: 3, wins: 175, subs: 125 }, { stripe: 4, wins: 195, subs: 138 }],
};

export default function PostMatchScreen({ profile, match, onRematch, onHome }) {
  if (!match) return null;

  const [learnedTech, setLearnedTech] = useState(null);
  const [stripeEarned, setStripeEarned] = useState(null);

  const headlineRef = useRef(null);
  const subNameRef = useRef(null);
  const confettiRef = useRef(null);
  const eloRef = useRef(null);
  const turnRef = useRef(null);
  const myPtsRef = useRef(null);

  const isP1 = match.player1_id === profile?.id;
  const won = match.winner_id === profile?.id;
  const winMethod = match.win_method || match.result_method || match.method || match.finish_method || "points";
  const myPoints = isP1 ? match.player1_points : match.player2_points;
  const oppPoints = isP1 ? match.player2_points : match.player1_points;
  const eloChange = match.elo_change || (won ? 18 : -12);
  const subTech = match.sub_technique_id ? G.techniques[match.sub_technique_id] : null;
  const subTechName = subTech?.name || (match.sub_technique_id ? String(match.sub_technique_id) : null);

  const resultColor = won ? T.green : T.red;
  const subColor = winMethod === "submission" && subTech ? (MTColors[subTech.type] || T.red) : resultColor;

  // Entry animation sequence
  useEffect(() => {
    // Headline character reveal
    const headline = won
      ? (winMethod === "submission" ? "SUBMITTED" : "VICTORY")
      : (winMethod === "submission" ? "TAPPED" : "DEFEAT");
    const color = won ? (winMethod === "submission" ? T.sub : T.td) : T.sub;

    setTimeout(() => {
      if (headlineRef.current) revealText(headlineRef.current, headline, color, 45);
    }, 300);

    // Sub technique name fade
    if (winMethod === "submission" && subTechName) {
      setTimeout(() => {
        if (subNameRef.current) subNameRef.current.style.opacity = '1';
      }, 1200);
    }

    // Stats count-up
    setTimeout(() => {
      if (eloRef.current) countUp(eloRef.current, Math.abs(eloChange), 1200, 0, eloChange >= 0 ? '+' : '-');
    }, 1700);
    setTimeout(() => {
      if (myPtsRef.current) countUp(myPtsRef.current, myPoints || 0, 800);
    }, 1850);
    setTimeout(() => {
      if (turnRef.current) countUp(turnRef.current, match.current_turn || 0, 600);
    }, 2000);

    // Confetti on victory
    if (won) {
      setTimeout(() => {
        if (confettiRef.current) confettiBurst(confettiRef.current, 35);
      }, 500);
    }
  }, []);

  useEffect(() => {
    if (!match.id) return;

    if (won && profile) {
      (async () => {
        const { data: freshProfile } = await sb.from('profiles').select('*').eq('id', profile.id).single();
        if (!freshProfile) return;
        const reqs = STRIPE_REQUIREMENTS[freshProfile.belt];
        if (!reqs) return;
        const currentStripe = freshProfile.belt_stripe || 0;
        const nextReq = reqs.find(r => r.stripe === currentStripe + 1);
        if (!nextReq) return;
        if ((freshProfile.matches_won || 0) >= nextReq.wins && (freshProfile.submissions_earned || 0) >= nextReq.subs) {
          const { error } = await sb.from('profiles').update({ belt_stripe: currentStripe + 1 }).eq('id', profile.id);
          if (!error) setStripeEarned({ newStripe: currentStripe + 1, belt: freshProfile.belt });
        }
      })();
    }

    if (!won) return;
    (async () => {
      const { data: turns } = await sb.from('match_turns').select('*').eq('match_id', match.id).order('turn_number');
      if (!turns || turns.length === 0) return;
      const oppTechIds = [];
      for (const t of turns) {
        const tid = isP1 ? (t.player2_technique_id || t.player2_move) : (t.player1_technique_id || t.player1_move);
        if (tid && tid !== '__survive__' && tid !== '__spaz__' && !oppTechIds.includes(tid)) oppTechIds.push(tid);
      }
      if (oppTechIds.length === 0) { setLearnedTech(null); return; }
      const { data: playerDeck } = await sb.from('player_move_stacks').select('technique_id').eq('profile_id', profile.id);
      const playerTechIds = new Set((playerDeck || []).map(d => d.technique_id));
      let techLookup = G.techniques;
      if (!techLookup || Object.keys(techLookup).length === 0) {
        const { data: techData } = await sb.from('techniques').select('id, name, type').in('id', oppTechIds);
        techLookup = {}; (techData || []).forEach(t => { techLookup[t.id] = t; });
      }
      for (const tid of oppTechIds) {
        if (!playerTechIds.has(tid)) {
          const tech = techLookup[tid];
          if (tech) { setLearnedTech({ name: tech.name, type: tech.type }); return; }
        }
      }
      const lastTid = oppTechIds[oppTechIds.length - 1];
      const tech = techLookup[lastTid];
      if (tech) setLearnedTech({ name: tech.name, type: tech.type });
      else setLearnedTech(null);
    })();
  }, [won, match.id]);

  return (
    <div style={{ padding: "20px", background: T.bg, minHeight: "100vh", position: 'relative', overflow: 'hidden' }}>
      {/* Confetti container */}
      <div ref={confettiRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 50 }} />

      {/* Flash overlay */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1,
        background: `radial-gradient(ellipse at 50% 30%, ${won ? T.gold + '14' : T.sub + '14'} 0%, transparent 65%)`,
        animation: 'fadeIn 0.1s ease, fadeSlideUp 0.6s ease 0.1s reverse forwards',
      }} />

      {/* Result tag */}
      <div style={{ textAlign: 'center', marginBottom: 6, animation: 'fadeSlideDown 0.3s var(--ease-out-expo) 0.1s both' }}>
        <span style={{ fontFamily: F.mono, fontSize: 10, color: resultColor, letterSpacing: '0.15em' }}>
          {won ? 'VICTORY' : 'DEFEAT'} · {winMethod.toUpperCase()}
        </span>
      </div>

      {/* Result headline — character reveal */}
      <div style={{ textAlign: "center", marginBottom: 20, position: 'relative', zIndex: 2 }}>
        <div ref={headlineRef} style={{ fontFamily: F.display, fontSize: 48, lineHeight: 1, minHeight: 52 }} />
        {winMethod === "submission" && subTechName && (
          <div ref={subNameRef} style={{ fontFamily: F.display, fontSize: 22, color: subColor, marginTop: 4, fontStyle: 'italic', opacity: 0, transition: 'opacity 0.4s' }}>
            {subTechName}
          </div>
        )}
        <div style={{ fontFamily: F.mono, fontSize: 10, color: T.dim, marginTop: 6, animation: 'fadeIn 0.3s ease 0.8s both' }}>
          Turn {match.current_turn || "?"} · Score {myPoints || 0}-{oppPoints || 0}
        </div>
      </div>

      {/* Stripe earned */}
      {stripeEarned && (
        <div style={{
          padding: "14px", textAlign: "center", marginBottom: 16,
          background: `${T.gold}06`, border: `1px solid ${T.gold}20`, borderRadius: 10,
          animation: "fadeSlideUp 0.4s var(--ease-out-expo) 3s both",
        }}>
          <div style={{ fontFamily: F.display, fontSize: 20, color: T.gold, marginBottom: 6 }}>New Stripe Earned</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <div style={{
              width: 80, height: 14, borderRadius: 4,
              background: BeltColors[stripeEarned.belt] || '#E8E8E8',
              border: stripeEarned.belt === 'white' ? '1px solid #D1D5DB' : 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 5, gap: 2,
            }}>
              {Array.from({ length: stripeEarned.newStripe }).map((_, i) => (
                <div key={i} style={{
                  width: 2.5, height: 9,
                  background: stripeEarned.belt === 'white' ? '#374151' : '#F0F0F0',
                  borderRadius: 1,
                  animation: i === stripeEarned.newStripe - 1 ? 'stripePop 0.5s ease-out 0.3s both' : 'none',
                }} />
              ))}
            </div>
            <span style={{ fontFamily: F.mono, fontSize: 11, color: T.gold }}>
              {stripeEarned.belt} · {stripeEarned.newStripe} stripe{stripeEarned.newStripe > 1 ? 's' : ''}
            </span>
          </div>
        </div>
      )}

      {/* Elo change — count-up */}
      <div style={{ display: "flex", justifyContent: "center", gap: 16, marginBottom: 20, fontFamily: F.mono, animation: 'fadeSlideUp 0.3s var(--ease-out-expo) 1.7s both' }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 11, color: T.dim, marginBottom: 3 }}>Before</div>
          <div style={{ fontSize: 16, color: T.muted }}>{(match.elo_before || 1200)}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div ref={eloRef} style={{ fontSize: 24, color: resultColor, fontFamily: F.display }}>0</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 11, color: T.dim, marginBottom: 3 }}>After</div>
          <div style={{ fontSize: 16, color: T.gold, fontWeight: 600 }}>{(match.elo_before || 1200) + eloChange}</div>
        </div>
      </div>

      {/* Match stats — count-up */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, fontFamily: F.mono, fontSize: 10 }}>
        {[
          { label: "Turns", ref: turnRef },
          { label: "Your Pts", ref: myPtsRef },
          { label: "Opp Pts", value: oppPoints || 0 },
        ].map((s, i) => (
          <div key={s.label} style={{ flex: 1, padding: "10px", textAlign: "center", background: '#FFFFFF', border: `1px solid ${T.border}`, borderRadius: 8, boxShadow: T.shadowSm, animation: `fadeSlideUp 0.3s var(--ease-out-expo) ${1.7 + i * 0.15}s both` }}>
            <div ref={s.ref} style={{ color: T.text, fontWeight: 600, fontSize: 16, fontFamily: F.display }}>{s.value !== undefined ? s.value : '0'}</div>
            <div style={{ color: T.dim, fontSize: 9 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* New technique learned */}
      {won && learnedTech && (
        <div style={{ padding: "12px", background: `${T.escape}06`, border: `1px solid ${T.escape}15`, borderRadius: 8, marginBottom: 16, animation: 'fadeSlideUp 0.3s var(--ease-out-expo) 2.8s both' }}>
          <div style={{ fontFamily: F.mono, fontSize: 9, color: T.escape, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>New Technique Learned</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <MoveIcon type={learnedTech.type} size={16}/>
            <span style={{ fontFamily: F.display, fontSize: 14, color: T.text }}>{learnedTech.name}</span>
            <span style={{ fontFamily: F.mono, fontSize: 9, color: T.dim }}>added to Known</span>
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: 8, animation: 'fadeSlideUp 0.3s var(--ease-out-expo) 2.5s both' }}>
        <Btn full variant="primary" onClick={onRematch}>Rematch</Btn>
        <Btn full variant="secondary" onClick={onHome}>Home</Btn>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// OPEN MAT — POST MATCH SCREEN
// Results, Elo change, technique progress, belt progress
// ═══════════════════════════════════════════════════════════

import React, { useState, useEffect } from 'react';
import { T, BeltColors } from '../lib/tokens';
import { MoveIcon } from '../lib/icons';
import { Bar, Btn } from '../components/UI';
import { sb, G } from '../lib/supabase';
import { MTColors, MTLabels } from '../lib/tokens';

export default function PostMatchScreen({ profile, match, onRematch, onHome }) {
  if (!match) return null;

  const [learnedTech, setLearnedTech] = useState(null); // { name, type }

  const isP1 = match.player1_id === profile?.id;
  const won = match.winner_id === profile?.id;
  const winMethod = match.win_method || match.result_method || match.method || match.finish_method || "points";
  const myPoints = isP1 ? match.player1_points : match.player2_points;
  const oppPoints = isP1 ? match.player2_points : match.player1_points;
  const eloChange = match.elo_change || (won ? 18 : -12);

  // Look up sub technique name from G cache
  const subTech = match.sub_technique_id ? G.techniques[match.sub_technique_id] : null;
  const subTechName = subTech?.name || (match.sub_technique_id ? String(match.sub_technique_id) : null);

  // Fetch opponent's techniques from match_turns to find what was learned
  useEffect(() => {
    if (!won || !match.id) return;
    (async () => {
      const oppMoveField = isP1 ? 'player2_technique_id' : 'player1_technique_id';
      const { data: turns } = await sb.from('match_turns').select('*').eq('match_id', match.id).order('turn_number');
      if (!turns || turns.length === 0) return;

      // Collect opponent's technique IDs from turns
      const oppTechIds = [];
      for (const t of turns) {
        const tid = isP1 ? (t.player2_technique_id || t.player2_move) : (t.player1_technique_id || t.player1_move);
        if (tid && !oppTechIds.includes(tid)) oppTechIds.push(tid);
      }

      // Get player's deck to find what they DON'T have
      const { data: playerDeck } = await sb.from('player_move_stacks').select('technique_id').eq('profile_id', profile.id);
      const playerTechIds = new Set((playerDeck || []).map(d => d.technique_id));

      // Find first opponent technique the player doesn't have
      for (const tid of oppTechIds) {
        if (!playerTechIds.has(tid)) {
          const tech = G.techniques[tid];
          if (tech) {
            setLearnedTech({ name: tech.name, type: tech.type });
            return;
          }
        }
      }
      // Fallback: show the last opponent technique used
      if (oppTechIds.length > 0) {
        const lastTid = oppTechIds[oppTechIds.length - 1];
        const tech = G.techniques[lastTid];
        if (tech) setLearnedTech({ name: tech.name, type: tech.type });
      }
    })();
  }, [won, match.id]);

  return (
    <div style={{ padding: "20px", animation: "fadeUp 0.3s ease-out" }}>
      {/* Result headline */}
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <div style={{ fontFamily: T.display, fontSize: 48, color: won ? T.green : T.red, letterSpacing: "0.06em", lineHeight: 1 }}>
          {won ? (winMethod === "submission" ? "SUBMISSION" : "VICTORY") : "DEFEAT"}
        </div>
        {winMethod === "submission" && subTechName && (
          <div style={{ fontFamily: T.display, fontSize: 22, color: T.muted, marginTop: 4 }}>
            {subTechName}
          </div>
        )}
        <div style={{ fontFamily: T.mono, fontSize: 10, color: T.dim, marginTop: 6 }}>
          Turn {match.current_turn || "?"} · Score {myPoints || 0}-{oppPoints || 0}
        </div>
      </div>

      {/* Elo change */}
      <div style={{ display: "flex", justifyContent: "center", gap: 16, marginBottom: 20, fontFamily: T.mono }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 11, color: T.dim, marginBottom: 3 }}>Before</div>
          <div style={{ fontSize: 16, color: T.muted }}>{(match.elo_before || 1200)}</div>
        </div>
        <div style={{ fontSize: 24, color: won ? T.green : T.red, alignSelf: "center", fontFamily: T.display }}>
          → {won ? "+" : ""}{eloChange}
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 11, color: T.dim, marginBottom: 3 }}>After</div>
          <div style={{ fontSize: 16, color: T.gold, fontWeight: 600 }}>{(match.elo_before || 1200) + eloChange}</div>
        </div>
      </div>

      {/* Match stats */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, fontFamily: T.mono, fontSize: 10 }}>
        {[
          { label: "Turns", value: match.current_turn || "?" },
          { label: "Your Pts", value: myPoints || 0 },
          { label: "Opp Pts", value: oppPoints || 0 },
        ].map(s => (
          <div key={s.label} style={{ flex: 1, padding: "8px", textAlign: "center", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 4 }}>
            <div style={{ color: T.text, fontWeight: 600, fontSize: 14 }}>{s.value}</div>
            <div style={{ color: T.dim, fontSize: 9 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* New technique learned (on win) */}
      {won && (
        <div style={{ padding: "12px", background: `${T.teal}08`, border: `1px solid ${T.teal}20`, borderRadius: 6, marginBottom: 16 }}>
          <div style={{ fontFamily: T.mono, fontSize: 9, color: T.teal, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>New Technique Learned</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <MoveIcon type={learnedTech?.type || "submission"} size={16}/>
            <span style={{ fontFamily: T.mono, fontSize: 12, color: T.white }}>{learnedTech?.name || 'Loading...'}</span>
            <span style={{ fontFamily: T.mono, fontSize: 9, color: T.dim }}>added to Known</span>
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: 8 }}>
        <Btn full variant="primary" onClick={onRematch}>Rematch</Btn>
        <Btn full variant="secondary" onClick={onHome}>Home</Btn>
      </div>

      <style>{`
        @keyframes fadeUp { 0% { opacity: 0; transform: translateY(8px); } 100% { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
